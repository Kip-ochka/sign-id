type DerValue = { tag: number; bytes: Uint8Array; end: number };

function readValue(source: Uint8Array, offset: number): DerValue {
    const tag = source[offset];
    const lengthByte = source[offset + 1];
    if (lengthByte === undefined || tag % 32 === 31) {
        throw new Error('Некорректный DER');
    }
    let start = offset + 2;
    let length = lengthByte;
    if (lengthByte >= 128) {
        const count = lengthByte - 128;
        if (count === 0 || count > 4 || start + count > source.length) {
            throw new Error('Некорректная длина DER');
        }
        length = source.subarray(start, start + count).reduce((value, byte) => value * 256 + byte, 0);
        start += count;
    }
    const end = start + length;
    if (end > source.length) {
        throw new Error('Неполное значение DER');
    }
    return { tag, bytes: source.subarray(start, end), end };
}

function children(value: DerValue | undefined, tag: number) {
    if (value?.tag !== tag) {
        throw new Error('Неожиданный тип DER');
    }
    const values: DerValue[] = [];
    // eslint-disable-next-line no-restricted-syntax -- Смещение зависит от длины прочитанного TLV.
    for (let offset = 0; offset < value.bytes.length;) {
        const child = readValue(value.bytes, offset);
        values.push(child);
        offset = child.end;
    }
    return values;
}

function readOid(bytes: Uint8Array) {
    const components: number[] = [];
    let component = 0;
    // eslint-disable-next-line no-restricted-syntax -- Чтение OID останавливается при переполнении компонента.
    for (const byte of bytes) {
        component = component * 128 + (byte % 128);
        if (!Number.isSafeInteger(component)) {
            return undefined;
        }
        if (byte < 128) {
            components.push(component);
            component = 0;
        }
    }
    if (!components.length || bytes[bytes.length - 1] >= 128) {
        return undefined;
    }
    const [head, ...tail] = components;
    const root = Math.min(2, Math.floor(head / 40));
    return [root, head - root * 40, ...tail].join('.');
}

function readString({ tag, bytes }: DerValue) {
    try {
        switch (tag) {
            case 12: // UTF8String
                return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            case 18: // NumericString
            case 19: // PrintableString
            case 22: // IA5String
                return bytes.every(byte => byte < 128) ? new TextDecoder().decode(bytes) : undefined;
            case 30: // BMPString
                return new TextDecoder('utf-16be', { fatal: true }).decode(bytes);
            default:
                return undefined;
        }
    } catch {
        return undefined;
    }
}

export function readHexDnValue(hex: string) {
    try {
        const bytes = Uint8Array.from(hex.match(/../g) ?? [], pair => Number.parseInt(pair, 16));
        const value = readValue(bytes, 0);
        return value.end === bytes.length ? readString(value) : undefined;
    } catch {
        return undefined;
    }
}

function readName(name: DerValue) {
    const attributes = new Map<string, string[]>();
    children(name, 0x30).forEach(rdn => {
        children(rdn, 0x31).forEach(attribute => {
            const [id, value] = children(attribute, 0x30);
            const oid = id?.tag === 6 && readOid(id.bytes);
            if (oid && value) {
                const values = attributes.get(oid) ?? [];
                values.push(readString(value) ?? '');
                attributes.set(oid, values);
            }
        });
    });
    return attributes;
}

export function readCertificateDerNames(base64: string) {
    const bytes = Uint8Array.from(atob(base64.replace(/\s/g, '')), char => char.charCodeAt(0));
    const certificate = readValue(bytes, 0);
    const [tbs, algorithm, signature, extra] = children(certificate, 0x30);
    if (certificate.end !== bytes.length || algorithm?.tag !== 0x30 || signature?.tag !== 3 || extra) {
        throw new Error('Некорректная структура сертификата');
    }
    const fields = children(tbs, 0x30);
    // TBSCertificate: [version], serialNumber, signature, issuer, validity, subject.
    const issuerIndex = fields[0]?.tag === 0xa0 ? 3 : 2;
    if (
        fields[issuerIndex - 2]?.tag !== 2 ||
        fields[issuerIndex - 1]?.tag !== 0x30 ||
        fields[issuerIndex + 1]?.tag !== 0x30 ||
        fields[issuerIndex + 3]?.tag !== 0x30
    ) {
        throw new Error('Некорректные поля сертификата');
    }
    return {
        subject: readName(fields[issuerIndex + 2]),
        issuer: readName(fields[issuerIndex])
    };
}
