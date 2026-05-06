import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { COLUMN_MAPPING, mapPriorityValue, mapReproduceRateValue } from '../constants/column-mapping';
import type { DefectData } from '../types/defect';
import { createEmptyDefect } from '../types/defect';
import { readFile, readTextFile } from '@tauri-apps/plugin-fs';

export interface ParseResult {
  items: DefectData[];
  unmappedColumns: string[];
  totalRows: number;
}

export async function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.toLowerCase().split('.').pop();

  if (ext === 'csv') {
    return parseCSV(file);
  }
  return parseExcel(file);
}

export async function parseFilePath(path: string): Promise<ParseResult> {
  const name = path.split('/').pop() || path.split('\\').pop() || '';
  const ext = name.toLowerCase().split('.').pop();

  if (ext === 'csv') {
    const text = await readTextFile(path);
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    return processRows(result.data);
  }

  const data = await readFile(path);
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
  return processRows(json);
}

function parseExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
        resolve(processRows(json));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        resolve(processRows(result.data));
      },
      error: (err) => reject(err),
    });
  });
}

function processRows(rows: Record<string, string>[]): ParseResult {
  if (rows.length === 0) {
    return { items: [], unmappedColumns: [], totalRows: 0 };
  }

  // 识别列名映射
  const headers = Object.keys(rows[0]);
  const fieldMap: Record<string, string> = {}; // header -> field name
  const unmappedColumns: string[] = [];

  for (const header of headers) {
    const trimmed = header.trim();
    if (COLUMN_MAPPING[trimmed]) {
      fieldMap[header] = COLUMN_MAPPING[trimmed];
    } else {
      unmappedColumns.push(trimmed);
    }
  }

  // 可从表格导入的文本字段
  type TextFieldKey = 'summary' | 'timestamp' | 'precondition' | 'steps' | 'expectedResult' | 'actualResult' | 'recoverSteps';
  const TEXT_FIELDS: Set<string> = new Set<TextFieldKey>([
    'summary', 'timestamp', 'precondition', 'steps', 'expectedResult', 'actualResult', 'recoverSteps',
  ]);

  const items: DefectData[] = rows.map(row => {
    const defect = createEmptyDefect();
    for (const [header, field] of Object.entries(fieldMap)) {
      const value = (row[header] || '').toString().trim();
      if (field === 'priority') {
        defect.priority = mapPriorityValue(value);
      } else if (field === 'reproduceRate') {
        defect.reproduceRate = mapReproduceRateValue(value);
      } else if (TEXT_FIELDS.has(field)) {
        defect[field as TextFieldKey] = value;
      }
    }
    return defect;
  });

  return { items, unmappedColumns, totalRows: rows.length };
}
