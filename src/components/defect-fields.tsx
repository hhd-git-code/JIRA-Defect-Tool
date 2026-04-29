import React from 'react';
import { Input, Select, Form } from 'antd';
import { DEFAULT_PRIORITY_OPTIONS, type PriorityOption } from '../constants/priority';
import { REPRODUCE_RATE_OPTIONS } from '../constants/reproduce-rate';
import type { DefectData, ValidationError } from '../types/defect';

interface Props {
  value: DefectData;
  onChange: (defect: DefectData) => void;
  errors?: ValidationError[];
  disabled?: boolean;
  priorityOptions?: PriorityOption[];
}

const errorFields = (errors?: ValidationError[]) => {
  const set = new Set(errors?.map(e => e.field) ?? []);
  const labels = new Map(errors?.map(e => [e.field, e.label]) ?? []);
  return { set, labels };
};

type FieldType = 'input' | 'textarea' | 'select';

interface FieldConfig {
  key: keyof DefectData;
  label: string;
  type: FieldType;
  placeholder: string;
  rows?: number;
  optionsKey?: 'priority' | 'reproduceRate';
}

const FIELD_CONFIG: FieldConfig[] = [
  { key: 'summary', label: '标题', type: 'input', placeholder: '输入缺陷标题（中文）' },
  { key: 'priority', label: '优先级', type: 'select', placeholder: '选择优先级', optionsKey: 'priority' },
  { key: 'timestamp', label: '时间点', type: 'input', placeholder: '输入时间点（中文）' },
  { key: 'precondition', label: '前提条件', type: 'textarea', placeholder: '输入前提条件（中文）', rows: 2 },
  { key: 'steps', label: '步骤', type: 'textarea', placeholder: '输入复现步骤（中文）', rows: 3 },
  { key: 'expectedResult', label: '预期结果', type: 'textarea', placeholder: '输入预期结果（中文）', rows: 2 },
  { key: 'actualResult', label: '实际结果', type: 'textarea', placeholder: '输入实际结果（中文）', rows: 2 },
  { key: 'reproduceRate', label: '复现率', type: 'select', placeholder: '选择复现率', optionsKey: 'reproduceRate' },
  { key: 'recoverSteps', label: 'Recover步骤', type: 'textarea', placeholder: '输入恢复步骤（中文）', rows: 2 },
];

const DefectFields: React.FC<Props> = ({ value, onChange, errors, disabled, priorityOptions }) => {
  const err = errorFields(errors);
  const priorities = (priorityOptions && priorityOptions.length > 0) ? priorityOptions : DEFAULT_PRIORITY_OPTIONS;

  const optionsMap: Record<string, PriorityOption[]> = {
    priority: priorities,
    reproduceRate: REPRODUCE_RATE_OPTIONS,
  };

  const update = <K extends keyof DefectData>(field: K, val: DefectData[K]) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {FIELD_CONFIG.map(conf => {
        const fieldKey = conf.key;
        const hasError = err.set.has(fieldKey);
        const helpText = hasError ? `${err.labels.get(fieldKey)} 不能为空` : undefined;

        return (
          <Form.Item
            key={fieldKey}
            label={conf.label}
            validateStatus={hasError ? 'error' : undefined}
            help={helpText}
            style={{ marginBottom: 0 }}
          >
            {conf.type === 'select' ? (
              <Select
                placeholder={conf.placeholder}
                value={value[fieldKey] as string || undefined}
                onChange={v => update(fieldKey, v ?? '')}
                options={optionsMap[conf.optionsKey!]}
                disabled={disabled}
                allowClear
              />
            ) : conf.type === 'textarea' ? (
              <Input.TextArea
                rows={conf.rows}
                placeholder={conf.placeholder}
                value={value[fieldKey] as string}
                onChange={e => update(fieldKey, e.target.value)}
                disabled={disabled}
              />
            ) : (
              <Input
                placeholder={conf.placeholder}
                value={value[fieldKey] as string}
                onChange={e => update(fieldKey, e.target.value)}
                disabled={disabled}
              />
            )}
          </Form.Item>
        );
      })}
    </div>
  );
};

export default DefectFields;
