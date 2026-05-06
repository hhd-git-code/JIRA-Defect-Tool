import { translateField, buildOnlineConfig, hasChinese, type OnlineConfig } from './translate-engine';
import type { TranslateConfig } from '../types/config';
import type { TestPoint } from '../types/test-case';
import { dictService } from './dict-service';

export interface TranslatedTestPoint {
  titleEn: string;
  descriptionEn: string;
  preconditionEn: string;
  stepsEn: Array<{ actionEn: string; expectedResultEn: string }>;
  hasUntranslated: boolean;
}

async function translateTestPoint(
  testPoint: TestPoint,
  onlineConfig?: OnlineConfig,
): Promise<TranslatedTestPoint> {
  const titleResult = await translateField(testPoint.title, onlineConfig);
  const descriptionResult = await translateField(testPoint.description, onlineConfig);
  const preconditionResult = await translateField(testPoint.precondition, onlineConfig);

  const stepsEn: Array<{ actionEn: string; expectedResultEn: string }> = [];
  for (const step of testPoint.steps) {
    const actionResult = await translateField(step.action, onlineConfig);
    const expectedResult = await translateField(step.expectedResult, onlineConfig);
    stepsEn.push({ actionEn: actionResult.translated, expectedResultEn: expectedResult.translated });
  }

  return {
    titleEn: titleResult.translated,
    descriptionEn: descriptionResult.translated,
    preconditionEn: preconditionResult.translated,
    stepsEn,
    hasUntranslated: titleResult.hasUntranslated ||
      descriptionResult.hasUntranslated ||
      preconditionResult.hasUntranslated ||
      stepsEn.some(s => hasChinese(s.actionEn) || hasChinese(s.expectedResultEn)),
  };
}

export async function translateTestPoints(
  testPoints: TestPoint[],
  translateConfig: TranslateConfig,
): Promise<TranslatedTestPoint[]> {
  await dictService.loadAll().catch(() => {});
  const onlineConfig = buildOnlineConfig(translateConfig);

  const results: TranslatedTestPoint[] = [];
  for (const tp of testPoints) {
    const translated = await translateTestPoint(tp, onlineConfig);
    results.push(translated);
  }
  return results;
}
