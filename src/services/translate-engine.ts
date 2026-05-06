import type { DefectData, TranslatedDefect } from '../types/defect';
import type { TranslateConfig } from '../types/config';
import { dictService, type DictMatch } from './dict-service';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import md5 from 'blueimp-md5';

// 在线翻译API请求间隔（ms），避免触发QPS限制（百度标准版1QPS）
const API_CALL_INTERVAL = 200;

let lastApiCallTime = 0;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function throttleApiCall(): Promise<void> {
  const elapsed = Date.now() - lastApiCallTime;
  if (elapsed < API_CALL_INTERVAL) {
    await delay(API_CALL_INTERVAL - elapsed);
  }
}

export interface TranslateResult {
  translated: string;
  hasUntranslated: boolean;
  source: 'dict' | 'online' | 'fallback';
  error?: string;
}

export interface OnlineConfig {
  provider: 'baidu' | 'youdao';
  // 百度翻译
  baiduAppId?: string;
  baiduSecret?: string;
  // 网易有道智云
  youdaoAppKey?: string;
  youdaoAppSecret?: string;
}

export function isOnlineConfigValid(config: TranslateConfig): boolean {
  if (!config.onlineEnabled) return false;
  return (config.onlineProvider === 'baidu' && !!config.baiduAppId && !!config.baiduSecret) ||
    (config.onlineProvider === 'youdao' && !!config.youdaoAppKey && !!config.youdaoAppSecret);
}

export function buildOnlineConfig(config: TranslateConfig): OnlineConfig | undefined {
  if (!isOnlineConfigValid(config)) return undefined;
  return {
    provider: config.onlineProvider,
    baiduAppId: config.baiduAppId,
    baiduSecret: config.baiduSecret,
    youdaoAppKey: config.youdaoAppKey,
    youdaoAppSecret: config.youdaoAppSecret,
  };
}

let onlineAvailable = true;
let lastFailTime = 0;
const COOLDOWN_MS = 30000;

export function resetOnlineState() {
  onlineAvailable = true;
  lastFailTime = 0;
}

/**
 * 批量翻译多个文本片段
 * 使用分隔符标记每个片段，确保结果一一对应
 * 返回数组长度与输入相同，失败的片段返回 null
 */
async function translateOnlineBatch(texts: string[], config?: OnlineConfig): Promise<(string | null)[]> {
  if (!texts.length) return [];

  if (!config) {
    console.warn('[translate-engine] No online config provided, skipping batch translation');
    return texts.map(() => null);
  }
  if (!onlineAvailable && Date.now() - lastFailTime < COOLDOWN_MS) {
    console.warn('[translate-engine] Online translation in cooldown, skipping batch');
    return texts.map(() => null);
  }

  // 过滤掉不含中文的文本，记录索引映射
  const chineseIndices: number[] = [];
  const chineseTexts: string[] = [];
  texts.forEach((text, i) => {
    if (hasChinese(text)) {
      chineseIndices.push(i);
      chineseTexts.push(text);
    }
  });

  const results: (string | null)[] = texts.map((text, i) =>
    chineseIndices.includes(i) ? null : text // 纯英文/空文本直接返回原值
  );

  if (chineseTexts.length === 0) {
    return results;
  }

  // 批量翻译中文文本
  const translatedResults = await doBatchTranslate(chineseTexts, config);

  // 回填翻译结果
  chineseIndices.forEach((originalIdx, i) => {
    results[originalIdx] = translatedResults[i];
  });

  return results;
}

/**
 * 执行批量翻译API调用
 */
async function doBatchTranslate(texts: string[], config: OnlineConfig): Promise<(string | null)[]> {
  if (config.provider === 'baidu' && config.baiduAppId && config.baiduSecret) {
    return baiduBatchTranslate(texts, config);
  } else if (config.provider === 'youdao' && config.youdaoAppKey && config.youdaoAppSecret) {
    // 有道API不支持多文本批量，需要分批但合并请求
    return youdaoBatchTranslate(texts, config);
  }

  console.warn('[translate-engine] No matching provider config for batch translation');
  return texts.map(() => null);
}

