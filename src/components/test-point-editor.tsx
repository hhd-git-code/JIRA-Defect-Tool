import React from 'react';
import { Button, Card, Input, Select, Space, Typography, Popconfirm, Empty, Collapse } from 'antd';
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined, LoadingOutlined } from '@ant-design/icons';
import type { TestPoint, TestStep } from '../types/test-case';
import { PRIORITY_NAMES } from '../constants/priority';

const { Text } = Typography;
const { TextArea } = Input;

const PRIORITY_OPTIONS = PRIORITY_NAMES.map((name) => ({ value: name, label: name }));

interface Props {
  testPoints: TestPoint[];
  generating: boolean;
  onUpdatePoint: (id: string, updates: Partial<TestPoint>) => void;
  onRemovePoint: (id: string) => void;
  onAddPoint: () => void;
  onGenerate: () => void;
  hasPrdSource: boolean;
}

const TestPointEditor: React.FC<Props> = ({
  testPoints,
  generating,
  onUpdatePoint,
  onRemovePoint,
  onAddPoint,
  onGenerate,
  hasPrdSource,
}) => {
  if (testPoints.length === 0 && !generating) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        {hasPrdSource ? (
          <>
            <Empty description="PRD 已加载，点击下方按钮生成测试点" />
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              onClick={onGenerate}
              style={{ marginTop: 16 }}
            >
              生成测试点
            </Button>
          </>
        ) : (
          <Empty description="请先上传 PRD 文档或输入网页 URL" />
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text strong>测试点列表 ({testPoints.length} 条)</Text>
        <Space>
          {hasPrdSource && (
            <Button
              icon={<ThunderboltOutlined />}
              onClick={onGenerate}
              loading={generating}
            >
              重新生成
            </Button>
          )}
          <Button icon={<PlusOutlined />} onClick={onAddPoint}>
            添加测试点
          </Button>
        </Space>
      </div>

      <Collapse
        items={testPoints.map((tp, index) => ({
          key: tp.id,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong>#{index + 1}</Text>
              <Text>{tp.title || '未命名测试点'}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>({tp.steps.length} 步)</Text>
            </div>
          ),
          children: (
            <div>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>标题</Text>
                <Input
                  value={tp.title}
                  onChange={(e) => onUpdatePoint(tp.id, { title: e.target.value })}
                  placeholder="测试点标题"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>描述</Text>
                <TextArea
                  value={tp.description}
                  onChange={(e) => onUpdatePoint(tp.id, { description: e.target.value })}
                  placeholder="测试点描述：说明该测试点的目的和验证内容"
                  rows={2}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>前置条件</Text>
                <TextArea
                  value={tp.precondition}
                  onChange={(e) => onUpdatePoint(tp.id, { precondition: e.target.value })}
                  placeholder="执行该测试点需要的前置条件"
                  rows={2}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>优先级</Text>
                <Select
                  value={tp.priority}
                  onChange={(val) => onUpdatePoint(tp.id, { priority: val })}
                  options={PRIORITY_OPTIONS}
                  style={{ width: 150 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>测试步骤</Text>
                {tp.steps.map((step, stepIdx) => (
                  <Card
                    key={stepIdx}
                    size="small"
                    style={{ marginBottom: 8 }}
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text>步骤 {stepIdx + 1}</Text>
                        {tp.steps.length > 1 && (
                          <Popconfirm title="确认删除此步骤?" onConfirm={() => {
                            const newSteps = tp.steps.filter((_, i) => i !== stepIdx);
                            onUpdatePoint(tp.id, { steps: newSteps });
                          }}>
                            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                          </Popconfirm>
                        )}
                      </div>
                    }
                  >
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>操作</Text>
                      <TextArea
                        value={step.action}
                        onChange={(e) => {
                          const newSteps = [...tp.steps];
                          newSteps[stepIdx] = { ...newSteps[stepIdx], action: e.target.value };
                          onUpdatePoint(tp.id, { steps: newSteps });
                        }}
                        placeholder="操作步骤"
                        rows={1}
                      />
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>预期结果</Text>
                      <TextArea
                        value={step.expectedResult}
                        onChange={(e) => {
                          const newSteps = [...tp.steps];
                          newSteps[stepIdx] = { ...newSteps[stepIdx], expectedResult: e.target.value };
                          onUpdatePoint(tp.id, { steps: newSteps });
                        }}
                        placeholder="预期结果"
                        rows={1}
                      />
                    </div>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  block
                  onClick={() => {
                    const newSteps: TestStep[] = [...tp.steps, { action: '', expectedResult: '' }];
                    onUpdatePoint(tp.id, { steps: newSteps });
                  }}
                >
                  <PlusOutlined /> 添加步骤
                </Button>
              </div>

              <div style={{ textAlign: 'right' }}>
                <Popconfirm title="确认删除此测试点?" onConfirm={() => onRemovePoint(tp.id)}>
                  <Button danger icon={<DeleteOutlined />}>删除测试点</Button>
                </Popconfirm>
              </div>
            </div>
          ),
        }))}
      />

      {generating && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#999' }}>
          <LoadingOutlined style={{ marginRight: 8 }} />
          正在生成测试点...
          {testPoints.length > 0 && ` (已生成 ${testPoints.length} 条)`}
        </div>
      )}
    </div>
  );
};

export default TestPointEditor;
