import React from 'react';
import { Card, Tag, Typography, Space, Button } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LinkOutlined, RedoOutlined } from '@ant-design/icons';
import type { BatchItemResult } from '../types/defect';

const { Text } = Typography;

interface SingleResultProps {
  success: boolean;
  issueKey?: string;
  error?: string;
  serverUrl?: string;
}

export const SingleResult: React.FC<SingleResultProps> = ({ success, issueKey, error, serverUrl }) => {
  if (success && issueKey) {
    const jiraUrl = serverUrl ? `${serverUrl}/browse/${issueKey}` : undefined;
    return (
      <Space>
        <Tag icon={<CheckCircleOutlined />} color="success">创建成功</Tag>
        <Text strong>{issueKey}</Text>
        {jiraUrl && (
          <a href={jiraUrl} target="_blank" rel="noopener noreferrer">
            <LinkOutlined /> 在JIRA中查看
          </a>
        )}
      </Space>
    );
  }

  return (
    <Space>
      <Tag icon={<CloseCircleOutlined />} color="error">创建失败</Tag>
      <Text type="danger">{error || '未知错误'}</Text>
    </Space>
  );
};

interface BatchResultProps {
  results: BatchItemResult[];
  total: number;
  serverUrl?: string;
  onRetryFailed?: () => void;
}

export const BatchResultPanel: React.FC<BatchResultProps> = ({ results, total, serverUrl, onRetryFailed }) => {
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <Card title={`批量创建结果 (${successCount}/${total} 成功)`} size="small">
      <div style={{ marginBottom: 8 }}>
        <Tag color="success">成功 {successCount}</Tag>
        {failCount > 0 && <Tag color="error">失败 {failCount}</Tag>}
      </div>

      {results.map((r, i) => (
        <div key={r.id} style={{ padding: '4px 0', borderBottom: i < results.length - 1 ? '1px solid #f0f0f0' : undefined }}>
          <SingleResult success={r.success} issueKey={r.issueKey} error={r.error} serverUrl={serverUrl} />
        </div>
      ))}

      {failCount > 0 && onRetryFailed && (
        <div style={{ marginTop: 12 }}>
          <Button icon={<RedoOutlined />} onClick={onRetryFailed}>重试失败项</Button>
        </div>
      )}
    </Card>
  );
};
