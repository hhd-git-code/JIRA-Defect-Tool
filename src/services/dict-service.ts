import { loadCustomDict } from '../stores/config-store';

export interface DictMatch {
  start: number;
  end: number;
  zh: string;
  en: string;
  source: 'custom';
}

class DictService {
  private customMap = new Map<string, string>();
  private sortedCustomKeys: string[] = [];
  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) return;

    try {
      const customDict = await loadCustomDict();
      this.customMap.clear();
      for (const entry of customDict) {
        this.customMap.set(entry.zh, entry.en);
      }
      this.sortedCustomKeys = [...this.customMap.keys()].sort((a, b) => b.length - a.length);
    } catch {
      this.customMap.clear();
      this.sortedCustomKeys = [];
    }

    this.loaded = true;
  }

  findMatches(text: string): DictMatch[] {
    const matches: DictMatch[] = [];
    const occupied = new Set<number>();

    this.matchDict(text, this.sortedCustomKeys, this.customMap, 'custom', matches, occupied);

    return matches.sort((a, b) => a.start - b.start);
  }

  private matchDict(
    text: string,
    sortedKeys: string[],
    dictMap: Map<string, string>,
    source: 'custom',
    matches: DictMatch[],
    occupied: Set<number>,
  ): void {
    for (const zh of sortedKeys) {
      let searchFrom = 0;
      while (true) {
        const idx = text.indexOf(zh, searchFrom);
        if (idx === -1) break;

        let conflict = false;
        for (let i = idx; i < idx + zh.length; i++) {
          if (occupied.has(i)) {
            conflict = true;
            break;
          }
        }

        if (!conflict) {
          for (let i = idx; i < idx + zh.length; i++) {
            occupied.add(i);
          }
          matches.push({
            start: idx,
            end: idx + zh.length,
            zh,
            en: dictMap.get(zh)!,
            source,
          });
        }
        searchFrom = idx + 1;
      }
    }
  }

  async reloadCustom(): Promise<void> {
    try {
      const customDict = await loadCustomDict();
      this.customMap.clear();
      for (const entry of customDict) {
        this.customMap.set(entry.zh, entry.en);
      }
      this.sortedCustomKeys = [...this.customMap.keys()].sort((a, b) => b.length - a.length);
    } catch {
      // ignore
    }
  }
}

export const dictService = new DictService();
