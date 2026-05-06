import type { AppConfig, DictEntry } from '../types/config';
import { createDefaultConfig } from '../types/config';
import type { DefectTemplate } from '../types/template';

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

  // 通用的 Encrypted→明文迁移
  type Obj = Record<string, any>;
  function migrateEncryptedField(obj: Obj, encryptedKey: string, plainKey: string) {
    if (obj[encryptedKey] !== undefined) {
      if (obj[plainKey] === undefined) obj[plainKey] = '';
      delete obj[encryptedKey];
      needsMigration = true;
    }
  }

  migrateEncryptedField(jira, 'apiTokenEncrypted', 'apiToken');
  migrateEncryptedField(translate, 'baiduSecretEncrypted', 'baiduSecret');
  migrateEncryptedField(translate, 'youdaoAppSecretEncrypted', 'youdaoAppSecret');

  // 迁移：DeepL 已移除，降级为百度
  if (translate.onlineProvider === 'deepl') {
    translate.onlineProvider = 'baidu';
    delete translate.onlineApiKeyEncrypted;
    needsMigration = true;
  }

  const jiraTestCase: any = { ...defaults.jiraTestCase, ...saved.jiraTestCase };
  const ai: any = { ...defaults.ai, ...saved.ai };

  if (!saved.jiraTestCase) {
    needsMigration = true;
  }

  if (!saved.ai) {
    needsMigration = true;
  }

  const xray: any = { ...defaults.xray, ...saved.xray };
  if (!saved.xray) {
    needsMigration = true;
  }

  const config: AppConfig = {
    jira,
    jiraTestCase,
    xray,
    translate,
    ai,
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

export async function loadTemplates(): Promise<DefectTemplate[]> {
  const s = await getStore();
  const templates = await s.get('defectTemplates') as DefectTemplate[] | null;
  return templates || [];
}

export async function saveTemplates(templates: DefectTemplate[]): Promise<void> {
  const s = await getStore();
  await s.set('defectTemplates', templates);
  await s.save();
}
