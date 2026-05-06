import React, { useState } from 'react';
import {
  Modal,
  List,
  Button,
  Space,
  Popconfirm,
  Form,
  Input,
  Select,
  Empty,
  message,
  Tag,
} from 'antd';
import { DeleteOutlined, EditOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { DefectTemplate, TemplateData, TemplateFieldKey } from '../types/template';
import { DEFAULT_PRIORITY_OPTIONS } from '../constants/priority';
import { REPRODUCE_RATE_OPTIONS } from '../constants/reproduce-rate';

interface Props {
  open: boolean;
  onClose: () => void;
  templates: DefectTemplate[];
  onTemplatesChange: (templates: DefectTemplate[]) => void;
  onApplyTemplate: (template: DefectTemplate) => void;
}

// 字段配置：key、标签、类型
const FIELD_CONFIG: { key: TemplateFieldKey; label: string; type: 'input' | 'select' | 'textarea'; rows?: number }[] = [
  { key: 'summary', label: '标题', type: 'input' },
  { key: 'priority', label: '优先级', type: 'select' },
  { key: 'timestamp', label: '时间点', type: 'input' },
  { key: 'precondition', label: '前提条件', type: 'textarea', rows: 2 },
  { key: 'steps', label: '步骤', type: 'textarea', rows: 3 },
  { key: 'expectedResult', label: '预期结果', type: 'textarea', rows: 2 },
  { key: 'actualResult', label: '实际结果', type: 'textarea', rows: 2 },
  { key: 'reproduceRate', label: '复现率', type: 'select' },
  { key: 'recoverSteps', label: 'Recover步骤', type: 'textarea', rows: 2 },
];

const TemplateManager: React.FC<Props> = ({
  open,
  onClose,
  templates,
  onTemplatesChange,
  onApplyTemplate,
}) => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DefectTemplate | null>(null);
  const [form] = Form.useForm();

  // 统计模板已填充字段数
  const countFilledFields = (data: TemplateData): number => {
    return FIELD_CONFIG.filter(f => {
      const val = data[f.key];
      return typeof val === 'string' && val.trim() !== '';
    }).length;
  };

  const handleEdit = (template: DefectTemplate) => {
    setEditingTemplate(template);
    form.setFieldsValue({
      name: template.name,
      ...template.data,
    });
    setEditModalOpen(true);
  };

  const handleAdd = () => {
    setEditingTemplate(null);
    form.resetFields();
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const name = values.name.trim();

      // 检查重名（排除当前编辑的模板）
      if (templates.some(t => t.name === name && t.id !== editingTemplate?.id)) {
        message.warning('模板名称已存在');
        return;
      }

      const templateData: TemplateData = {
        summary: values.summary || '',
        priority: values.priority || '',
        timestamp: values.timestamp || '',
        precondition: values.precondition || '',
        steps: values.steps || '',
        expectedResult: values.expectedResult || '',
        actualResult: values.actualResult || '',
        reproduceRate: values.reproduceRate || '',
        recoverSteps: values.recoverSteps || '',
      };

      let updated: DefectTemplate[];
      if (editingTemplate) {
        // 更新现有模板
        updated = templates.map(t =>
          t.id === editingTemplate.id
            ? { ...t, name, data: templateData, updatedAt: Date.now() }
            : t
        );
      } else {
        // 新建模板
        const newTemplate: DefectTemplate = {
          id: crypto.randomUUID(),
          name,
          data: templateData,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        updated = [...templates, newTemplate];
      }

      onTemplatesChange(updated);
      setEditModalOpen(false);
      message.success(editingTemplate ? '模板已更新' : '模板已创建');
    } catch {
      // 表单验证失败
    }
  };

  const handleDelete = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    onTemplatesChange(updated);
    message.success('模板已删除');
  };

  const handleApply = (template: DefectTemplate) => {
    onApplyTemplate(template);
    onClose();
  };

  return (
    <>
      <Modal
        title="模板管理"
        open={open}
        onCancel={onClose}
        footer={
          <Button type="primary" onClick={handleAdd}>
            新建模板
          </Button>
        }
        width={600}
      >
        {templates.length === 0 ? (
          <Empty description="暂无模板，点击下方按钮创建" style={{ padding: '24px 0' }} />
        ) : (
          <List
            dataSource={templates}
            renderItem={template => (
              <List.Item
                actions={[
                  <Button
                    key="apply"
                    type="link"
                    size="small"
                    icon={<ThunderboltOutlined />}
                    onClick={() => handleApply(template)}
                  >
                    应用
                  </Button>,
                  <Button
                    key="edit"
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(template)}
                  >
                    编辑
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title="确认删除该模板？"
                    onConfirm={() => handleDelete(template.id)}
                  >
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{template.name}</span>
                      <Tag color="blue">{countFilledFields(template.data)}/9 字段</Tag>
                    </Space>
                  }
                  description={(() => {
                    const preview = FIELD_CONFIG.slice(0, 3)
                      .filter(f => template.data[f.key]?.trim())
                      .map(f => `${f.label}: ${template.data[f.key]?.slice(0, 20)}${(template.data[f.key]?.length || 0) > 20 ? '...' : ''}`)
                      .join(' | ');
                    return preview || '无内容预览';
                  })()}
                />
              </List.Item>
            )}
          />
        )}
      </Modal>

      {/* 编辑/新建模板 Modal */}
      <Modal
        title={editingTemplate ? '编辑模板' : '新建模板'}
        open={editModalOpen}
        onOk={handleSave}
        onCancel={() => setEditModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="例如：IVI 音频崩溃" maxLength={50} />
          </Form.Item>

          <div style={{ marginBottom: 8, fontWeight: 500 }}>字段值（可选填写）</div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {FIELD_CONFIG.map(field => (
              <Form.Item key={field.key} name={field.key} label={field.label}>
                {field.type === 'select' ? (
                  <Select
                    placeholder={`选择${field.label}`}
                    allowClear
                    options={
                      field.key === 'priority'
                        ? DEFAULT_PRIORITY_OPTIONS
                        : REPRODUCE_RATE_OPTIONS
                    }
                  />
                ) : field.type === 'textarea' ? (
                  <Input.TextArea rows={field.rows || 2} placeholder={`输入${field.label}`} />
                ) : (
                  <Input placeholder={`输入${field.label}`} />
                )}
              </Form.Item>
            ))}
          </div>
        </Form>
      </Modal>
    </>
  );
};

export default TemplateManager;
