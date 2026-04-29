import React, { useCallback, useRef, useState } from 'react';
import { Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { parseFile, parseFilePath, type ParseResult } from '../services/table-parser';
import { useTauriDragDrop } from '../hooks/use-tauri-drag-drop';

const { Dragger } = Upload;

const TABLE_EXTENSIONS = ['.xlsx', '.csv'];

interface Props {
  onImport: (result: ParseResult) => void;
  disabled?: boolean;
}

const ImportUpload: React.FC<Props> = ({ onImport, disabled }) => {
  const [parsing, setParsing] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    try {
      const result = await parseFile(file);
      if (result.totalRows === 0) {
        message.warning('表格中没有数据');
        return;
      }
      if (result.unmappedColumns.length > 0) {
        message.info(`以下列未能自动识别：${result.unmappedColumns.join('、')}`);
      }
      onImport(result);
    } catch (err) {
      message.error('解析表格失败: ' + (err as Error).message);
    } finally {
      setParsing(false);
    }
  }, [onImport]);

  const handleTauriDrop = useCallback(async (paths: string[]) => {
    if (disabled || parsing) return;
    const validPaths = paths.filter(p => {
      const ext = '.' + (p.split('.').pop() || '').toLowerCase();
      return TABLE_EXTENSIONS.includes(ext);
    });
    if (validPaths.length === 0) {
      message.warning('不支持的文件格式，请使用 .xlsx 或 .csv');
      return;
    }
    setParsing(true);
    try {
      const result = await parseFilePath(validPaths[0]);
      if (result.totalRows === 0) {
        message.warning('表格中没有数据');
        return;
      }
      if (result.unmappedColumns.length > 0) {
        message.info(`以下列未能自动识别：${result.unmappedColumns.join('、')}`);
      }
      onImport(result);
    } catch (err) {
      message.error('解析表格失败: ' + (err as Error).message);
    } finally {
      setParsing(false);
    }
  }, [onImport, disabled, parsing]);

  useTauriDragDrop({ ref: dropRef, onDrop: handleTauriDrop, enabled: !disabled && !parsing });

  return (
    <div>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>表格导入</div>
      <div ref={dropRef}>
        <Dragger
          accept=".xlsx,.csv"
          showUploadList={false}
          customRequest={() => {}}
          beforeUpload={(file) => {
            handleFile(file as File);
            return false;
          }}
          disabled={disabled || parsing}
          style={{ padding: '12px 8px' }}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽上传Excel/CSV</p>
          <p className="ant-upload-hint">支持 .xlsx / .csv</p>
        </Dragger>
      </div>
      {parsing && <div style={{ marginTop: 8, textAlign: 'center' }}>解析中...</div>}
    </div>
  );
};

export default ImportUpload;
