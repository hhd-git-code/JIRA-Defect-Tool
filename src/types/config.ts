export interface JiraConfig {
  serverUrl: string;
  username: string;
  apiToken: string;
  projectKey: string;
  issueType: string;
}

export interface TranslateConfig {
  onlineEnabled: boolean;
  onlineProvider: 'baidu' | 'youdao';
  // 百度翻译
  baiduAppId: string;
  baiduSecret: string;
  // 网易有道智云
  youdaoAppKey: string;
  youdaoAppSecret: string;
}

export interface AiConfig {
  provider: 'claude' | 'openai' | 'deepseek';
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface DictEntry {
  zh: string;
  en: string;
}

export interface XrayConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}

export interface AppConfig {
  jira: JiraConfig;
  jiraTestCase: JiraConfig;
  xray: XrayConfig;
  translate: TranslateConfig;
  ai: AiConfig;
  customDict: DictEntry[];
}

export function createDefaultConfig(): AppConfig {
  return {
    jira: {
      serverUrl: '',
      username: '',
      apiToken: '',
      projectKey: '',
      issueType: 'Bug',
    },
    jiraTestCase: {
      serverUrl: '',
      username: '',
      apiToken: '',
      projectKey: '',
      issueType: 'Test',
    },
    translate: {
      onlineEnabled: false,
      onlineProvider: 'baidu',
      baiduAppId: '',
      baiduSecret: '',
      youdaoAppKey: '',
      youdaoAppSecret: '',
    },
    xray: {
      enabled: false,
      clientId: '',
      clientSecret: '',
    },
    ai: {
      provider: 'claude',
      apiKey: '',
      model: 'claude-sonnet-4-20250514',
      baseUrl: '',
    },
    customDict: [],
  };
}
