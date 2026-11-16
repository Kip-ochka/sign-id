import * as database from 'mime-db/db.json';

const binaryMime = 'application/octet-stream';
const mimeByExtension = new Map<string, string>();
const registry = (
  'default' in database ? database.default : database
) as Record<string, { source?: string; extensions?: string[] }>;

for (const [type, { source, extensions }] of Object.entries(registry)) {
  for (const extension of extensions ?? []) {
    const previous = mimeByExtension.get(extension);
    if (!previous || previous === binaryMime || source === 'iana') {
      mimeByExtension.set(extension, type);
    }
  }
}

const rasterHeaders: Readonly<Record<string, (binary: string) => boolean>> = {
  'image/png': (binary) => binary.startsWith('\x89PNG\r\n\x1a\n'),
  'image/jpeg': (binary) => binary.startsWith('\xff\xd8\xff'),
  'image/gif': (binary) => /^GIF8[79]a/.test(binary),
  'image/webp': (binary) => /^RIFF[\s\S]{4}WEBP/.test(binary),
};

export function createDocumentFile({
  title,
  format,
  binary,
}: {
  title: string;
  format: string;
  binary: string;
}) {
  const extension = format.trim().toLowerCase();
  const suffix = /^[a-z\d]{1,24}$/.test(extension) ? '.' + extension : '.bin';
  const basename = title.trim();
  const label = basename.toLowerCase().endsWith(suffix)
    ? basename.slice(0, -suffix.length)
    : basename;
  const safeName = label
    .replace(/[^\p{L}\p{N} _()-]/gu, '_')
    .slice(0, 120)
    .trim();
  const reserved = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/i;
  const filename =
    (reserved.test(safeName) ? '_' : '') + (safeName || 'document');
  const type = mimeByExtension.get(extension) ?? binaryMime;
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const file = new File([bytes], filename + suffix, { type });
  const kind = rasterHeaders[type]?.(binary)
    ? 'image'
    : type === 'application/pdf' && binary.startsWith('%PDF-')
      ? 'pdf'
      : undefined;
  return { file, kind } as const;
}

export function documentUrl(file: File, kind?: 'image' | 'pdf') {
  // A download link can also be navigated to. Serve unpreviewed bytes as binary.
  return URL.createObjectURL(
    kind ? file : file.slice(0, file.size, binaryMime),
  );
}
