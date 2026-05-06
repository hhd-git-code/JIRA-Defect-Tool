import React, { useState } from 'react';
import { Form, Input, Button, message, Space } from 'antd';
import type { JiraConfig } from '../types/config';
import { testConnection } from '../services/jira-api';
import { loadConfig } from '../stores/config-store';

interface Props {
  config: JiraConfig;
  encryptAndSave: (values: { serverUrl: string; username: string; apiToken: string; projectKey: string; issueType: string }) => Promise<void>;
}

const JiraConfigForm: React.FC<Props> = ({ config, encryptAndSave }) => {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      await encryptAndSave(values);
      const savedConfig = await loadConfig();
      const success = await testConnection(savedConfig.jira);
      if (success) {
        message.success('连接成功！');
      }
    } catch (err: unknown) {
      message.error('连接失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await encryptAndSave(values);
      message.success('配置已保存');
    } catch {
      // validation error
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        serverUrl: config.serverUrl,
        username: config.username,
        apiToken: config.apiToken || '',
        projectKey: config.projectKey,
        issueType: config.issueType || 'Bug',
      }}
    >
      <Form.Item name="serverUrl" label="JIRA 服务器地址" rules={[{ required: true, message: '请输入服务器地址' }]}>
        <Input placeholder="https://yourcompany.atlassian.net" />
      </Form.Item>

      <Form.Item name="username" label="用户名（邮箱）" rules={[{ required: true, message: '请输入用户名' }]}>
        <Input placeholder="your-email@company.com" />
      </Form.Item>

      <Form.Item name="apiToken" label="API Token" rules={[{ required: true, message: '请输入 API Token' }]}>
        <Input.Password placeholder="输入 JIRA API Token" />
      </Form.Item>

      <Form.Item name="projectKey" label="默认项目 Key" rules={[{ required: true, message: '请输入项目 Key' }]}>
        <Input placeholder="PROJ" />
      </Form.Item>

      <Form.Item name="issueType" label="默认 Issue Type" rules={[{ required: true, message: '请输入 Issue Type' }]}>
        <Input placeholder="Bug" />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button onClick={handleTest} loading={testing}>测试连接</Button>
          <Button type="primary" onClick={handleSave} loading={saving}>保存配置</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default JiraConfigForm;
