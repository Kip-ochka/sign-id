import * as database from 'mime-db/db.json';

const binaryMime = 'application/octet-stream';
const mimeByExtension = new Map<string, string>();
const registry = ('default' in database ? database.default : database) as Record<
    string,
    { source?: string; extensions?: string[] }
>;

Object.entries(registry).forEach(([type, { source, extensions }]) => {
    extensions?.forEach(extension => {
        const previous = mimeByExtension.get(extension);
        if (!previous || previous === binaryMime || source === 'iana') {
            mimeByExtension.set(extension, type);
        }
    });
});

const rasterHeaders: Readonly<Record<string, (binary: string) => boolean>> = {
    'image/png': binary => binary.startsWith('\x89PNG\r\n\x1a\n'),
    'image/jpeg': binary => binary.startsWith('\xff\xd8\xff'),
    'image/gif': binary => /^GIF8[79]a/.test(binary),
    'image/webp': binary => /^RIFF[\s\S]{4}WEBP/.test(binary)
};

export function createDocumentFile({ title, format, binary }: { title: string; format: string; binary: string }) {
    const extension = format.trim().toLowerCase();
    const suffix = /^[a-z\d]{1,24}$/.test(extension) ? '.' + extension : '.bin';
    const basename = title.trim();
    const label = basename.toLowerCase().endsWith(suffix) ? basename.slice(0, -suffix.length) : basename;
    const safeName = label
        .replace(/[^\p{L}\p{N} _()-]/gu, '_')
        .slice(0, 120)
        .trim();
    const reserved = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/i;
    const filename = (reserved.test(safeName) ? '_' : '') + (safeName || 'document');
    const type = mimeByExtension.get(extension) ?? binaryMime;
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const file = new File([bytes], filename + suffix, { type });
    let kind: 'image' | 'pdf' | 'text' | undefined;
    if (rasterHeaders[type]?.(binary)) {
        kind = 'image';
    } else if (type === 'application/pdf' && binary.startsWith('%PDF-')) {
        kind = 'pdf';
    } else if (extension === 'txt' && type === 'text/plain') {
        kind = 'text';
    }
    return { file, kind } as const;
}

export function openDocumentFile(result: Parameters<typeof createDocumentFile>[0]) {
    const { file, kind } = createDocumentFile(result);
    const openInTab = kind === 'image' || kind === 'text' || (kind === 'pdf' && navigator.pdfViewerEnabled !== false);
    // Ссылку скачивания тоже можно открыть, поэтому отдаём её как бинарный файл.
    const url = URL.createObjectURL(openInTab ? file : file.slice(0, file.size, binaryMime));
    const link = document.createElement('a');
    try {
        link.href = url;
        if (openInTab) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        } else {
            link.download = file.name;
        }
        link.hidden = true;
        document.body.append(link);
        link.click();
        return url;
    } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
    } finally {
        link.remove();
    }
}
