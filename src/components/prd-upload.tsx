import React, { useCallback, useRef, useState } from 'react';
import { Upload, Input, Divider, message } from 'antd';
import { InboxOutlined, LinkOutlined } from '@ant-design/icons';
import { parseDocument, parseDocumentFromBuffer, getSupportedFileExtensions } from '../services/document-parser';
import { fetchUrlContent, fetchConfluenceContent } from '../services/ai-service';
import { useTauriDragDrop } from '../hooks/use-tauri-drag-drop';
import type { PrdSource } from '../types/test-case';
import type { JiraConfig } from '../types/config';

const { Dragger } = Upload;

const ACCEPT_EXTENSIONS = getSupportedFileExtensions();
const ACCEPT_STRING = ACCEPT_EXTENSIONS.map(ext => `.${ext}`).join(',');

interface Props {
  onSourceReady: (source: PrdSource) => void;
  loading: boolean;
  jiraConfig?: JiraConfig;
}

const PrdUpload: React.FC<Props> = ({ onSourceReady, loading, jiraConfig }) => {
  const [url, setUrl] = useState('');
  const [parsing, setParsing] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const content = await parseDocumentFromBuffer(file.name, arrayBuffer);
      onSourceReady({
        type: 'file',
        fileName: file.name,
        content,
      });
    } catch (err) {
      message.error('解析文件失败: ' + (err as Error).message);
    } finally {
      setParsing(false);
    }
  }, [onSourceReady]);

  const handleFilePath = useCallback(async (filePath: string) => {
    setParsing(true);
    try {
      const content = await parseDocument(filePath);
      const fileName = filePath.split(/[\\/]/).pop() || filePath;
      onSourceReady({
        type: 'file',
        fileName,
        filePath,
        content,
      });
    } catch (err) {
      message.error('解析文件失败: ' + (err as Error).message);
    } finally {
      setParsing(false);
    }
  }, [onSourceReady]);

  const handleTauriDrop = useCallback(async (paths: string[]) => {
    if (loading || parsing) return;
    const validPaths = paths.filter(p => {
      const ext = '.' + (p.split('.').pop() || '').toLowerCase();
      return ACCEPT_STRING.includes(ext);
    });
    if (validPaths.length === 0) {
      message.warning(`不支持的文件格式，请使用 ${ACCEPT_STRING}`);
      return;
    }
    handleFilePath(validPaths[0]);
  }, [handleFilePath, loading, parsing]);

  useTauriDragDrop({ ref: dropRef, onDrop: handleTauriDrop, enabled: !loading && !parsing });

  const handleUrlFetch = useCallback(async () => {
    if (!url.trim()) {
      message.warning('请输入 URL');
      return;
    }
    setParsing(true);
    try {
      let content: string;
      if (jiraConfig?.serverUrl && jiraConfig?.username && jiraConfig?.apiToken) {
        content = await fetchConfluenceContent(url.trim(), jiraConfig);
      } else {
        content = await fetchUrlContent(url.trim());
      }
      onSourceReady({
        type: 'url',
        url: url.trim(),
        content,
      });
    } catch (err) {
      message.error('获取 URL 内容失败: ' + (err as Error).message);
    } finally {
      setParsing(false);
    }
  }, [url, onSourceReady, jiraConfig]);

  const isDisabled = loading || parsing;

  return (
    <div ref={dropRef}>
      <Dragger
        accept={ACCEPT_STRING}
        showUploadList={false}
        customRequest={() => {}}
        beforeUpload={(file) => {
          handleFile(file as File);
          return false;
        }}
        disabled={isDisabled}
        style={{ padding: '12px 8px' }}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">拖拽或点击上传 PRD 文档</p>
        <p className="ant-upload-hint">
          支持 {ACCEPT_EXTENSIONS.map(ext => `.${ext}`).join(' / ')}
        </p>
      </Dragger>
      {parsing && <div style={{ marginTop: 8, textAlign: 'center' }}>解析中...</div>}

      <Divider plain>或</Divider>

      <div style={{ fontWeight: 500, marginBottom: 8 }}>或通过 URL 获取</div>
      <Input.Search
        placeholder="输入 Confluence 等页面 URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onSearch={handleUrlFetch}
        enterButton={<><LinkOutlined /> 获取</>}
        disabled={isDisabled}
      />
    </div>
  );
};

export default PrdUpload;
