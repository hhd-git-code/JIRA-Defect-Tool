use scraper::{Html, Selector, element_ref::ElementRef, node::Node};
use ego_tree::NodeId;
use std::collections::HashSet;

/// 从 HTML 提取正文内容并保留文档结构
pub fn extract_prd_content(html: &str) -> String {
    let document = Html::parse_document(html);

    // 收集噪音节点 ID
    let noise_ids = collect_noise_node_ids(&document);

    // 定位正文容器
    let main_element = find_main_content(&document, &noise_ids);

    // 结构化文本输出
    let text = node_to_structured_text(&main_element, &noise_ids);

    // 后处理
    post_process(&text)
}

/// 噪音 CSS 选择器列表
fn get_noise_selectors() -> Vec<&'static str> {
    vec![
        // 通用噪音标签
        "script", "style", "noscript", "iframe",
        "nav", "header", "footer", "aside",
        // 通用噪音 class/id
        ".sidebar", "#sidebar", ".navigation", ".nav-bar",
        ".menu", ".breadcrumb", ".footer", ".header",
        // Confluence 特有
        "#header", "#footer", ".page-metadata",
        "#likes-and-labels-container", ".page-restrictions",
        "#breadcrumb-section", ".aui-nav",
        "#navigation", ".page-sidebar",
        ".plugin_pagetree", ".plugin_pagetree_children",
        // 通用页面噪音
        ".ads", ".ad", ".advertisement",
        ".comment", ".comments", "#comments",
        ".share", ".social", ".social-share",
    ]
}

/// 收集所有噪音节点的 ID
fn collect_noise_node_ids(document: &Html) -> HashSet<NodeId> {
    let mut noise_ids = HashSet::new();

    for sel_str in get_noise_selectors() {
        if let Ok(selector) = Selector::parse(sel_str) {
            for element in document.select(&selector) {
                collect_subtree_ids(&element, &mut noise_ids);
            }
        }
    }

    noise_ids
}

/// 递归收集元素子树所有节点 ID
fn collect_subtree_ids(element: &ElementRef, ids: &mut HashSet<NodeId>) {
    for node in element.descendants() {
        ids.insert(node.id());
    }
}

/// 定位正文容器，按优先级尝试
fn find_main_content<'a>(document: &'a Html, noise_ids: &HashSet<NodeId>) -> ElementRef<'a> {
    // 优先级 1：Confluence 特定选择器
    let confluence_selectors = [
        "#main-content",
        ".wiki-content",
        "#content-body",
        "#content-body .view",
        "[data-testid='content-body']",
        ".confluenceTable",
    ];

    for sel_str in &confluence_selectors {
        if let Ok(selector) = Selector::parse(sel_str) {
            if let Some(element) = document.select(&selector).next() {
                if !noise_ids.contains(&element.id()) {
                    return element;
                }
            }
        }
    }

    // 优先级 2：HTML5 语义标签
    let semantic_selectors = ["article", "main", "[role='main']"];
    for sel_str in &semantic_selectors {
        if let Ok(selector) = Selector::parse(sel_str) {
            if let Some(element) = document.select(&selector).next() {
                if !noise_ids.contains(&element.id()) {
                    return element;
                }
            }
        }
    }

    // 优先级 3：通用启发式 — 文本密度最高的 div/section
    if let Some(element) = find_densest_content_block(document, noise_ids) {
        return element;
    }

    // 兜底：body，遍历时仍会过滤噪音
    document
        .select(&Selector::parse("body").unwrap())
        .next()
        .unwrap_or_else(|| document.root_element())
}

/// 启发式：找文本密度最高、链接文字占比最低的 div/section
fn find_densest_content_block<'a>(
    document: &'a Html,
    noise_ids: &HashSet<NodeId>,
) -> Option<ElementRef<'a>> {
    let div_selector = Selector::parse("div, section").ok()?;

    let mut best_element: Option<ElementRef> = None;
    let mut best_score: f64 = 0.0;

    let link_selector = Selector::parse("a").ok()?;

    for element in document.select(&div_selector) {
        if noise_ids.contains(&element.id()) {
            continue;
        }

        let text_len = element.text().collect::<String>().trim().len() as f64;
        if text_len < 100.0 {
            continue;
        }

        let link_text_len: f64 = element
            .select(&link_selector)
            .map(|a| a.text().collect::<String>().trim().len() as f64)
            .sum();

        let link_ratio = if text_len > 0.0 {
            link_text_len / text_len
        } else {
            1.0
        };
        let score = text_len * (1.0 - link_ratio);

        if score > best_score {
            best_score = score;
            best_element = Some(element);
        }
    }

    best_element
}

/// 遍历 DOM 树，输出结构化文本
fn node_to_structured_text(element: &ElementRef, noise_ids: &HashSet<NodeId>) -> String {
    let mut output = String::new();
    let mut list_depth: usize = 0;

    // 用迭代器 + 栈模拟递归遍历，以便区分"进入"和"离开"节点
    // scraper 的 descendants() 只能前序遍历（只有进入，没有离开）
    // 所以用递归的方式手动遍历子节点
    render_node(element, noise_ids, &mut list_depth, &mut output);

    output
}

