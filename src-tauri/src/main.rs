// 防止 main 在 doctest 和 bench 模式下重复链接
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    jira_defect_tool_lib::run()
}
