import React from 'react';
import { Card, Input, Typography, Collapse, Alert, Tag } from 'antd';
import type { TestPoint } from '../types/test-case';
import type { TranslatedTestPoint } from '../services/test-case-translate';

const { Text } = Typography;
const { TextArea } = Input;

interface Props {
  testPoints: TestPoint[];
  translatedTestPoints: TranslatedTestPoint[];
  onUpdateTranslated: (index: number, updates: Partial<TranslatedTestPoint>) => void;
  translating: boolean;
}

const TestCaseTranslate: React.FC<Props> = ({
  testPoints,
  translatedTestPoints,
  onUpdateTranslated,
  translating,
}) => {
  if (translating) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Text>翻译中，请稍候...</Text>
      </div>
    );
  }

  if (translatedTestPoints.length === 0) {
    return null;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text strong>翻译预览</Text>
        <Text type="secondary" style={{ marginLeft: 8 }}>
          可直接编辑英文内容
        </Text>
        {translatedTestPoints.some((t) => t.hasUntranslated) && (
          <Alert
            type="warning"
            message="部分内容未能自动翻译，已标记为 [未翻译: ...]，请手动修改"
            style={{ marginTop: 8 }}
            showIcon
          />
        )}
      </div>

      <Collapse
        items={testPoints.map((tp, index) => {
          const translated = translatedTestPoints[index];
          if (!translated) return { key: tp.id, label: `#${index + 1}`, children: null };

          return {
            key: tp.id,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text strong>#{index + 1}</Text>
                <Text>{tp.title}</Text>
                <Text type="secondary">→</Text>
                <Text>{translated.titleEn}</Text>
                {translated.hasUntranslated && <Tag color="warning">有未翻译</Tag>}
              </div>
            ),
            children: (
              <div>
                {/* 标题翻译 */}
                <Card size="small" style={{ marginBottom: 12 }} title="标题">
                  <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>中文：</div>
                  <div style={{ marginBottom: 12, padding: '4px 8px', background: '#fafafa', borderRadius: 4 }}>
                    {tp.title}
                  </div>
                  <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>英文：</div>
                  <Input
                    value={translated.titleEn}
                    onChange={(e) => onUpdateTranslated(index, { titleEn: e.target.value })}
                  />
                </Card>

                {/* 描述翻译 */}
                <Card size="small" style={{ marginBottom: 12 }} title="描述 (Description)">
                  <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>中文：</div>
                  <div style={{ marginBottom: 12, padding: '4px 8px', background: '#fafafa', borderRadius: 4, whiteSpace: 'pre-wrap' }}>
                    {tp.description}
                  </div>
                  <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>英文：</div>
                  <TextArea
                    value={translated.descriptionEn}
                    onChange={(e) => onUpdateTranslated(index, { descriptionEn: e.target.value })}
                    rows={2}
                  />
                </Card>

                {/* 前置条件翻译 */}
                <Card size="small" style={{ marginBottom: 12 }} title="前置条件 (Preconditions)">
                  <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>中文：</div>
                  <div style={{ marginBottom: 12, padding: '4px 8px', background: '#fafafa', borderRadius: 4, whiteSpace: 'pre-wrap' }}>
                    {tp.precondition}
                  </div>
                  <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>英文：</div>
                  <TextArea
                    value={translated.preconditionEn}
                    onChange={(e) => onUpdateTranslated(index, { preconditionEn: e.target.value })}
                    rows={2}
                  />
                </Card>

                {/* 步骤翻译 */}
                <Card size="small" title="测试步骤 (Test Steps)">
                  {translated.stepsEn.map((stepEn, stepIdx) => (
                    <div key={stepIdx} style={{ marginBottom: stepIdx < translated.stepsEn.length - 1 ? 16 : 0 }}>
                      <Text strong style={{ display: 'block', marginBottom: 4 }}>
                        步骤 {stepIdx + 1}
                      </Text>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>操作 (Action)</Text>
                          <div style={{ marginBottom: 4, padding: '4px 8px', background: '#fafafa', borderRadius: 4, fontSize: 12 }}>
                            {tp.steps[stepIdx]?.action}
                          </div>
                          <Input
                            value={stepEn.actionEn}
                            onChange={(e) => {
                              const newSteps = [...translated.stepsEn];
                              newSteps[stepIdx] = { ...newSteps[stepIdx], actionEn: e.target.value };
                              onUpdateTranslated(index, { stepsEn: newSteps });
                            }}
                          />
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>预期结果 (Expected Result)</Text>
                          <div style={{ marginBottom: 4, padding: '4px 8px', background: '#fafafa', borderRadius: 4, fontSize: 12 }}>
                            {tp.steps[stepIdx]?.expectedResult}
                          </div>
                          <Input
                            value={stepEn.expectedResultEn}
                            onChange={(e) => {
                              const newSteps = [...translated.stepsEn];
                              newSteps[stepIdx] = { ...newSteps[stepIdx], expectedResultEn: e.target.value };
                              onUpdateTranslated(index, { stepsEn: newSteps });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            ),
          };
        })}
      />
    </div>
  );
};

export default TestCaseTranslate;
