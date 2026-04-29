const MEDIA_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.mp4', '.mov'];
const TRACE_EXTENSIONS = ['.txt', '.log', '.zip'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function isValidMediaFile(name: string): boolean {
  const ext = '.' + name.toLowerCase().split('.').pop();
  return MEDIA_EXTENSIONS.includes(ext);
}

export function isValidTraceFile(name: string): boolean {
  const ext = '.' + name.toLowerCase().split('.').pop();
  return TRACE_EXTENSIONS.includes(ext);
}

export function isFileSizeValid(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
