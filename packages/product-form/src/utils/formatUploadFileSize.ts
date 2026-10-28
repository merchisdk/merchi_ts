export function formatUploadFileSize(file: { size?: number; fileSize?: number; bytes?: number } | null | undefined) {
  const bytes = Number(file?.size ?? file?.fileSize ?? file?.bytes);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return kb < 10 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
