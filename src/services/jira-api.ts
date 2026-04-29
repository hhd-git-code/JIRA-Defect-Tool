import { invoke } from '@tauri-apps/api/core';
import type { JiraConfig } from '../types/config';

interface JiraCreateResponse {
  id: string;
  key: string;
}

export interface JiraPriority {
  id: string;
  name: string;
}

function buildConfigWithToken(config: JiraConfig) {
  return {
    serverUrl: config.serverUrl,
    username: config.username,
    apiToken: config.apiToken,
    projectKey: config.projectKey,
    issueType: config.issueType,
  };
}

export async function testConnection(config: JiraConfig): Promise<boolean> {
  const configWithToken = buildConfigWithToken(config);
  return invoke<boolean>('jira_test_connection', { config: configWithToken });
}

export async function fetchPriorities(config: JiraConfig): Promise<JiraPriority[]> {
  const configWithToken = buildConfigWithToken(config);
  return invoke<JiraPriority[]>('jira_get_priorities', { config: configWithToken });
}

export async function createIssue(
  config: JiraConfig,
  summary: string,
  description: string,
  priority: string,
): Promise<JiraCreateResponse> {
  const configWithToken = buildConfigWithToken(config);
  return invoke<JiraCreateResponse>('jira_create_issue', {
    config: configWithToken,
    summary,
    description,
    priority,
  });
}

export async function uploadAttachments(
  config: JiraConfig,
  issueKey: string,
  filePaths: string[],
): Promise<void> {
  const configWithToken = buildConfigWithToken(config);
  return invoke<void>('jira_upload_attachments', {
    config: configWithToken,
    issueKey,
    filePaths,
  });
}
