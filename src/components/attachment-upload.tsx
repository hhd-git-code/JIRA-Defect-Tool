import React, { useCallback, useRef, useState } from 'react';
import { message } from 'antd';
import { InboxOutlined, DeleteOutlined } from '@ant-design/icons';
import type { DefectData, AttachmentFile } from '../types/defect';
import { isValidMediaFile, isValidTraceFile } from '../utils/file-helper';
import { open } from '@tauri-apps/plugin-dialog';
import { useTauriDragDrop } from '../hooks/use-tauri-drag-drop';

interface Props {
  defect: DefectData;
  onChange: (defect: DefectData) => void;
  disabled?: boolean;
}

type FileCategory = 'media' | 'trace';

const CONFIGS: Record<FileCategory, {
  label: string;
  hint: string;
  extensions: string[];
  isValid: (name: string) => boolean;
  getFiles: (d: DefectData) => AttachmentFile[];
  setFiles: (d: DefectData, files: AttachmentFile[]) => DefectData;
}> = {
  media: {
    label: '图片/视频',
    hint: '支持 png/jpg/mp4/mov',
    extensions: ['png', 'jpg', 'jpeg', 'mp4', 'mov'],
    isValid: isValidMediaFile,
    getFiles: (d) => d.mediaFiles,
    setFiles: (d, files) => ({ ...d, mediaFiles: files }),
  },
  trace: {
    label: 'Trace文件',
    hint: '支持 txt/log/zip',
    extensions: ['txt', 'log', 'zip'],
    isValid: isValidTraceFile,
    getFiles: (d) => d.traceFiles,
    setFiles: (d, files) => ({ ...d, traceFiles: files }),
  },
};

const dropZoneStyle: React.CSSProperties = {
  border: '1px dashed #d9d9d9',
  borderRadius: 8,
  padding: '16px 8px',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.3s, background-color 0.3s',
  userSelect: 'none',
};

const dropZoneActiveStyle: React.CSSProperties = {
  borderColor: '#1890ff',
  backgroundColor: '#e6f7ff',
};

function extractFileName(path: string): string {
  return path.split('/').pop() || path.split('\\').pop() || 'file';
}

function buildAttachment(path: string, type: FileCategory): AttachmentFile {
  return {
    id: crypto.randomUUID(),
    name: extractFileName(path),
    path,
    size: 0,
    type,
  };
}

const AttachmentUpload: React.FC<Props> = ({ defect, onChange, disabled }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DropZone category="media" defect={defect} onChange={onChange} disabled={disabled} />
      <DropZone category="trace" defect={defect} onChange={onChange} disabled={disabled} />
    </div>
  );
};

interface DropZoneProps {
  category: FileCategory;
  defect: DefectData;
  onChange: (defect: DefectData) => void;
  disabled?: boolean;
}

const DropZone: React.FC<DropZoneProps> = ({ category, defect, onChange, disabled }) => {
  const cfg = CONFIGS[category];
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);
  const dropRef = useRef<HTMLDivElement>(null);

  const addFiles = useCallback((paths: string[]) => {
    const validFiles: AttachmentFile[] = [];
    const invalidNames: string[] = [];
    for (const p of paths) {
      const name = extractFileName(p);
      if (cfg.isValid(name)) {
        validFiles.push(buildAttachment(p, category));
      } else {
        invalidNames.push(name);
      }
    }
    if (invalidNames.length > 0) message.warning(`不支持的文件格式: ${invalidNames.join(', ')}`);
    if (validFiles.length > 0) {
      onChange(cfg.setFiles(defect, [...cfg.getFiles(defect), ...validFiles]));
    }
  }, [defect, onChange, disabled, cfg, category]);

  const pickFiles = useCallback(async () => {
    if (disabled) return;
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: cfg.label, extensions: cfg.extensions }],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      addFiles(paths);
    } catch {
      message.error('选择文件失败');
    }
  }, [addFiles, disabled, cfg]);

  const handleTauriDrop = useCallback((paths: string[]) => {
    if (disabled) return;
    addFiles(paths);
  }, [addFiles, disabled]);

  useTauriDragDrop({ ref: dropRef, onDrop: handleTauriDrop, enabled: !disabled });

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragOver(false);
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const validFiles: AttachmentFile[] = [];
    const invalidNames: string[] = [];

    for (const file of files) {
      if (!file.path) {
        message.warning(`无法获取文件路径: ${file.name}`);
        continue;
      }
      if (cfg.isValid(file.name)) {
        validFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          path: file.path,
          size: file.size,
          type: category,
        });
      } else {
        invalidNames.push(file.name);
      }
    }

    if (invalidNames.length > 0) message.warning(`不支持的文件格式: ${invalidNames.join(', ')}`);
    if (validFiles.length > 0) {
      onChange(cfg.setFiles(defect, [...cfg.getFiles(defect), ...validFiles]));
    }
  }, [defect, onChange, disabled, cfg, category]);

  const removeFile = useCallback((id: string) => {
    onChange(cfg.setFiles(defect, cfg.getFiles(defect).filter(f => f.id !== id)));
  }, [defect, onChange, cfg]);

  const files = cfg.getFiles(defect);

  return (
    <div>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>{cfg.label}</div>
      <div
        ref={dropRef}
        style={{
          ...dropZoneStyle,
          ...(dragOver ? dropZoneActiveStyle : {}),
          opacity: disabled ? 0.5 : 1,
        }}
        onClick={pickFiles}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounter.current++;
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounter.current--;
          if (dragCounter.current === 0) setDragOver(false);
        }}
        onDrop={handleDrop}
      >
        <InboxOutlined style={{ fontSize: 32, color: '#1890ff' }} />
        <div style={{ marginTop: 8, color: '#666' }}>点击或拖拽上传{cfg.label}</div>
        <div style={{ fontSize: 12, color: '#999' }}>{cfg.hint}</div>
      </div>
      {files.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {files.map(f => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <DeleteOutlined onClick={() => removeFile(f.id)} style={{ color: '#ff4d4f', cursor: 'pointer' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttachmentUpload;
