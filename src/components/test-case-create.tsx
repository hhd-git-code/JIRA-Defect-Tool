import React from 'react';
import { Button, Progress, Typography, List, Tag, Space, Popconfirm, Tooltip } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LinkOutlined, WarningOutlined } from '@ant-design/icons';
import type { CreateResult } from '../stores/prd-store';

const { Text, Link } = Typography;

interface Props {
  total: number;
  completed: number;
  creating: boolean;
  results: CreateResult[];
  serverUrl?: string;
  onCancel: () => void;
  onRetryFailed: () => void;
}

const TestCaseCreate: React.FC<Props> = ({
  total,
  completed,
  creating,
  results,
  serverUrl,
  onCancel,
  onRetryFailed,
}) => {
  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* 进度 */}
      <div style={{ marginBottom: 24 }}>
        <Progress percent={progressPercent} status={creating ? 'active' : undefined} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <Text>已完成 {completed} / {total}</Text>
          {successCount > 0 && <Text type="success">成功 {successCount}</Text>}
          {failedCount > 0 && <Text type="danger">失败 {failedCount}</Text>}
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        {creating && (
          <Popconfirm title="确认取消创建？" onConfirm={onCancel}>
            <Button>取消</Button>
          </Popconfirm>
        )}
        {!creating && failedCount > 0 && (
          <Button type="primary" onClick={onRetryFailed}>
            重试失败项
          </Button>
        )}
      </div>

      {/* 结果列表 */}
      {results.length > 0 && (
        <List
          dataSource={results}
          renderItem={(item) => (
            <List.Item>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                {item.success ? (
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                ) : (
                  <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                )}
                <Text style={{ flex: 1 }}>{item.title || item.id}</Text>
                {item.success && item.issueKey && (
                  <Space>
                    <Tag color="success">{item.issueKey}</Tag>
                    {item.preconditionKeys && item.preconditionKeys.length > 0 && (
                      item.preconditionKeys.map((pk) => (
                        <Tag color="blue" key={pk}>前置条件: {pk}</Tag>
                      ))
                    )}
                    {item.warnings && item.warnings.length > 0 && (
                      <Tooltip title={item.warnings.join('; ')}>
                        <WarningOutlined style={{ color: '#faad14', fontSize: 16 }} />
                      </Tooltip>
                    )}
                    {serverUrl && (
                      <Link
                        href={`${serverUrl}/browse/${item.issueKey}`}
                        target="_blank"
                        style={{ fontSize: 12 }}
                      >
                        <LinkOutlined /> 在 JIRA 中查看
                      </Link>
                    )}
                  </Space>
                )}
                {!item.success && item.error && (
                  <Text type="danger" style={{ fontSize: 12 }}>{item.error}</Text>
                )}
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );
};

export default TestCaseCreate;
