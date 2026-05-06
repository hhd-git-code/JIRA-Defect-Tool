export interface TestStep {
  action: string;
  expectedResult: string;
  actionEn?: string;
  expectedResultEn?: string;
}

export interface TestPoint {
  id: string;
  title: string;
  description: string;
  precondition: string;
  steps: TestStep[];
  priority: string;
  titleEn?: string;
  descriptionEn?: string;
  preconditionEn?: string;
  issueKey?: string;
  createError?: string;
}

export interface PrdSource {
  type: 'file' | 'url';
  fileName?: string;
  filePath?: string;
  url?: string;
  content?: string;
}
