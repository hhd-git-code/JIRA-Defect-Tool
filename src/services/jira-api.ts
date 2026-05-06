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

export async function createIssueWithFields(
  config: JiraConfig,
  fields: Record<string, unknown>,
): Promise<JiraCreateResponse> {
  const configWithToken = buildConfigWithToken(config);
  return invoke<JiraCreateResponse>('jira_create_issue_with_fields', {
    config: configWithToken,
    fields,
  });
}

// ========== Xray Cloud API ==========

export async function xrayAuthenticate(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  return invoke<string>('xray_authenticate', { clientId, clientSecret });
}

export interface XrayProjectInfo {
  projectId: string;
  testIssueTypeId: string;
  preconditionIssueTypeId: string;
}

export async function xrayResolveProjectInfo(
  config: JiraConfig,
): Promise<XrayProjectInfo> {
  const configWithToken = buildConfigWithToken(config);
  return invoke<XrayProjectInfo>('xray_resolve_project_info', {
    config: configWithToken,
  });
}

export interface XrayTestStep {
  action: string;
  result: string;
}

export interface XrayCreateTestResponse {
  issueKey: string;
  preconditionKeys: string[];
  warnings: string[];
}

export async function xrayCreateTestWithDetails(
  jiraConfig: JiraConfig,
  xrayToken: string,
  projectInfo: XrayProjectInfo,
  summary: string,
  description: string,
  steps: XrayTestStep[],
  precondition?: string,
): Promise<XrayCreateTestResponse> {
  const configWithToken = buildConfigWithToken(jiraConfig);
  return invoke<XrayCreateTestResponse>('xray_create_test_with_details', {
    jiraConfig: configWithToken,
    xrayToken,
    projectId: projectInfo.projectId,
    testIssueTypeId: projectInfo.testIssueTypeId,
    preconditionIssueTypeId: projectInfo.preconditionIssueTypeId,
    summary,
    description,
    steps,
    precondition: precondition || null,
  });
}
