interface TestCaseDescriptionData {
  descriptionEn: string;
  preconditionEn: string;
  stepsEn: Array<{ actionEn: string; expectedResultEn: string }>;
}

export function formatTestCaseDescription(tc: TestCaseDescriptionData): string {
  const lines: string[] = [
    'h2. Description',
    tc.descriptionEn,
    '',
    'h2. Preconditions',
    tc.preconditionEn,
    '',
    'h2. Test Steps',
    '||Step||Action||Expected Result||',
  ];

  tc.stepsEn.forEach((step, i) => {
    lines.push(`|${i + 1}|${step.actionEn}|${step.expectedResultEn}|`);
  });

  return lines.join('\n');
}
