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

const AttachmentUpload: React.FC<Props> = ({ defect, onChange, disabled }) => {
  const [mediaDragOver, setMediaDragOver] = useState(false);
  const [traceDragOver, setTraceDragOver] = useState(false);
  const mediaDragCounter = useRef(0);
  const traceDragCounter = useRef(0);
  const mediaDropRef = useRef<HTMLDivElement>(null);
  const traceDropRef = useRef<HTMLDivElement>(null);

  const pickMediaFiles = useCallback(async () => {
    if (disabled) return;
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Media', extensions: ['png', 'jpg', 'jpeg', 'mp4', 'mov'] }],
      });
      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      const newFiles: AttachmentFile[] = paths
        .filter(p => isValidMediaFile(p.split('/').pop() || p.split('\\').pop() || ''))
        .map(p => ({
          id: crypto.randomUUID(),
          name: p.split('/').pop() || p.split('\\').pop() || 'file',
          path: p,
          size: 0,
          type: 'media' as const,
        }));

      if (newFiles.length > 0) {
        onChange({ ...defect, mediaFiles: [...defect.mediaFiles, ...newFiles] });
      }
    } catch {
      message.error('选择文件失败');
    }
  }, [defect, onChange, disabled]);

  const pickTraceFiles = useCallback(async () => {
    if (disabled) return;
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Trace', extensions: ['txt', 'log', 'zip'] }],
      });
      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      const newFiles: AttachmentFile[] = paths
        .filter(p => isValidTraceFile(p.split('/').pop() || p.split('\\').pop() || ''))
        .map(p => ({
          id: crypto.randomUUID(),
          name: p.split('/').pop() || p.split('\\').pop() || 'file',
          path: p,
          size: 0,
          type: 'trace' as const,
        }));

      if (newFiles.length > 0) {
        onChange({ ...defect, traceFiles: [...defect.traceFiles, ...newFiles] });
      }
    } catch {
      message.error('选择文件失败');
    }
  }, [defect, onChange, disabled]);

  const handleTauriMediaDrop = useCallback((paths: string[]) => {
    if (disabled) return;
    const validFiles: AttachmentFile[] = [];
    const invalidNames: string[] = [];
    for (const p of paths) {
      const name = p.split('/').pop() || p.split('\\').pop() || '';
      if (isValidMediaFile(name)) {
        validFiles.push({ id: crypto.randomUUID(), name, path: p, size: 0, type: 'media' });
      } else {
        invalidNames.push(name);
      }
    }
    if (invalidNames.length > 0) message.warning(`不支持的文件格式: ${invalidNames.join(', ')}`);
    if (validFiles.length > 0) onChange({ ...defect, mediaFiles: [...defect.mediaFiles, ...validFiles] });
  }, [defect, onChange, disabled]);

  const handleTauriTraceDrop = useCallback((paths: string[]) => {
    if (disabled) return;
    const validFiles: AttachmentFile[] = [];
    const invalidNames: string[] = [];
    for (const p of paths) {
      const name = p.split('/').pop() || p.split('\\').pop() || '';
      if (isValidTraceFile(name)) {
        validFiles.push({ id: crypto.randomUUID(), name, path: p, size: 0, type: 'trace' });
      } else {
        invalidNames.push(name);
      }
    }
    if (invalidNames.length > 0) message.warning(`不支持的文件格式: ${invalidNames.join(', ')}`);
    if (validFiles.length > 0) onChange({ ...defect, traceFiles: [...defect.traceFiles, ...validFiles] });
  }, [defect, onChange, disabled]);

  useTauriDragDrop({ ref: mediaDropRef, onDrop: handleTauriMediaDrop, enabled: !disabled });
  useTauriDragDrop({ ref: traceDropRef, onDrop: handleTauriTraceDrop, enabled: !disabled });

  const removeMedia = (id: string) => {
    onChange({ ...defect, mediaFiles: defect.mediaFiles.filter(f => f.id !== id) });
  };

  const removeTrace = (id: string) => {
    onChange({ ...defect, traceFiles: defect.traceFiles.filter(f => f.id !== id) });
  };

  const handleMediaDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    mediaDragCounter.current = 0;
    setMediaDragOver(false);
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const validFiles: AttachmentFile[] = [];
    const invalidNames: string[] = [];

    for (const file of files) {
      if (!file.path) {
        message.warning(`无法获取文件路径: ${file.name}`);
        continue;
      }
      if (isValidMediaFile(file.name)) {
        validFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          path: file.path,
          size: file.size,
          type: 'media' as const,
        });
      } else {
        invalidNames.push(file.name);
      }
    }

    if (invalidNames.length > 0) {
      message.warning(`不支持的文件格式: ${invalidNames.join(', ')}`);
    }
    if (validFiles.length > 0) {
      onChange({ ...defect, mediaFiles: [...defect.mediaFiles, ...validFiles] });
    }
  }, [defect, onChange, disabled]);

  const handleTraceDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    traceDragCounter.current = 0;
    setTraceDragOver(false);
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const validFiles: AttachmentFile[] = [];
    const invalidNames: string[] = [];

    for (const file of files) {
      if (!file.path) {
        message.warning(`无法获取文件路径: ${file.name}`);
        continue;
      }
      if (isValidTraceFile(file.name)) {
        validFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          path: file.path,
          size: file.size,
          type: 'trace' as const,
        });
      } else {
        invalidNames.push(file.name);
      }
    }

    if (invalidNames.length > 0) {
      message.warning(`不支持的文件格式: ${invalidNames.join(', ')}`);
    }
    if (validFiles.length > 0) {
      onChange({ ...defect, traceFiles: [...defect.traceFiles, ...validFiles] });
    }
  }, [defect, onChange, disabled]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>图片/视频</div>
        <div
          ref={mediaDropRef}
          style={{
            ...dropZoneStyle,
            ...(mediaDragOver ? dropZoneActiveStyle : {}),
            opacity: disabled ? 0.5 : 1,
          }}
          onClick={pickMediaFiles}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            mediaDragCounter.current++;
            setMediaDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            mediaDragCounter.current--;
            if (mediaDragCounter.current === 0) setMediaDragOver(false);
          }}
          onDrop={handleMediaDrop}
        >
          <InboxOutlined style={{ fontSize: 32, color: '#1890ff' }} />
          <div style={{ marginTop: 8, color: '#666' }}>点击或拖拽上传图片/视频</div>
          <div style={{ fontSize: 12, color: '#999' }}>支持 png/jpg/mp4/mov</div>
        </div>
        {defect.mediaFiles.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {defect.mediaFiles.map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <DeleteOutlined onClick={() => removeMedia(f.id)} style={{ color: '#ff4d4f', cursor: 'pointer' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>Trace文件</div>
        <div
          ref={traceDropRef}
          style={{
            ...dropZoneStyle,
            ...(traceDragOver ? dropZoneActiveStyle : {}),
            opacity: disabled ? 0.5 : 1,
          }}
          onClick={pickTraceFiles}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            traceDragCounter.current++;
            setTraceDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            traceDragCounter.current--;
            if (traceDragCounter.current === 0) setTraceDragOver(false);
          }}
          onDrop={handleTraceDrop}
        >
          <InboxOutlined style={{ fontSize: 32, color: '#1890ff' }} />
          <div style={{ marginTop: 8, color: '#666' }}>点击或拖拽上传Trace文件</div>
          <div style={{ fontSize: 12, color: '#999' }}>支持 txt/log/zip</div>
        </div>
        {defect.traceFiles.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {defect.traceFiles.map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <DeleteOutlined onClick={() => removeTrace(f.id)} style={{ color: '#ff4d4f', cursor: 'pointer' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttachmentUpload;
