import type { DefectData, TranslatedDefect } from '../types/defect';
import type { TranslateConfig } from '../types/config';
import { dictService, type DictMatch } from './dict-service';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import md5 from 'blueimp-md5';

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

let onlineAvailable = true;
let lastFailTime = 0;
const COOLDOWN_MS = 30000;

export function resetOnlineState() {
  onlineAvailable = true;
  lastFailTime = 0;
}

async function translateOnline(text: string, config?: OnlineConfig): Promise<string | null> {
  if (!config) {
    console.warn('[translate-engine] No online config provided, skipping online translation');
    return null;
  }
  if (!onlineAvailable && Date.now() - lastFailTime < COOLDOWN_MS) {
    console.warn('[translate-engine] Online translation in cooldown, skipping');
    return null;
  }

  try {
    if (config.provider === 'baidu' && config.baiduAppId && config.baiduSecret) {
      const salt = Date.now().toString();
      const sign = md5(config.baiduAppId + text + salt + config.baiduSecret);
      const url = `https://fanyi-api.baidu.com/api/trans/vip/translate?` +
        `q=${encodeURIComponent(text)}&from=zh&to=en&appid=${config.baiduAppId}&salt=${salt}&sign=${sign}`;
      const resp = await tauriFetch(url);
      if (!resp.ok) throw new Error(`Baidu API error: ${resp.status}`);
      const data = await resp.json();
      if (data.error_code) throw new Error(`Baidu API error: ${data.error_msg}`);
      onlineAvailable = true;
      return data.trans_result?.map((r: any) => r.dst).join('\n') || null;
    } else if (config.provider === 'baidu') {
      console.warn('[translate-engine] Baidu provider selected but missing appId or secret:', { hasAppId: !!config.baiduAppId, hasSecret: !!config.baiduSecret });
    }

    if (config.provider === 'youdao' && config.youdaoAppKey && config.youdaoAppSecret) {
      const salt = Date.now().toString();
      const curtime = Math.floor(Date.now() / 1000).toString();
      const input = buildYoudaoInput(text);
      const sign = await sha256(config.youdaoAppKey + input + salt + curtime + config.youdaoAppSecret);
      const params = new URLSearchParams({
        q: text,
        from: 'zh-CHS',
        to: 'en',
        appKey: config.youdaoAppKey,
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
      return data.translation?.[0] || null;
    } else if (config.provider === 'youdao') {
      console.warn('[translate-engine] Youdao provider selected but missing appKey or appSecret');
    }

    console.warn('[translate-engine] No matching provider config, returning null');
    return null;
  } catch (err) {
    console.error('[translate-engine] Online translation failed:', err);
    onlineAvailable = false;
    lastFailTime = Date.now();
    return `__TRANSLATE_ERROR__: ${(err as Error)?.message || String(err)}`;
  }
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

function hasChinese(text: string): boolean {
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

  const fullUntranslated = allParts.join('\n');
  const onlineResult = await translateOnline(fullUntranslated, onlineConfig);

  if (onlineResult && onlineResult.startsWith('__TRANSLATE_ERROR__:')) {
    const error = onlineResult.replace('__TRANSLATE_ERROR__: ', '');
    const fallbackResult = lines.map(line => simpleFallbackTranslate(line)).join('\n');
    return { translated: fallbackResult, hasUntranslated: true, source: 'fallback', error };
  }

  if (onlineResult) {
    const onlineParts = onlineResult.split('\n');
    const finalLines = dictByLine.map(r => r.result);

    for (let i = 0; i < partMeta.length; i++) {
      const { lineIdx, partIdx } = partMeta[i];
      const originalPart = dictByLine[lineIdx].untranslatedParts[partIdx];
      const translatedPart = i < onlineParts.length ? onlineParts[i] : originalPart;
      finalLines[lineIdx] = finalLines[lineIdx].replace(originalPart, translatedPart);
    }

    const translated = finalLines.join('\n');
    const hasUntranslated = hasChinese(translated);
    return { translated, hasUntranslated, source: 'online' };
  }

  const fallbackResult = lines.map(line => simpleFallbackTranslate(line)).join('\n');
  const hasUntranslated = hasChinese(fallbackResult);
  return { translated: fallbackResult, hasUntranslated, source: 'fallback' };
}

export async function translateDefect(
  defect: DefectData,
  onlineConfig?: OnlineConfig,
): Promise<TranslatedDefect & { translateErrors?: string[] }> {
  await dictService.loadAll().catch(() => {});

  const [summary, timestamp, precondition, steps, expectedResult, actualResult, recoverSteps] = await Promise.all([
    translateField(defect.summary, onlineConfig),
    translateField(defect.timestamp, onlineConfig),
    translateField(defect.precondition, onlineConfig),
    translateField(defect.steps, onlineConfig),
    translateField(defect.expectedResult, onlineConfig),
    translateField(defect.actualResult, onlineConfig),
    translateField(defect.recoverSteps, onlineConfig),
  ]);

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