/**
 * 百度批量翻译
 * 逐个文本发送请求（百度标准版不支持多q），通过节流控制QPS
 */
async function baiduBatchTranslate(texts: string[], config: OnlineConfig): Promise<(string | null)[]> {
  if (texts.length === 0) return [];

  const allResults: (string | null)[] = [];

  for (const text of texts) {
    await throttleApiCall();
    lastApiCallTime = Date.now();

    try {
      const salt = Date.now().toString();
      const sign = md5(config.baiduAppId! + text + salt + config.baiduSecret!);

      const url = `https://fanyi-api.baidu.com/api/trans/vip/translate?` +
        `q=${encodeURIComponent(text)}&from=zh&to=en&appid=${config.baiduAppId}&salt=${salt}&sign=${sign}`;

      const resp = await tauriFetch(url);
      if (!resp.ok) throw new Error(`Baidu API error: ${resp.status}`);
      const data = await resp.json();
      if (data.error_code) throw new Error(`Baidu API error: ${data.error_msg}`);

      onlineAvailable = true;

      // 百度API返回的trans_result数组
      const transResults: Array<{ src: string; dst: string }> = data.trans_result || [];
      if (transResults.length > 0) {
        allResults.push(transResults[0].dst);
      } else {
        allResults.push(null);
      }
    } catch (err) {
      console.error('[translate-engine] Baidu translation failed for:', text, err);
      const errMsg = (err as Error)?.message || String(err);
      const isLimitError = errMsg.includes('Invalid Access Limit') || errMsg.includes('54003');
      if (!isLimitError) {
        onlineAvailable = false;
        lastFailTime = Date.now();
      }
      allResults.push(null);
    }
  }

  return allResults;
}

/**
 * 有道批量翻译
 * 有道不支持多q，使用分隔符合并后单次请求
 */
