import React, { useEffect, useState } from 'react';
import { Layout, Typography, Card, Button, message, Table, Space, Modal, Form, Input, Popconfirm, Select, Switch } from 'antd';
import type { FormInstance } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import JiraConfigForm from '../components/jira-config-form';
import { loadConfig, saveConfig, loadCustomDict, saveCustomDict } from '../stores/config-store';
import type { AppConfig, DictEntry } from '../types/config';
import { createDefaultConfig } from '../types/config';
import { xrayAuthenticate } from '../services/jira-api';
import { openUrl } from '@tauri-apps/plugin-opener';

const { Header, Content } = Layout;
const { Title } = Typography;

// 通用的表单保存 handler 工厂
function makeSaveHandler<TValues>(
  form: FormInstance,
  setSaving: (b: boolean) => void,
  buildConfig: (values: TValues, config: AppConfig) => AppConfig,
  successMsg: string,
  getConfig: () => AppConfig,
  onConfigChange: (c: AppConfig) => void,
) {
  return async () => {
    try {
      const values = await form.validateFields() as TValues;
      setSaving(true);
      const newConfig = buildConfig(values, getConfig());
      await saveConfig(newConfig);
      onConfigChange(newConfig);
      message.success(successMsg);
    } catch {
      // validation error
    } finally {
      setSaving(false);
    }
  };
}

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AppConfig>(createDefaultConfig());
  const [dictEntries, setDictEntries] = useState<DictEntry[]>([]);
  const [dictModalOpen, setDictModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DictEntry | null>(null);
  const [dictForm] = Form.useForm();
  const [translateForm] = Form.useForm();
  const [savingTranslate, setSavingTranslate] = useState(false);
  const [aiForm] = Form.useForm();
  const [savingAi, setSavingAi] = useState(false);
  const [xrayForm] = Form.useForm();
  const [savingXray, setSavingXray] = useState(false);
  const [testingXray, setTestingXray] = useState(false);
  const onlineProvider = Form.useWatch('onlineProvider', translateForm);

  useEffect(() => {
    loadConfig().then(c => setConfig(c));
    loadCustomDict().then(d => setDictEntries(d));
  }, []);

  useEffect(() => {
    translateForm.setFieldsValue({
      onlineEnabled: config.translate.onlineEnabled,
      onlineProvider: config.translate.onlineProvider,
      baiduAppId: config.translate.baiduAppId || '',
      baiduSecret: config.translate.baiduSecret || '',
      youdaoAppKey: config.translate.youdaoAppKey || '',
      youdaoAppSecret: config.translate.youdaoAppSecret || '',
    });
  }, [config, translateForm]);

  useEffect(() => {
    aiForm.setFieldsValue({
      provider: config.ai.provider,
      apiKey: config.ai.apiKey || '',
      model: config.ai.model || '',
      baseUrl: config.ai.baseUrl || '',
    });
  }, [config, aiForm]);

  useEffect(() => {
    xrayForm.setFieldsValue({
      enabled: config.xray.enabled,
      clientId: config.xray.clientId || '',
      clientSecret: config.xray.clientSecret || '',
    });
  }, [config, xrayForm]);

  const handleEncryptAndSaveJira = async (values: {
    serverUrl: string;
    username: string;
    apiToken: string;
    projectKey: string;
    issueType: string;
  }) => {
    const newConfig: AppConfig = {
      ...config,
      jira: {
        serverUrl: values.serverUrl,
        username: values.username,
        apiToken: values.apiToken || config.jira.apiToken,
        projectKey: values.projectKey,
        issueType: values.issueType,
      },
    };
    await saveConfig(newConfig);
    setConfig(newConfig);
  };

  const handleEncryptAndSaveJiraTestCase = async (values: {
    serverUrl: string;
    username: string;
    apiToken: string;
    projectKey: string;
    issueType: string;
  }) => {
    const newConfig: AppConfig = {
      ...config,
      jiraTestCase: {
        serverUrl: values.serverUrl,
        username: values.username,
        apiToken: values.apiToken || config.jiraTestCase.apiToken,
        projectKey: values.projectKey,
        issueType: values.issueType,
      },
    };
    await saveConfig(newConfig);
    setConfig(newConfig);
  };

  // 翻译配置保存逻辑较特殊（有自动启用判断），保持独立
  const handleSaveTranslate = async () => {
    try {
      const values = await translateForm.validateFields();
      setSavingTranslate(true);
      const newConfig = { ...config };

      const provider = values.onlineProvider || 'baidu';
      const hasCredentials = provider === 'baidu'
        ? (values.baiduAppId && values.baiduSecret)
        : (values.youdaoAppKey && values.youdaoAppSecret);

      const onlineEnabled = values.onlineEnabled || !!hasCredentials;

      if (hasCredentials && !values.onlineEnabled) {
        message.info('已自动启用在线翻译');
      }

      newConfig.translate = {
        onlineEnabled,
        onlineProvider: values.onlineProvider,
        baiduAppId: values.baiduAppId || '',
        baiduSecret: values.baiduSecret || config.translate.baiduSecret,
        youdaoAppKey: values.youdaoAppKey || '',
        youdaoAppSecret: values.youdaoAppSecret || config.translate.youdaoAppSecret,
      };
      await saveConfig(newConfig);
      setConfig(newConfig);
      message.success('翻译配置已保存');
    } catch {
      // validation error
    } finally {
      setSavingTranslate(false);
    }
  };

  const handleSaveAi = makeSaveHandler(
    aiForm,
    setSavingAi,
    (values: any, cfg) => ({
      ...cfg,
      ai: {
        provider: values.provider || 'claude',
        apiKey: values.apiKey || '',
        model: values.model || '',
        baseUrl: values.baseUrl || '',
      },
    }),
    'AI 配置已保存',
    () => config,
    setConfig,
  );

  const handleSaveXray = makeSaveHandler(
    xrayForm,
    setSavingXray,
    (values: any, cfg) => ({
      ...cfg,
      xray: {
        enabled: values.enabled || false,
        clientId: values.clientId || '',
        clientSecret: values.clientSecret || cfg.xray.clientSecret,
      },
    }),
    'Xray 配置已保存',
    () => config,
    setConfig,
  );

  const handleTestXray = async () => {
    try {
      const values = await xrayForm.validateFields(['clientId', 'clientSecret']);
      setTestingXray(true);
      await xrayAuthenticate(values.clientId, values.clientSecret || config.xray.clientSecret);
      message.success('Xray 连接成功！');
    } catch (err: unknown) {
      message.error(`Xray 连接失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTestingXray(false);
    }
  };

  const handleAddDictEntry = () => {
    setEditingEntry(null);
    dictForm.resetFields();
    setDictModalOpen(true);
  };

  const handleEditDictEntry = (entry: DictEntry) => {
    setEditingEntry(entry);
    dictForm.setFieldsValue(entry);
    setDictModalOpen(true);
  };

  const handleSaveDictEntry = async () => {
    const values = await dictForm.validateFields();
    let newEntries: DictEntry[];
    if (editingEntry) {
      newEntries = dictEntries.map(e =>
        e.zh === editingEntry.zh ? { zh: values.zh, en: values.en } : e
      );
    } else {
      if (dictEntries.some(e => e.zh === values.zh)) {
        message.warning('该中文术语已存在');
        return;
      }
      newEntries = [...dictEntries, values];
    }
    await saveCustomDict(newEntries);
    setDictEntries(newEntries);
    setDictModalOpen(false);
    message.success('词典已更新');
  };

  const handleDeleteDictEntry = async (zh: string) => {
    const newEntries = dictEntries.filter(e => e.zh !== zh);
    await saveCustomDict(newEntries);
    setDictEntries(newEntries);
  };

  const dictColumns = [
    { title: '中文', dataIndex: 'zh', key: 'zh' },
    { title: 'English', dataIndex: 'en', key: 'en' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: DictEntry) => (
        <Space>
          <a onClick={() => handleEditDictEntry(record)}>编辑</a>
          <Popconfirm title="确认删除?" onConfirm={() => handleDeleteDictEntry(record.zh)}>
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const selectedProvider = onlineProvider || 'baidu';
  const isBaidu = selectedProvider === 'baidu';
  const isYoudao = selectedProvider === 'youdao';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/')} />
        <Title level={4} style={{ margin: 0 }}>设置</Title>
      </Header>
      <Content style={{ padding: 24, maxWidth: 800, margin: '0 auto', width: '100%' }}>
        <Card title="JIRA 缺陷连接配置" style={{ marginBottom: 24 }}>
          <JiraConfigForm
            config={config.jira}
            encryptAndSave={handleEncryptAndSaveJira}
          />
        </Card>

        <Card title="JIRA 测试用例连接配置" style={{ marginBottom: 24 }}>
          <JiraConfigForm
            config={config.jiraTestCase}
            encryptAndSave={handleEncryptAndSaveJiraTestCase}
          />
        </Card>

        <Card title="Xray 测试管理配置" style={{ marginBottom: 24 }}>
          <Form form={xrayForm} layout="vertical">
            <Form.Item name="enabled" label="启用 Xray 集成" valuePropName="checked" extra="启用后，测试用例将通过 Xray API 创建，支持 Test Steps 和 Preconditions">
              <Switch checkedChildren="开" unCheckedChildren="关" />
            </Form.Item>

            <Form.Item name="clientId" label="Client ID" rules={[{ required: false, message: '请输入 Client ID' }]}>
              <Input placeholder="Xray API Client ID" />
            </Form.Item>

            <Form.Item name="clientSecret" label="Client Secret" rules={[{ required: false, message: '请输入 Client Secret' }]}>
              <Input.Password placeholder="Xray API Client Secret" />
            </Form.Item>

            <div style={{ marginBottom: 16, color: '#999', fontSize: 12 }}>
              获取方式：JIRA → Apps → Xray API Keys → 创建 API Key → 获取 Client ID 和 Client Secret
            </div>

            <Form.Item>
              <Space>
                <Button type="primary" onClick={handleSaveXray} loading={savingXray}>保存 Xray 配置</Button>
                <Button onClick={handleTestXray} loading={testingXray}>测试 Xray 连接</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        <Card title="在线翻译配置" style={{ marginBottom: 24 }}>
          <Form form={translateForm} layout="vertical">
            <Form.Item name="onlineEnabled" label="启用在线翻译" valuePropName="checked">
              <Switch checkedChildren="开" unCheckedChildren="关" />
            </Form.Item>

            <Form.Item name="onlineProvider" label="翻译服务">
              <Select>
                <Select.Option value="baidu">百度翻译</Select.Option>
                <Select.Option value="youdao">网易有道智云</Select.Option>
              </Select>
            </Form.Item>

            <div style={{ display: isBaidu ? 'block' : 'none' }}>
              <Form.Item name="baiduAppId" label="百度翻译 APP ID">
                <Input placeholder="在百度翻译开放平台获取" />
              </Form.Item>
              <Form.Item name="baiduSecret" label="百度翻译密钥">
                <Input.Password placeholder="在百度翻译开放平台获取" />
              </Form.Item>
              <div style={{ marginBottom: 16, color: '#999', fontSize: 12 }}>
                申请地址：<a href="#" onClick={(e) => { e.preventDefault(); openUrl('https://fanyi-api.baidu.com/'); }}>https://fanyi-api.baidu.com/</a> → 注册 → 管理控制台 → 获取APP ID和密钥 → 选择「通用翻译」→ 「标准版」（免费）
              </div>
            </div>

            <div style={{ display: isYoudao ? 'block' : 'none' }}>
              <Form.Item name="youdaoAppKey" label="有道智云应用 ID">
                <Input placeholder="在有道智云控制台获取" />
              </Form.Item>
              <Form.Item name="youdaoAppSecret" label="有道智云应用密钥">
                <Input.Password placeholder="在有道智云控制台获取" />
              </Form.Item>
              <div style={{ marginBottom: 16, color: '#999', fontSize: 12 }}>
                申请地址：<a href="#" onClick={(e) => { e.preventDefault(); openUrl('https://ai.youdao.com/'); }}>https://ai.youdao.com/</a> → 注册 → 创建应用 → 获取应用ID和密钥 → 选择「文本翻译」服务
              </div>
            </div>

            <Form.Item>
              <Button type="primary" onClick={handleSaveTranslate} loading={savingTranslate}>保存翻译配置</Button>
            </Form.Item>
          </Form>
        </Card>

        <Card title="AI 服务配置" style={{ marginBottom: 24 }}>
          <Form form={aiForm} layout="vertical">
            <Form.Item name="provider" label="AI 服务" rules={[{ required: true, message: '请选择 AI 服务' }]}>
              <Select>
                <Select.Option value="claude">Claude (Anthropic)</Select.Option>
                <Select.Option value="openai">OpenAI (GPT)</Select.Option>
                <Select.Option value="deepseek">DeepSeek</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '请输入 API Key' }]}>
              <Input.Password placeholder="输入 AI 服务的 API Key" />
            </Form.Item>

            <Form.Item name="model" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
              <Input placeholder="如 claude-sonnet-4-20250514、gpt-4o、deepseek-chat" />
            </Form.Item>

            <Form.Item name="baseUrl" label="自定义 API 地址（可选）">
              <Input placeholder="留空使用默认地址，支持第三方代理" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" onClick={handleSaveAi} loading={savingAi}>保存 AI 配置</Button>
            </Form.Item>
          </Form>
        </Card>

        <Card
          title="自定义术语词典"
          extra={<Button icon={<PlusOutlined />} onClick={handleAddDictEntry}>添加术语</Button>}
        >
          <Table
            dataSource={dictEntries}
            columns={dictColumns}
            rowKey="zh"
            size="small"
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: '暂无自定义术语' }}
          />
        </Card>

        <Modal
          title={editingEntry ? '编辑术语' : '添加术语'}
          open={dictModalOpen}
          onOk={handleSaveDictEntry}
          onCancel={() => setDictModalOpen(false)}
        >
          <Form form={dictForm} layout="vertical">
            <Form.Item name="zh" label="中文术语" rules={[{ required: true, message: '请输入中文术语' }]}>
              <Input placeholder="如：CarPlay" disabled={!!editingEntry} />
            </Form.Item>
            <Form.Item name="en" label="英文翻译" rules={[{ required: true, message: '请输入英文翻译' }]}>
              <Input placeholder="如：CarPlay" />
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default Settings;
