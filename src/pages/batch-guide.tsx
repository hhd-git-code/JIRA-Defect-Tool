import React from 'react';
import { Button, Divider, Modal, Space, Typography } from 'antd';
import { LeftOutlined, RightOutlined, ThunderboltOutlined, StopOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import DefectFields from '../components/defect-fields';
import AttachmentUpload from '../components/attachment-upload';
import BatchProgress from '../components/batch-progress';
import { BatchResultPanel } from '../components/result-panel';
import { useBatchStore, isBatchCancelled } from '../stores/batch-store';
import { validateDefect } from '../services/validation';
import { translateDefect, buildOnlineConfig } from '../services/translate-engine';
import { formatDescription } from '../utils/format-description';
import * as jiraApi from '../services/jira-api';
import { loadConfig } from '../stores/config-store';
import type { PriorityOption } from '../constants/priority';
import type { JiraPriority } from '../services/jira-api';

const { Text } = Typography;

interface Props {
  onComplete: () => void;
  priorityOptions?: PriorityOption[];
  jiraPriorities?: JiraPriority[];
}

const BatchGuide: React.FC<Props> = ({ onComplete, priorityOptions, jiraPriorities }) => {
  const { state, setCurrentIndex, updateItem, addResult, setSubmitting, cancelSubmit, removeSuccessItems } = useBatchStore();
  const { items, currentIndex, results, isSubmitting, currentSubmitIndex, cancelled, originalItems } = state;
  const current = items[currentIndex];

  const allDone = results.length >= originalItems.length && originalItems.length > 0;

  // 全部完成或被取消后，展示结果面板
  if (results.length > 0 && !isSubmitting && (cancelled || allDone)) {
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return (
      <div>
        <BatchResultPanel
          results={results}
          total={results.length}
        />
        {cancelled && (
          <div style={{ marginTop: 12, textAlign: 'center', color: '#faad14' }}>
            已取消，剩余 {originalItems.length - results.length} 条未提交
          </div>
        )}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Space>
            {failCount > 0 && (
              <Button type="primary" onClick={() => removeSuccessItems()}>
                修改并重试失败项
              </Button>
            )}
            <Button onClick={onComplete}>
              {successCount === results.length ? '完成，返回主页' : '放弃失败项，返回主页'}
            </Button>
          </Space>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const handlePrev = () => currentIndex > 0 && setCurrentIndex(currentIndex - 1);
  const handleNext = () => currentIndex < items.length - 1 && setCurrentIndex(currentIndex + 1);

  const handleBatchCreate = () => {
    Modal.confirm({
      title: `确认批量创建 ${items.length} 条缺陷？`,
      content: '将逐条翻译并提交到 JIRA',
      onOk: doBatchCreate,
    });
  };

  const doBatchCreate = async () => {
    setSubmitting(true);
    const config = await loadConfig();

    for (let i = 0; i < items.length; i++) {
      if (isBatchCancelled()) break;
      const item = items[i];
      try {
        const errors = validateDefect(item);
        if (errors.length > 0) {
          addResult({ id: item.id, success: false, error: `校验失败: ${errors.map(e => e.label).join('、')} 未填写` });
          continue;
        }

        const translated = await translateDefect(item, buildOnlineConfig(config.translate));

        if (isBatchCancelled()) break;

        const description = formatDescription(translated);
        let priorityValue = item.priority as string;
        if (priorityValue && !/^\d+$/.test(priorityValue) && jiraPriorities) {
          const found = jiraPriorities.find(p => p.name === priorityValue);
          if (found) priorityValue = found.id;
        }
        const resp = await jiraApi.createIssue(config.jira, translated.summaryEn, description, priorityValue);

        const allPaths = [...item.mediaFiles, ...item.traceFiles].map(f => f.path);
        if (allPaths.length > 0) {
          try {
            await jiraApi.uploadAttachments(config.jira, resp.key, allPaths);
          } catch (attachErr: unknown) {
            addResult({ id: item.id, success: true, issueKey: resp.key + ' (附件上传失败: ' + (attachErr instanceof Error ? attachErr.message : String(attachErr)) + ')' });
            continue;
          }
        }

        addResult({ id: item.id, success: true, issueKey: resp.key });
      } catch (err: unknown) {
        addResult({ id: item.id, success: false, error: (err instanceof Error ? err.message : String(err)) || '创建失败' });
      }
    }

    setSubmitting(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text strong>第 {currentIndex + 1} 条 / 共 {items.length} 条</Text>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onComplete} disabled={isSubmitting}>
            退出批量
          </Button>
          <Button icon={<LeftOutlined />} disabled={currentIndex === 0 || isSubmitting} onClick={handlePrev}>上一条</Button>
          <Button icon={<RightOutlined />} disabled={currentIndex === items.length - 1 || isSubmitting} onClick={handleNext}>下一条</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 2 }}>
          <DefectFields
            value={current}
            onChange={updated => updateItem(currentIndex, updated)}
            disabled={isSubmitting}
            priorityOptions={priorityOptions}
          />
        </div>
        <div style={{ flex: 1 }}>
          <AttachmentUpload defect={current} onChange={updated => updateItem(currentIndex, updated)} disabled={isSubmitting} />
        </div>
      </div>

      <Divider />

      <div style={{ textAlign: 'center' }}>
        <Space size="middle">
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            size="large"
            onClick={handleBatchCreate}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            批量创建 ({items.length} 条)
          </Button>
          {isSubmitting && (
            <Button
              danger
              icon={<StopOutlined />}
              size="large"
              onClick={cancelSubmit}
            >
              取消创建
            </Button>
          )}
        </Space>
      </div>

      {isSubmitting && (
        <BatchProgress
          total={items.length}
          currentSubmitIndex={currentSubmitIndex}
          results={results}
          isSubmitting={isSubmitting}
          cancelled={cancelled}
        />
      )}

      {!isSubmitting && results.length > 0 && results.length < items.length && (
        <BatchResultPanel
          results={results}
          total={results.length}
        />
      )}
    </div>
  );
};

export default BatchGuide;
