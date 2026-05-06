import React, { useState, useEffect } from 'react';
import { Modal, Input, Form, message } from 'antd';
import type { DefectData } from '../types/defect';
import type { TemplateData, DefectTemplate } from '../types/template';
import { extractTemplateData } from '../types/template';

interface Props {
  open: boolean;
  onClose: () => void;
  currentDefect: DefectData;
  existingTemplates: DefectTemplate[];
  onSave: (template: Omit<DefectTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

const FIELD_LABELS: { key: keyof TemplateData; label: string }[] = [
  { key: 'summary', label: '标题' },
  { key: 'priority', label: '优先级' },
  { key: 'timestamp', label: '时间点' },
  { key: 'precondition', label: '前提条件' },
  { key: 'steps', label: '步骤' },
  { key: 'expectedResult', label: '预期结果' },
  { key: 'actualResult', label: '实际结果' },
  { key: 'reproduceRate', label: '复现率' },
  { key: 'recoverSteps', label: 'Recover步骤' },
];

const SaveTemplateModal: React.FC<Props> = ({
  open,
  onClose,
  currentDefect,
  existingTemplates,
  onSave,
}) => {
  const [form] = Form.useForm();
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const name = values.name.trim();

      // 检查重名
      if (existingTemplates.some(t => t.name === name)) {
        message.warning('模板名称已存在，请使用其他名称');
        return;
      }

      setConfirmLoading(true);
      onSave({
        name,
        data: extractTemplateData(currentDefect),
      });
      setConfirmLoading(false);
      onClose();
    } catch (err) {
      // 表单验证失败
    }
  };

  const templateData = extractTemplateData(currentDefect);
  const filledCount = FIELD_LABELS.filter(f => {
    const val = templateData[f.key];
    return typeof val === 'string' && val.trim() !== '';
  }).length;

  return (
    <Modal
      title="保存为模板"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      confirmLoading={confirmLoading}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        >
          <Input placeholder="例如：IVI 音频崩溃" maxLength={50} />
        </Form.Item>
      </Form>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 500, marginBottom: 8 }}>
          将保存以下字段值（已填写 {filledCount}/9 个）
        </div>
        <div
          style={{
            background: '#fafafa',
            padding: 12,
            borderRadius: 6,
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          {FIELD_LABELS.map(({ key, label }) => {
            const value = templateData[key];
            const displayValue =
              typeof value === 'string' && value.trim() !== ''
                ? value.length > 50
                  ? value.slice(0, 50) + '...'
                  : value
                : <span style={{ color: '#999' }}>(空)</span>;
            return (
              <div key={key} style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 500, marginRight: 8 }}>{label}:</span>
                <span>{displayValue}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

export default SaveTemplateModal;