/// 递归渲染节点
fn render_node(
    element: &ElementRef,
    noise_ids: &HashSet<NodeId>,
    list_depth: &mut usize,
    output: &mut String,
) {
    for child in element.children() {
        let child_id = child.id();
        if noise_ids.contains(&child_id) {
            continue;
        }

        match child.value() {
            Node::Element(el) => {
                let tag = el.name.local.as_ref();

                // 进入元素 — 输出前缀
                match tag {
                    "h1" => { output.push_str("\n# "); }
                    "h2" => { output.push_str("\n## "); }
                    "h3" => { output.push_str("\n### "); }
                    "h4" => { output.push_str("\n#### "); }
                    "h5" => { output.push_str("\n##### "); }
                    "h6" => { output.push_str("\n###### "); }
                    "p" => { output.push('\n'); }
                    "div" => { output.push('\n'); }
                    "br" => { output.push('\n'); }
                    "hr" => { output.push_str("\n---\n"); }
                    "li" => {
                        output.push_str(&format!("{}- ", "  ".repeat(*list_depth)));
                    }
                    "ul" | "ol" => {
                        *list_depth += 1;
                        output.push('\n');
                    }
                    "tr" => { output.push('\n'); }
                    "td" | "th" => { output.push_str(" | "); }
                    "table" => { output.push('\n'); }
                    "thead" => {}
                    "blockquote" => { output.push_str("\n> "); }
                    "img" => {
                        if let Some(alt) = el.attr("alt") {
                            if !alt.is_empty() {
                                output.push_str(alt);
                            }
                        }
                    }
                    "pre" | "code" => { output.push('\n'); }
                    _ => {}
                }

                // 递归处理子元素
                if let Some(child_element) = ElementRef::wrap(child) {
                    render_node(&child_element, noise_ids, list_depth, output);
                }

                // 离开元素 — 输出后缀
                match tag {
                    "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => {
                        output.push('\n');
                    }
                    "ul" | "ol" => {
                        if *list_depth > 0 {
                            *list_depth -= 1;
                        }
                    }
                    "table" => { output.push('\n'); }
                    _ => {}
                }
            }
            Node::Text(text) => {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    if !output.is_empty()
                        && !output.ends_with('\n')
                        && !output.ends_with(' ')
                        && !output.ends_with('|')
                        && !output.ends_with('#')
                        && !output.ends_with('-')
                    {
                        output.push(' ');
                    }
                    output.push_str(trimmed);
                }
            }
            _ => {}
        }
    }
}

/// 后处理：HTML 实体解码 + 清理空白
fn post_process(text: &str) -> String {
    let decoded = html_escape::decode_html_entities(text);
    decoded
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_confluence_page() {
        let html = r#"
        <html>
        <head><title>Test</title></head>
        <body>
            <nav>导航菜单</nav>
            <header>页面头部</header>
            <div id="breadcrumb-section">面包屑</div>
            <div id="main-content">
                <h1>PRD 标题</h1>
                <p>这是 PRD 的正文内容。</p>
                <h2>功能需求</h2>
                <ul>
                    <li>需求一</li>
                    <li>需求二</li>
                </ul>
                <table>
                    <tr><th>字段</th><th>说明</th></tr>
                    <tr><td>名称</td><td>产品名</td></tr>
                </table>
            </div>
            <aside>侧边栏</aside>
            <footer>页脚信息</footer>
        </body>
        </html>
        "#;

        let result = extract_prd_content(html);

        assert!(result.contains("PRD 标题"), "应包含标题");
        assert!(result.contains("这是 PRD 的正文内容"), "应包含正文");
        assert!(result.contains("功能需求"), "应包含二级标题");
        assert!(result.contains("需求一"), "应包含列表项");
        assert!(!result.contains("导航菜单"), "不应包含导航");
        assert!(!result.contains("页面头部"), "不应包含头部");
        assert!(!result.contains("面包屑"), "不应包含面包屑");
        assert!(!result.contains("侧边栏"), "不应包含侧边栏");
        assert!(!result.contains("页脚信息"), "不应包含页脚");
    }

    #[test]
    fn test_generic_page_with_article() {
        let html = r#"
        <html><body>
            <nav>导航</nav>
            <article>
                <h1>文章标题</h1>
                <p>文章正文</p>
            </article>
            <footer>页脚</footer>
        </body></html>
        "#;

        let result = extract_prd_content(html);
        assert!(result.contains("文章标题"));
        assert!(result.contains("文章正文"));
        assert!(!result.contains("导航"));
        assert!(!result.contains("页脚"));
    }

    #[test]
    fn test_structured_output() {
        let html = r#"<div id="main-content"><h2>标题</h2><ul><li>项目一</li><li>项目二</li></ul><table><tr><td>A</td><td>B</td></tr></table></div>"#;

        let result = extract_prd_content(html);
        assert!(result.contains("## 标题"), "标题应有 ## 标记, got: {:?}", result);
        assert!(result.contains("- 项目一"), "列表项应有 - 标记");
        assert!(result.contains("| A | B"), "表格应用 | 分隔, got: {:?}", result);
    }
}
