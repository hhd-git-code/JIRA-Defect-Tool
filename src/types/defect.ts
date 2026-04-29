export type Priority = string;

export type ReproduceRate = 'Always' | 'Often' | 'Sometimes' | 'Rarely' | 'Unable to Reproduce';

export interface AttachmentFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'media' | 'trace';
}

export interface DefectData {
  id: string;
  summary: string;
  priority: Priority | '';
  timestamp: string;
  precondition: string;
  steps: string;
  expectedResult: string;
  actualResult: string;
  reproduceRate: ReproduceRate | '';
  recoverSteps: string;
  mediaFiles: AttachmentFile[];
  traceFiles: AttachmentFile[];
}

export interface TranslatedDefect {
  summaryEn: string;
  timestampEn: string;
  preconditionEn: string;
  stepsEn: string;
  expectedResultEn: string;
  actualResultEn: string;
  reproduceRateEn: string;
  recoverStepsEn: string;
  translateErrors?: string[];
}

export interface ValidationError {
  field: keyof DefectData;
  label: string;
}

export interface BatchItemResult {
  id: string;
  success: boolean;
  issueKey?: string;
  error?: string;
}

export function createEmptyDefect(): DefectData {
  return {
    id: crypto.randomUUID(),
    summary: '',
    priority: '',
    timestamp: '',
    precondition: '',
    steps: '',
    expectedResult: '',
    actualResult: '',
    reproduceRate: '',
    recoverSteps: '',
    mediaFiles: [],
    traceFiles: [],
  };
}
