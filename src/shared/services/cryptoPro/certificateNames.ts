import type { CertificateFilters } from '../../api';

const personOids = {
  last_name: ['2.5.4.4', 'SN'],
  first_name: ['2.5.4.42', 'G'],
  middle_name: ['2.5.4.43', 'I'],
  inn: ['1.2.643.3.131.1.1', 'INN'],
  snils: ['1.2.643.100.3', 'SNILS'],
} as const;

const organizationOids = {
  name: ['2.5.4.10', 'O'],
  inn: ['1.2.643.100.4', 'INNLE'],
  ogrn: ['1.2.643.100.1', 'OGRN'],
} as const;

function decodeEscapes(value: string) {
  return value.replace(/(?:\\[\da-f]{2})+|\\./gi, (escape) =>
    escape.length === 2
      ? escape.slice(1)
      : decodeURIComponent(escape.replaceAll('\\', '%')),
  );
}

function readDn(dn: string) {
  const attributes = new Map<string, string[]>();
  // CAdES может заключать значения в кавычки, удваивать кавычки или экранировать разделители.
  const attribute =
    /\s*([\w.]+)\s*=\s*(?:"((?:[^"\\]|""|\\.)*)"|((?:[^",;+\\]|\\.)*?))(?:\s*([,;+])|\s*$)/gy;
  for (let offset = 0; offset < dn.length;) {
    const match = attribute.exec(dn);
    if (!match) throw new Error('Некорректное имя сертификата');
    const [, key, quoted, unquoted, separator] = match;
    const value = decodeEscapes(quoted?.replaceAll('""', '"') ?? unquoted);
    const name = key.toUpperCase().replace(/^OID\./, '');
    const values = attributes.get(name) ?? [];
    values.push(value);
    attributes.set(name, values);
    offset = attribute.lastIndex;
    if (separator && !dn.slice(offset).trim()) {
      throw new Error('Некорректное имя сертификата');
    }
  }
  return attributes;
}

function readFields<K extends string>(
  attributes: Map<string, string[]>,
  mapping: Record<K, readonly [string, string]>,
) {
  const fields: Partial<Record<K, string>> = {};
  for (const key of Object.keys(mapping) as K[]) {
    const [oid, alias] = mapping[key];
    const values = new Set([
      ...(attributes.get(oid) ?? []),
      ...(attributes.get(alias) ?? []),
    ]);
    const value = values.values().next().value;
    if (values.size === 1 && value) fields[key] = value;
  }
  return fields;
}

export function readCertificateNames(subjectName: string, issuerName: string) {
  const subject = readDn(subjectName);
  return {
    person: readFields(subject, personOids),
    organization: readFields(subject, organizationOids),
    issuer: readFields(readDn(issuerName), organizationOids),
  };
}

type CertificateNames = ReturnType<typeof readCertificateNames>;

function matchesFields(
  fields: Partial<Record<string, string>>,
  filter?: Partial<Record<string, string>>,
) {
  return Object.entries(filter ?? {}).every(
    ([key, value]) => value === undefined || fields[key] === value,
  );
}

export function matchesCertificate(
  { person, organization, issuer }: CertificateNames,
  filters?: CertificateFilters,
) {
  return (
    matchesFields(person, filters?.person) &&
    matchesFields(organization, filters?.organization) &&
    matchesFields(issuer, filters?.issuer)
  );
}