async function youdaoBatchTranslate(texts: string[], config: OnlineConfig): Promise<(string | null)[]> {
  if (texts.length === 0) return [];

  // 有道API单次请求字符限制
  const MAX_CHARS = 5000;
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentChars = 0;

  for (const text of texts) {
    if (currentChars + text.length > MAX_CHARS && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }
    currentBatch.push(text);
    currentChars += text.length;
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  const allResults: (string | null)[] = [];

  for (const batch of batches) {
    await throttleApiCall();
    lastApiCallTime = Date.now();

    try {
      // 使用特殊分隔符合并文本
      const SEPARATOR = '\n---SEP---\n';
      const combinedText = batch.join(SEPARATOR);

      const salt = Date.now().toString();
      const curtime = Math.floor(Date.now() / 1000).toString();
      const input = buildYoudaoInput(combinedText);
      const sign = await sha256(config.youdaoAppKey! + input + salt + curtime + config.youdaoAppSecret!);

      const params = new URLSearchParams({
        q: combinedText,
        from: 'zh-CHS',
        to: 'en',
        appKey: config.youdaoAppKey!,
        salt,
        curtime,
        sign,
      });

      const resp = await tauriFetch('https://openapi.youdao.com/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!resp.ok) throw new Error(`Youdao API error: ${resp.status}`);
      const data = await resp.json();
      if (data.errorCode !== '0') throw new Error(`Youdao API error: ${data.errorCode}`);

      onlineAvailable = true;

      // 分割翻译结果
      const translated = data.translation?.[0] || '';
      const parts = translated.split(SEPARATOR);

      // 确保结果数量匹配
      for (let i = 0; i < batch.length; i++) {
        allResults.push(parts[i] || null);
      }
    } catch (err) {
      console.error('[translate-engine] Youdao batch translation failed:', err);
      onlineAvailable = false;
      lastFailTime = Date.now();
      for (let i = 0; i < batch.length; i++) {
        allResults.push(null);
      }
    }
  }

  return allResults;
}

function buildYoudaoInput(q: string): string {
  if (q.length <= 20) return q;
  return q.substring(0, 10) + q.length.toString() + q.substring(q.length - 10);
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function replaceMatchesWithTranslations(text: string, matches: DictMatch[]): { result: string; untranslatedParts: string[] } {
  if (matches.length === 0) {
    return { result: text, untranslatedParts: text.trim() ? [text] : [] };
  }

  let result = '';
  const untranslatedParts: string[] = [];
  let lastEnd = 0;

  for (const match of matches) {
    if (match.start > lastEnd) {
      const before = text.slice(lastEnd, match.start);
      result += before;
      if (before.trim()) untranslatedParts.push(before);
    }
    result += match.en;
    lastEnd = match.end;
  }

  if (lastEnd < text.length) {
    const after = text.slice(lastEnd);
    result += after;
    if (after.trim()) untranslatedParts.push(after);
  }

  return { result, untranslatedParts };
}

export function hasChinese(text: string): boolean {
  return /[一-鿿㐀-䶿]/.test(text);
}

function simpleFallbackTranslate(text: string): string {
  const matches = dictService.findMatches(text);
  if (matches.length === 0) {
    if (hasChinese(text)) {
      return text.replace(/[一-鿿㐀-䶿豈-﫿]+/g, m => `[未翻译: ${m}]`);
    }
    return text;
  }

  const { result } = replaceMatchesWithTranslations(text, matches);
  return result.replace(/[一-鿿㐀-䶿豈-﫿]+/g, m => `[未翻译: ${m}]`);
}

export async function translateField(
  text: string,
  onlineConfig?: OnlineConfig,
): Promise<TranslateResult> {
  if (!text || !text.trim()) {
    return { translated: '', hasUntranslated: false, source: 'dict' };
  }

  // Split into lines to handle multi-line text correctly.
  // Processing line-by-line ensures untranslated parts never contain \n,
  // so the join('\n')/split('\n') round-trip with the online API maps cleanly.
  const lines = text.split('\n');

  const dictByLine = lines.map(line => {
    if (!line.trim()) return { result: line, untranslatedParts: [] as string[] };
    const matches = dictService.findMatches(line);
    return replaceMatchesWithTranslations(line, matches);
  });

  if (dictByLine.every(r => r.untranslatedParts.length === 0)) {
    return { translated: dictByLine.map(r => r.result).join('\n'), hasUntranslated: false, source: 'dict' };
  }

  // Collect untranslated parts across all lines (each part is a single-line fragment)
  const partMeta: { lineIdx: number; partIdx: number }[] = [];
  const allParts: string[] = [];
  dictByLine.forEach((r, lineIdx) => {
    r.untranslatedParts.forEach((part, partIdx) => {
      partMeta.push({ lineIdx, partIdx });
      allParts.push(part);
    });
  });

  if (allParts.length === 0) {
    return { translated: dictByLine.map(r => r.result).join('\n'), hasUntranslated: false, source: 'dict' };
  }

  // 批量调用在线翻译，一次请求翻译所有片段
  const onlineParts = await translateOnlineBatch(allParts, onlineConfig);

  // 回填翻译结果：按行重建，字典匹配部分用英文，未翻译部分用在线翻译替换
  let hasOnlineError = false;
  let firstErrorMsg = '';
  let partCursor = 0; // 全局未翻译片段游标

  const finalLines = lines.map((originalLine, lineIdx) => {
    const dictResult = dictByLine[lineIdx];
    if (dictResult.untranslatedParts.length === 0) {
      return dictResult.result;
    }

    // 重新按原始行+词典匹配位置构建该行
    const lineMatches = dictService.findMatches(originalLine);
    let rebuilt = '';
    let lastEnd = 0;

    for (const match of lineMatches) {
      // match 前面的未匹配文本
      if (match.start > lastEnd) {
        const before = originalLine.slice(lastEnd, match.start);
        if (before.trim()) {
          // before 是有内容的未翻译片段，用在线翻译结果替换
          const onlinePart = onlineParts[partCursor];
          if (onlinePart !== null && !onlinePart.startsWith('__TRANSLATE_ERROR__:')) {
            rebuilt += onlinePart;
          } else {
            if (onlinePart !== null && onlinePart.startsWith('__TRANSLATE_ERROR__:')) {
              hasOnlineError = true;
              if (!firstErrorMsg) firstErrorMsg = onlinePart.replace('__TRANSLATE_ERROR__: ', '');
            }
            rebuilt += simpleFallbackTranslate(before);
          }
          partCursor++;
        } else {
          rebuilt += before; // 纯空白，原样保留
        }
      }
      rebuilt += match.en;
      lastEnd = match.end;
    }

    // 行末尾的未匹配文本
    if (lastEnd < originalLine.length) {
      const after = originalLine.slice(lastEnd);
      if (after.trim()) {
        const onlinePart = onlineParts[partCursor];
        if (onlinePart !== null && !onlinePart.startsWith('__TRANSLATE_ERROR__:')) {
          rebuilt += onlinePart;
        } else {
          if (onlinePart !== null && onlinePart.startsWith('__TRANSLATE_ERROR__:')) {
            hasOnlineError = true;
            if (!firstErrorMsg) firstErrorMsg = onlinePart.replace('__TRANSLATE_ERROR__: ', '');
          }
          rebuilt += simpleFallbackTranslate(after);
        }
        partCursor++;
      } else {
        rebuilt += after; // 纯空白，原样保留
      }
    }

    return rebuilt;
  });

  const translated = finalLines.join('\n');
  const hasUntranslated = hasChinese(translated);
  const anyOnline = onlineParts.some(p => p !== null && !p.startsWith('__TRANSLATE_ERROR__:'));

  if (hasOnlineError) {
    return { translated, hasUntranslated, source: 'online', error: firstErrorMsg || undefined };
  }

  if (anyOnline) {
    return { translated, hasUntranslated, source: 'online' };
  }

  // 全部在线翻译都没有结果（无配置或冷却中），走fallback
  const fallbackResult = lines.map(line => simpleFallbackTranslate(line)).join('\n');
  return { translated: fallbackResult, hasUntranslated: hasChinese(fallbackResult), source: 'fallback' };
}

export async function translateDefect(
  defect: DefectData,
  onlineConfig?: OnlineConfig,
): Promise<TranslatedDefect & { translateErrors?: string[] }> {
  await dictService.loadAll().catch(() => {});

  // 串行翻译各字段，避免并发触发QPS限流
  const summary = await translateField(defect.summary, onlineConfig);
  const timestamp = await translateField(defect.timestamp, onlineConfig);
  const precondition = await translateField(defect.precondition, onlineConfig);
  const steps = await translateField(defect.steps, onlineConfig);
  const expectedResult = await translateField(defect.expectedResult, onlineConfig);
  const actualResult = await translateField(defect.actualResult, onlineConfig);
  const recoverSteps = await translateField(defect.recoverSteps, onlineConfig);

  const translateErrors = [summary, timestamp, precondition, steps, expectedResult, actualResult, recoverSteps]
    .filter(r => r.error)
    .map(r => r.error!);

  const uniqueErrors = [...new Set(translateErrors)];

  return {
    summaryEn: summary.translated,
    timestampEn: timestamp.translated,
    preconditionEn: precondition.translated,
    stepsEn: steps.translated,
    expectedResultEn: expectedResult.translated,
    actualResultEn: actualResult.translated,
    reproduceRateEn: defect.reproduceRate || '',
    recoverStepsEn: recoverSteps.translated,
    translateErrors: uniqueErrors.length > 0 ? uniqueErrors : undefined,
  };
}
