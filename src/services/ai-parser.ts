import type { TestPoint, TestStep } from '../types/test-case';
import { PRIORITY_NAMES } from '../constants/priority';

export interface RawTestPoint {
  title?: string;
  description?: string;
  precondition?: string;
  steps?: Array<{ action?: string; expectedResult?: string }>;
  priority?: string;
}

export function parseAiResponse(raw: string): TestPoint[] {
  const jsonStr = extractJsonArray(raw);
  if (!jsonStr) {
    throw new Error('AI 响应中未找到有效的 JSON 数组');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('AI 响应的 JSON 格式不正确');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI 响应不是 JSON 数组');
  }

  return parsed.map((item: unknown, index: number) =>
    rawToTestPoint(item as RawTestPoint, index),
  );
}

export function extractJsonArray(text: string): string | null {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    if (content.startsWith('[')) {
      return content;
    }
  }

  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return text.substring(firstBracket, lastBracket + 1);
  }

  return null;
}

export function rawToTestPoint(raw: RawTestPoint, index: number): TestPoint {
  const steps: TestStep[] = (raw.steps || []).map((s) => ({
    action: s.action || '',
    expectedResult: s.expectedResult || '',
  }));

  if (steps.length === 0) {
    steps.push({ action: '', expectedResult: '' });
  }

  return {
    id: crypto.randomUUID(),
    title: raw.title || `测试点 ${index + 1}`,
    description: raw.description || '',
    precondition: raw.precondition || '',
    steps,
    priority: validatePriority(raw.priority),
  };
}

export function validatePriority(priority: string | undefined): string {
  if (priority && PRIORITY_NAMES.includes(priority as any)) {
    return priority;
  }
  return 'Major';
}
