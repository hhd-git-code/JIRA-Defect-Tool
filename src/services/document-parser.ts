import { readFile } from '@tauri-apps/plugin-fs';
import * as XLSX from 'xlsx';

function getFileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

async function parseMarkdown(arrayBuffer: ArrayBuffer): Promise<string> {
  return new TextDecoder().decode(arrayBuffer);
}

async function parseDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function parsePdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str).join(' ');
    pages.push(text);
  }
  return pages.join('\n\n');
}

async function parsePptx(arrayBuffer: ArrayBuffer): Promise<string> {
  const pptxtojson = await import('pptxtojson');
  const result = await (pptxtojson as unknown as { default: (data: ArrayBuffer) => unknown }).default(arrayBuffer);
  const texts: string[] = [];
  if (Array.isArray(result)) {
    for (const slide of result) {
      if (slide && typeof slide === 'object' && 'elements' in slide) {
        const elements = (slide as { elements?: Array<{ text?: string }> }).elements;
        if (elements) {
          for (const el of elements) {
            if (el.text) texts.push(el.text);
          }
        }
      }
    }
  }
  return texts.join('\n\n');
}

async function parseExcel(arrayBuffer: ArrayBuffer): Promise<string> {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const texts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    texts.push(`--- ${sheetName} ---\n${csv}`);
  }
  return texts.join('\n\n');
}

async function parseCsv(arrayBuffer: ArrayBuffer): Promise<string> {
  return new TextDecoder().decode(arrayBuffer);
}

const PARSERS: Record<string, (buf: ArrayBuffer) => Promise<string>> = {
  md: parseMarkdown, markdown: parseMarkdown,
  docx: parseDocx, doc: parseDocx,
  pdf: parsePdf,
  pptx: parsePptx, ppt: parsePptx,
  xlsx: parseExcel, xls: parseExcel,
  csv: parseCsv,
};

export async function parseDocumentFromBuffer(fileName: string, arrayBuffer: ArrayBuffer): Promise<string> {
  const ext = getFileExtension(fileName);
  const parser = PARSERS[ext];
  if (!parser) throw new Error(`不支持的文件格式: .${ext}`);
  return parser(arrayBuffer);
}

export async function parseDocument(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  const fileName = filePath.split(/[\\/]/).pop() || filePath;
  return parseDocumentFromBuffer(fileName, data.buffer);
}

export function getSupportedFileExtensions(): string[] {
  return Object.keys(PARSERS);
}
