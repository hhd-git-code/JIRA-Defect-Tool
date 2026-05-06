import type { DefectData } from './defect';

// 模板可包含的 9 个表单字段
export type TemplateFieldKey =
  | 'summary'
  | 'priority'
  | 'timestamp'
  | 'precondition'
  | 'steps'
  | 'expectedResult'
  | 'actualResult'
  | 'reproduceRate'
  | 'recoverSteps';

// 模板数据类型（只包含 9 个表单字段，不含 id 和附件）
export type TemplateData = Pick<DefectData, TemplateFieldKey>;

// 模板定义
export interface DefectTemplate {
  id: string;
  name: string;
  data: TemplateData;
  createdAt: number;
  updatedAt: number;
}

// 从 DefectData 提取模板数据
export function extractTemplateData(defect: DefectData): TemplateData {
  return {
    summary: defect.summary,
    priority: defect.priority,
    timestamp: defect.timestamp,
    precondition: defect.precondition,
    steps: defect.steps,
    expectedResult: defect.expectedResult,
    actualResult: defect.actualResult,
    reproduceRate: defect.reproduceRate,
    recoverSteps: defect.recoverSteps,
  };
}

// 应用模板数据到 DefectData（保留 id 和附件）
export function applyTemplateToDefect(
  defect: DefectData,
  templateData: TemplateData
): DefectData {
  return {
    ...defect,
    ...templateData,
  };
}

// 检查表单是否有内容（用于覆盖确认）
export function hasFormData(defect: DefectData): boolean {
  return (
    defect.summary.trim() !== '' ||
    defect.priority !== '' ||
    defect.timestamp.trim() !== '' ||
    defect.precondition.trim() !== '' ||
    defect.steps.trim() !== '' ||
    defect.expectedResult.trim() !== '' ||
    defect.actualResult.trim() !== '' ||
    defect.reproduceRate !== '' ||
    defect.recoverSteps.trim() !== ''
  );
}
