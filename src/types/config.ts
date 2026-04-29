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

export interface DictEntry {
  zh: string;
  en: string;
}

export interface AppConfig {
  jira: JiraConfig;
  translate: TranslateConfig;
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
    translate: {
      onlineEnabled: false,
      onlineProvider: 'baidu',
      baiduAppId: '',
      baiduSecret: '',
      youdaoAppKey: '',
      youdaoAppSecret: '',
    },
    customDict: [],
  };
}
