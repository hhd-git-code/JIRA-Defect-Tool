import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Layout, Button, message, Divider, Modal, Typography, Select } from 'antd';
import { SettingOutlined, ThunderboltOutlined, SaveOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import DefectFields from '../components/defect-fields';
import AttachmentUpload from '../components/attachment-upload';
import ImportUpload from '../components/import-upload';
import TranslatePreview from '../components/translate-preview';
import SaveTemplateModal from '../components/save-template-modal';
import TemplateManager from '../components/template-manager';
import { SingleResult } from '../components/result-panel';
import BatchGuide from '../pages/batch-guide';
import { useDefectStore } from '../stores/defect-store';
import { useBatchStore } from '../stores/batch-store';
import { validateDefect } from '../services/validation';
import { translateDefect, resetOnlineState, isOnlineConfigValid } from '../services/translate-engine';
import { dictService } from '../services/dict-service';
import { formatDescription } from '../utils/format-description';
import * as jiraApi from '../services/jira-api';
import { loadConfig, loadDraft, saveDraft, clearDraft, loadTemplates, saveTemplates } from '../stores/config-store';
import { buildPriorityOptions, type PriorityOption } from '../constants/priority';
import type { JiraPriority } from '../services/jira-api';
import type { DefectData, TranslatedDefect, ValidationError } from '../types/defect';
import type { ParseResult } from '../services/table-parser';
import type { AppConfig } from '../types/config';
import type { DefectTemplate, TemplateData } from '../types/template';
import { applyTemplateToDefect, hasFormData } from '../types/template';

const { Header, Content } = Layout;
const { Text } = Typography;

const DefectForm: React.FC = () => {
  const navigate = useNavigate();
  const { currentDefect, setCurrentDefect, resetDefect, setFromImport } = useDefectStore();
  const { setItems: setBatchItems } = useBatchStore();

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [translating, setTranslating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [translated, setTranslated] = useState<TranslatedDefect | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; issueKey?: string; error?: string } | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [priorityOptions, setPriorityOptions] = useState<PriorityOption[]>([]);
  const [jiraPriorities, setJiraPriorities] = useState<JiraPriority[]>([]);
  const [templates, setTemplates] = useState<DefectTemplate[]>([]);
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);

  useEffect(() => {
    dictService.loadAll().catch(() => {});
    loadConfig().then(c => {
      setConfig(c);
      if (c.jira.serverUrl && c.jira.apiToken) {
        jiraApi.fetchPriorities(c.jira)
          .then(priorities => {
            setJiraPriorities(priorities);
            setPriorityOptions(buildPriorityOptions(priorities));
          })
          .catch(() => {});
      }
    }).catch(() => {});
    loadTemplates().then(setTemplates).catch(() => {});
  }, []);

  const draftPrompted = useRef(false);

  useEffect(() => {
    if (draftPrompted.current) return;
    draftPrompted.current = true;
    loadDraft().then(draft => {
      if (draft) {
        try {
          const saved = JSON.parse(draft) as DefectData;
          if (saved.summary || saved.precondition || saved.steps) {
            Modal.confirm({
              title: '发现未提交的缺陷',
              content: '是否恢复上次的填写内容？',
              okText: '恢复',
              cancelText: '丢弃',
              onOk: () => setCurrentDefect(saved),
              onCancel: () => clearDraft(),
            });
          }
        } catch { /* ignore */ }
      }
    });
  }, []);

  useEffect(() => {
    if (currentDefect.summary || currentDefect.precondition || currentDefect.steps) {
      const timer = setTimeout(() => {
        saveDraft(JSON.stringify(currentDefect));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentDefect]);

  const handleCreate = useCallback(async () => {
    const validationErrors = validateDefect(currentDefect);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      message.error(`请填写: ${validationErrors.map(e => e.label).join('、')}`);
      return;
    }
    setErrors([]);

    if (!config?.jira.serverUrl || !config?.jira.apiToken) {
      message.error('请先配置 JIRA 连接信息');
      navigate('/settings');
      return;
    }

    setTranslating(true);
    resetOnlineState();
    try {
      const hasOnlineConfig = isOnlineConfigValid(config.translate);

      if (config.translate.onlineEnabled && !hasOnlineConfig) {
        const providerName = config.translate.onlineProvider === 'baidu' ? '百度翻译' : '有道智云';
        message.warning(`在线翻译已启用但 ${providerName} 配置不完整，将使用基础翻译`);
      }

      if (!config.translate.onlineEnabled) {
        message.warning('在线翻译未启用，请在设置中开启');
      }

      const onlineConfig: import('../services/translate-engine').OnlineConfig | undefined = hasOnlineConfig
        ? {
            provider: config.translate.onlineProvider,
            baiduAppId: config.translate.baiduAppId || '',
            baiduSecret: config.translate.baiduSecret || '',
            youdaoAppKey: config.translate.youdaoAppKey || '',
            youdaoAppSecret: config.translate.youdaoAppSecret || '',
          }
        : undefined;

      const translatedResult = await translateDefect(currentDefect, onlineConfig);

      if (translatedResult.translateErrors?.length) {
        message.warning(`在线翻译出错: ${translatedResult.translateErrors.join('; ')}，部分字段使用了基础翻译`);
      }
      setTranslated(translatedResult);
      setPreviewOpen(true);
    } catch (err: any) {
      message.error('翻译失败: ' + err?.toString());
    } finally {
      setTranslating(false);
    }
  }, [currentDefect, config, navigate]);

  const resolvePriorityId = useCallback((priority: string): string => {
    if (!priority) return '';
    if (/^\d+$/.test(priority)) return priority;
    const found = jiraPriorities.find(p => p.name === priority);
    return found ? found.id : priority;
  }, [jiraPriorities]);

  const handlePreviewConfirm = useCallback(async (edited: TranslatedDefect) => {
    setPreviewOpen(false);
    setCreating(true);
    setLastResult(null);

    try {
      const description = formatDescription(edited);
      const resp = await jiraApi.createIssue(config!.jira, edited.summaryEn, description, resolvePriorityId(currentDefect.priority));

      const allPaths = [...currentDefect.mediaFiles, ...currentDefect.traceFiles].map(f => f.path);
      if (allPaths.length > 0) {
        try {
          await jiraApi.uploadAttachments(config!.jira, resp.key, allPaths);
        } catch (attachErr: any) {
          message.warning(`缺陷 ${resp.key} 已创建，但附件上传失败: ${attachErr?.toString()}`);
        }
      }

      setLastResult({ success: true, issueKey: resp.key });
      message.success(`缺陷 ${resp.key} 创建成功！`);
      resetDefect();
      clearDraft();
    } catch (err: any) {
      setLastResult({ success: false, error: err?.toString() || '创建失败' });
      message.error('创建失败: ' + err?.toString());
    } finally {
      setCreating(false);
    }
  }, [config, currentDefect, resetDefect]);

  const handleImport = useCallback((result: ParseResult) => {
    if (result.items.length === 1) {
      setFromImport(result.items[0]);
      message.success('已导入 1 条缺陷');
    } else if (result.items.length > 1) {
      setBatchItems(result.items);
      setBatchMode(true);
    }
  }, [setFromImport, setBatchItems]);

  const handleBatchComplete = useCallback(() => {
    setBatchMode(false);
    resetDefect();
  }, [resetDefect]);

  // 应用模板
  const handleApplyTemplate = useCallback((template: DefectTemplate) => {
    // 检查表单是否有内容
    if (hasFormData(currentDefect)) {
      Modal.confirm({
        title: '覆盖确认',
        content: '当前表单已有内容，应用模板将覆盖，是否继续？',
        okText: '继续',
        cancelText: '取消',
        onOk: () => {
          setCurrentDefect(applyTemplateToDefect(currentDefect, template.data));
          message.success(`已应用模板「${template.name}」`);
        },
      });
    } else {
      setCurrentDefect(applyTemplateToDefect(currentDefect, template.data));
      message.success(`已应用模板「${template.name}」`);
    }
  }, [currentDefect, setCurrentDefect]);

  // 保存模板
  const handleSaveTemplate = useCallback(async (templateData: { name: string; data: TemplateData }) => {
    const newTemplate: DefectTemplate = {
      id: crypto.randomUUID(),
      name: templateData.name,
      data: templateData.data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [...templates, newTemplate];
    await saveTemplates(updated);
    setTemplates(updated);
    message.success('模板已保存');
  }, [templates]);

  // 模板列表变更（编辑/删除）
  const handleTemplatesChange = useCallback(async (updated: DefectTemplate[]) => {
    await saveTemplates(updated);
    setTemplates(updated);
  }, []);

  if (batchMode) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <Text strong style={{ fontSize: 16 }}>批量创建缺陷</Text>
        </Header>
        <Content style={{ padding: 24, maxWidth: 1000, margin: '0 auto', width: '100%' }}>
          <BatchGuide onComplete={handleBatchComplete} priorityOptions={priorityOptions} jiraPriorities={jiraPriorities} />
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
        <Text strong style={{ fontSize: 16 }}>JIRA 缺陷自动创建工具</Text>
        <Button icon={<SettingOutlined />} type="text" onClick={() => navigate('/settings')}>设置</Button>
      </Header>

      <Content style={{ padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 2 }}>
            {/* 模板选择器 */}
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>模板:</span>
              <Select
                placeholder="选择模板快速填写"
                style={{ flex: 1, maxWidth: 300 }}
                allowClear
                value={undefined}
                onChange={(templateId) => {
                  const t = templates.find(t => t.id === templateId);
                  if (t) handleApplyTemplate(t);
                }}
                options={templates.map(t => ({
                  label: t.name,
                  value: t.id,
                }))}
                disabled={creating || translating}
              />
              <Button
                icon={<SaveOutlined />}
                size="small"
                onClick={() => setSaveTemplateModalOpen(true)}
                disabled={creating || translating}
              >
                保存为模板
              </Button>
              <Button
                icon={<AppstoreOutlined />}
                size="small"
                type="text"
                onClick={() => setTemplateManagerOpen(true)}
                disabled={creating || translating}
              >
                管理
              </Button>
            </div>

            <DefectFields
              value={currentDefect}
              onChange={setCurrentDefect}
              errors={errors}
              disabled={creating}
              priorityOptions={priorityOptions}
            />

            <Divider />

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                size="large"
                onClick={handleCreate}
                loading={translating || creating}
                disabled={translating || creating}
              >
                {translating ? '翻译中...' : creating ? '创建中...' : '创建 JIRA 缺陷'}
              </Button>
            </div>

            {lastResult && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <SingleResult
                  success={lastResult.success}
                  issueKey={lastResult.issueKey}
                  error={lastResult.error}
                  serverUrl={config?.jira.serverUrl}
                />
              </div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <AttachmentUpload defect={currentDefect} onChange={setCurrentDefect} disabled={creating} />
            <Divider />
            <ImportUpload onImport={handleImport} disabled={creating} />
          </div>
        </div>

        {translated && (
          <TranslatePreview
            open={previewOpen}
            defect={currentDefect}
            translated={translated}
            onConfirm={handlePreviewConfirm}
            onCancel={() => setPreviewOpen(false)}
          />
        )}

        <SaveTemplateModal
          open={saveTemplateModalOpen}
          onClose={() => setSaveTemplateModalOpen(false)}
          currentDefect={currentDefect}
          existingTemplates={templates}
          onSave={handleSaveTemplate}
        />

        <TemplateManager
          open={templateManagerOpen}
          onClose={() => setTemplateManagerOpen(false)}
          templates={templates}
          onTemplatesChange={handleTemplatesChange}
          onApplyTemplate={handleApplyTemplate}
        />
      </Content>
    </Layout>
  );
};

export default DefectForm;
