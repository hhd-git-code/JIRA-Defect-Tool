import React, { useState, useEffect } from 'react';
import { Modal, Input, Alert } from 'antd';
import type { DefectData, TranslatedDefect } from '../types/defect';

interface Props {
  open: boolean;
  defect: DefectData;
  translated: TranslatedDefect;
  onConfirm: (edited: TranslatedDefect) => void;
  onCancel: () => void;
}

const FIELD_PAIRS: { zhKey: keyof DefectData; enKey: keyof TranslatedDefect; label: string; multiline: boolean }[] = [
  { zhKey: 'summary', enKey: 'summaryEn', label: 'Summary', multiline: false },
  { zhKey: 'timestamp', enKey: 'timestampEn', label: 'Timestamp', multiline: false },
  { zhKey: 'precondition', enKey: 'preconditionEn', label: 'Precondition', multiline: true },
  { zhKey: 'steps', enKey: 'stepsEn', label: 'Steps', multiline: true },
  { zhKey: 'expectedResult', enKey: 'expectedResultEn', label: 'Expected Result', multiline: true },
  { zhKey: 'actualResult', enKey: 'actualResultEn', label: 'Actual Result', multiline: true },
  { zhKey: 'reproduceRate', enKey: 'reproduceRateEn', label: 'Reproduce Rate', multiline: false },
  { zhKey: 'recoverSteps', enKey: 'recoverStepsEn', label: 'Recover Steps', multiline: true },
];

const TranslatePreview: React.FC<Props> = ({ open, defect, translated, onConfirm, onCancel }) => {
  const [edited, setEdited] = useState<TranslatedDefect>(translated);
  const hasUntranslated = Object.values(edited).some(v =>
    typeof v === 'string' && v.includes('[未翻译:')
  );

  useEffect(() => {
    setEdited(translated);
  }, [translated]);

  return (
    <Modal
      title="翻译预览 - 确认后提交到 JIRA"
      open={open}
      onOk={() => onConfirm(edited)}
      onCancel={onCancel}
      width={800}
      okText="确认提交"
      cancelText="取消"
    >
      {hasUntranslated && (
        <Alert
          message="部分内容未翻译，请手动修改标记为 [未翻译: xxx] 的部分"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {FIELD_PAIRS.map(({ zhKey, enKey, label, multiline }) => {
        const zhValue = defect[zhKey] as string;
        const enValue = edited[enKey] as string;
        const isReadonly = enKey === 'reproduceRateEn';

        return (
          <div key={enKey} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: '#1890ff' }}>{label}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>中文原文</div>
                <Input.TextArea
                  value={zhValue}
                  readOnly
                  rows={multiline ? 3 : 1}
                  style={{ background: '#fafafa' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>英文翻译</div>
                {isReadonly ? (
                  <Input value={enValue} readOnly />
                ) : (
                  <Input.TextArea
                    value={enValue}
                    onChange={e => setEdited({ ...edited, [enKey]: e.target.value })}
                    rows={multiline ? 3 : 1}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </Modal>
  );
};

export default TranslatePreview;
