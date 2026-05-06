import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { AiConfig, JiraConfig } from '../types/config';
import type { TestPoint } from '../types/test-case';
import { parseAiResponse, extractJsonArray, rawToTestPoint, type RawTestPoint } from './ai-parser';

const SYSTEM_PROMPT = `你是一名专业的软件测试工程师，擅长根据产品需求文档（PRD）生成测试用例。
你的任务是根据用户提供的 PRD 内容，生成结构化的测试点列表。

每个测试点必须包含以下字段：
- title: 测试点的标题（简洁描述测试场景）
- description: 测试点描述（说明该测试点的目的、验证的是什么功能或场景）
- precondition: 执行该测试点需要的前置条件
- steps: 测试步骤列表，每个步骤包含 action（操作）和 expectedResult（预期结果）
- priority: 优先级，可选值为 Blocker、Critical、Major、Minor、Trivial

要求：
1. 覆盖正常流程和异常流程
2. 关注边界条件和异常场景
3. 步骤要具体、可执行
4. 预期结果要明确、可验证
5. 描述要清晰说明测试目的
6. 输出必须是 JSON 数组格式
7. 所有内容使用中文`;

function buildUserPrompt(prdContent: string, sourceType?: 'file' | 'url'): string {
  const sourceHint = sourceType === 'url'
    ? '\n注意：此 PRD 内容通过 URL 获取，已做过正文提取和结构化处理。如果仍有少量非正文残留（如导航文字），请忽略，专注于文档主体内容生成测试点。'
    : '';

  return `请根据以下 PRD 内容生成测试点：${sourceHint}

---
${prdContent}
---

请以 JSON 数组格式输出，每个元素格式如下：
{
  "title": "测试点标题",
  "description": "测试点描述，说明该测试点的目的和验证内容",
  "precondition": "前置条件",
  "steps": [
    { "action": "操作步骤", "expectedResult": "预期结果" }
  ],
  "priority": "Major"}`;
}

export async function generateTestPoints(
  prdContent: string,
  aiConfig: AiConfig,
  sourceType?: 'file' | 'url',
): Promise<TestPoint[]> {
  const rawResponse = await invoke<string>('ai_chat_completion', {
    config: {
      provider: aiConfig.provider,
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      baseUrl: aiConfig.baseUrl || null,
    },
    systemPrompt: SYSTEM_PROMPT,
    userMessage: buildUserPrompt(prdContent, sourceType),
  });

  return parseAiResponse(rawResponse);
}

export interface StreamCallbacks {
  onChunk: (accumulated: string) => void;
  onTestPoint: (point: TestPoint, index: number) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
}


function tryParsePartialJson(accumulated: string, alreadyParsed: number): TestPoint[] {
  const jsonStr = extractJsonArray(accumulated);
  if (!jsonStr) return [];

  const results: TestPoint[] = [];
  let objectCount = 0;
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{' && depth === 0) {
      objStart = i;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        if (objectCount >= alreadyParsed) {
          const objStr = jsonStr.substring(objStart, i + 1);
          try {
            const raw = JSON.parse(objStr) as RawTestPoint;
            results.push(rawToTestPoint(raw, objectCount));
          } catch {
            // incomplete/malformed JSON, skip
          }
        }
        objectCount++;
        objStart = -1;
      }
    }
  }

  return results;
}

export async function generateTestPointsStream(
  prdContent: string,
  aiConfig: AiConfig,
  callbacks: StreamCallbacks,
  sourceType?: 'file' | 'url',
): Promise<void> {
  const requestId = crypto.randomUUID();
  let accumulated = '';
  let parsedCount = 0;

  const unlisten: UnlistenFn = await listen<{
    requestId: string;
    chunk: string;
    done: boolean;
  }>('ai-stream', (event) => {
    if (event.payload.requestId !== requestId) return;

    if (event.payload.done) {
      if (event.payload.chunk.startsWith('__ERROR__:')) {
        callbacks.onError(event.payload.chunk.slice(10));
        return;
      }
      callbacks.onDone(accumulated);
      return;
    }

    accumulated += event.payload.chunk;
    callbacks.onChunk(accumulated);

    const newPoints = tryParsePartialJson(accumulated, parsedCount);
    for (const point of newPoints) {
      callbacks.onTestPoint(point, parsedCount);
      parsedCount++;
    }
  });

  try {
    await invoke('ai_stream_chat', {
      config: {
        provider: aiConfig.provider,
        apiKey: aiConfig.apiKey,
        model: aiConfig.model,
        baseUrl: aiConfig.baseUrl || null,
      },
      systemPrompt: SYSTEM_PROMPT,
      userMessage: buildUserPrompt(prdContent, sourceType),
      requestId,
    });
  } catch (err) {
    callbacks.onError(err?.toString() || '流式请求失败');
  } finally {
    unlisten();
  }
}

export async function fetchUrlContent(url: string): Promise<string> {
  return invoke<string>('fetch_url_content', { url });
}

export async function fetchConfluenceContent(url: string, jiraConfig: JiraConfig): Promise<string> {
  return invoke<string>('fetch_confluence_content', {
    url,
    config: {
      serverUrl: jiraConfig.serverUrl,
      username: jiraConfig.username,
      apiToken: jiraConfig.apiToken,
      projectKey: jiraConfig.projectKey,
      issueType: jiraConfig.issueType,
    },
  });
}
