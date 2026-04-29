import type { AppConfig, DictEntry } from '../types/config';
import { createDefaultConfig } from '../types/config';

let store: any = null;

async function getStore() {
  if (!store) {
    const { load } = await import('@tauri-apps/plugin-store');
    store = await load('jira-config.json', { autoSave: false, defaults: {} });
  }
  return store;
}

export async function loadConfig(): Promise<AppConfig> {
  const s = await getStore();
  const saved = await s.get('config') as any | null;
  if (!saved) return createDefaultConfig();
  const defaults = createDefaultConfig();

  let needsMigration = false;

  // 迁移：加密字段名改为明文字段名
  const jira: any = { ...defaults.jira, ...saved.jira };
  const translate: any = { ...defaults.translate, ...saved.translate };

  if (jira.apiTokenEncrypted !== undefined && jira.apiToken === undefined) {
    jira.apiToken = '';
    delete jira.apiTokenEncrypted;
    needsMigration = true;
  } else if (jira.apiTokenEncrypted !== undefined) {
    delete jira.apiTokenEncrypted;
    needsMigration = true;
  }

  if (translate.baiduSecretEncrypted !== undefined && translate.baiduSecret === undefined) {
    translate.baiduSecret = '';
    delete translate.baiduSecretEncrypted;
    needsMigration = true;
  } else if (translate.baiduSecretEncrypted !== undefined) {
    delete translate.baiduSecretEncrypted;
    needsMigration = true;
  }

  if (translate.youdaoAppSecretEncrypted !== undefined && translate.youdaoAppSecret === undefined) {
    translate.youdaoAppSecret = '';
    delete translate.youdaoAppSecretEncrypted;
    needsMigration = true;
  } else if (translate.youdaoAppSecretEncrypted !== undefined) {
    delete translate.youdaoAppSecretEncrypted;
    needsMigration = true;
  }

  // 迁移：DeepL 已移除，降级为百度
  if (translate.onlineProvider === 'deepl') {
    translate.onlineProvider = 'baidu';
    delete translate.onlineApiKeyEncrypted;
    needsMigration = true;
  }

  const config: AppConfig = {
    jira,
    translate,
    customDict: saved.customDict || [],
  };

  if (needsMigration) {
    await saveConfig(config);
  }

  return config;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const s = await getStore();
  await s.set('config', config);
  await s.save();
}

export async function loadCustomDict(): Promise<DictEntry[]> {
  const s = await getStore();
  const dict = await s.get('customDict') as DictEntry[] | null;
  return dict || [];
}

export async function saveCustomDict(entries: DictEntry[]): Promise<void> {
  const s = await getStore();
  await s.set('customDict', entries);
  await s.save();
}

export async function loadDraft(): Promise<string | null> {
  const s = await getStore();
  return s.get('defectDraft') as Promise<string | null>;
}

export async function saveDraft(draft: string): Promise<void> {
  const s = await getStore();
  await s.set('defectDraft', draft);
  await s.save();
}

export async function clearDraft(): Promise<void> {
  const s = await getStore();
  await s.delete('defectDraft');
  await s.save();
}
