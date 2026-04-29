import React from 'react';
import { Progress, Timeline, Tag } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import type { BatchItemResult } from '../types/defect';

interface Props {
  total: number;
  currentSubmitIndex: number;
  results: BatchItemResult[];
  isSubmitting: boolean;
  cancelled?: boolean;
}

const BatchProgress: React.FC<Props> = ({ total, currentSubmitIndex, results, isSubmitting, cancelled }) => {
  const percent = total > 0 ? Math.round((currentSubmitIndex / total) * 100) : 0;
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <div style={{ padding: '16px 0' }}>
      <Progress percent={percent} status={isSubmitting ? 'active' : cancelled ? 'exception' : undefined} />

      <div style={{ marginTop: 8 }}>
        <Tag color="success">成功 {successCount}</Tag>
        <Tag color="error">失败 {failCount}</Tag>
        <Tag>总计 {total}</Tag>
      </div>

      <Timeline
        style={{ marginTop: 16 }}
        items={results.map((r, i) => ({
          color: r.success ? 'green' : 'red',
          dot: isSubmitting && i === results.length - 1 && !r.success
            ? <LoadingOutlined />
            : undefined,
          children: r.success
            ? <span style={{ color: '#52c41a' }}>{r.issueKey} 创建成功</span>
            : <span style={{ color: '#ff4d4f' }}>第 {i + 1} 条失败: {r.error}</span>,
        }))}
      />
    </div>
  );
};

export default BatchProgress;
