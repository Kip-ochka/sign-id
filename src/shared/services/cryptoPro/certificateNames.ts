import type { CertificateFilters } from '../../api';
import { readCertificateDerNames, readHexDnValue } from './certificateDer';

const personOids = {
  last_name: ['2.5.4.4', 'SN', 'SURNAME'],
  first_name: ['2.5.4.42', 'G', 'GN', 'GIVENNAME'],
  middle_name: ['2.5.4.43', 'I', 'INITIALS'],
  inn: ['1.2.643.3.131.1.1', 'INN', 'ИНН'],
  snils: ['1.2.643.100.3', 'SNILS', 'СНИЛС'],
} as const;

const organizationOids = {
  name: ['2.5.4.10', 'O', 'ORGANIZATIONNAME'],
  inn: ['1.2.643.100.4', 'INNLE', 'ИНН ЮЛ', 'ИННЮЛ'],
  ogrn: ['1.2.643.100.1', 'OGRN', 'ОГРН'],
} as const;

const issuerInnAliases = [...personOids.inn, 'ИНН ОРГАНИЗАЦИИ'];
const supportedDnKeys = new Set<string>([
  ...Object.values(personOids).flat(),
  ...Object.values(organizationOids).flat(),
  ...issuerInnAliases,
]);

function decodeEscapes(value: string) {
  return value.replace(/(?:\\[\da-f]{2})+|\\./gi, (escape) =>
    escape.length === 2
      ? escape.slice(1)
      : decodeURIComponent(escape.replaceAll('\\', '%')),
  );
}

function invalidDn(): never {
  throw new Error('Некорректное имя сертификата');
}

function readDnValue(dn: string, offset: number) {
  const quoted = dn[offset] === '"';
  const start = quoted ? offset + 1 : offset;
  let end = start;
  let cursor = start;

  // eslint-disable-next-line no-restricted-syntax -- Кавычки и экранирование меняют длину шага.
  while (cursor < dn.length) {
    const character = dn[cursor];
    if (character === '\\') {
      if (
        cursor + 1 === dn.length ||
        /[\r\n\u2028\u2029]/.test(dn[cursor + 1])
      ) {
        invalidDn();
      }
      cursor += 2;
      end = cursor;
    } else if (character === '"') {
      if (!quoted) {
        invalidDn();
      }
      if (dn[cursor + 1] !== '"') {
        const value = dn.slice(start, cursor).replaceAll('""', '"');
        return { value, offset: cursor + 1 };
      }
      cursor += 2;
    } else if (!quoted && ',;+'.includes(character)) {
      break;
    } else {
      cursor += 1;
      // В значении без кавычек конечные пробелы сохраняются только при экранировании.
      if (!quoted && !/\s/.test(character)) {
        end = cursor;
      }
    }
  }

  if (quoted) {
    invalidDn();
  }
  return { value: dn.slice(start, end), offset: cursor };
}

function readDn(dn: string) {
  const attributes = new Map<string, string[]>();
  const keyAndEquals = /\s*([\p{L}\d_.-]+(?:[ \t]+[\p{L}\d_.-]+)*)\s*=\s*/uy;
  const separator = /\s*([,;+]|$)/y;
  let offset = 0;
  // eslint-disable-next-line no-restricted-syntax -- Следующий атрибут начинается за прочитанным значением.
  while (offset < dn.length) {
    keyAndEquals.lastIndex = offset;
    const key = keyAndEquals.exec(dn);
    if (!key) {
      invalidDn();
    }
    const value = readDnValue(dn, keyAndEquals.lastIndex);
    separator.lastIndex = value.offset;
    const boundary = separator.exec(dn);
    if (!boundary || (boundary[1] && separator.lastIndex === dn.length)) {
      invalidDn();
    }

    const name = key[1]
      .toUpperCase()
      .replace(/^OID\./, '')
      .replace(/[ \t]+/g, ' ');
    if (supportedDnKeys.has(name)) {
      const values = attributes.get(name) ?? [];
      const hex =
        dn[keyAndEquals.lastIndex] === '"'
          ? undefined
          : /^#((?:[0-9a-f]{2})+)$/i.exec(value.value)?.[1];
      values.push(
        hex ? (readHexDnValue(hex) ?? '') : decodeEscapes(value.value),
      );
      attributes.set(name, values);
    }
    offset = separator.lastIndex;
  }
  return attributes;
}

function readFields<K extends string>(
  attributes: Map<string, string[]>,
  mapping: Record<K, readonly string[]>,
) {
  const fields: Partial<Record<K, string>> = {};
  (Object.keys(mapping) as K[]).forEach((key) => {
    const values = new Set(
      mapping[key].flatMap((name) => attributes.get(name) ?? []),
    );
    const value = values.values().next().value;
    if (values.size === 1 && value?.trim()) {
      fields[key] = value;
    }
  });
  return fields;
}

function readIssuer(attributes: Map<string, string[]>) {
  const issuer = readFields(attributes, organizationOids);
  if (organizationOids.inn.some((alias) => attributes.has(alias))) {
    return issuer;
  }

  const { inn } = readFields(attributes, { inn: issuerInnAliases });
  return inn && /^\d{10}$/.test(inn) ? { ...issuer, inn } : issuer;
}

function toCertificateNames(
  subject: Map<string, string[]>,
  issuer: Map<string, string[]>,
) {
  return {
    person: readFields(subject, personOids),
    organization: readFields(subject, organizationOids),
    issuer: readIssuer(issuer),
    hasMiddleNameAttribute: personOids.middle_name.some((key) =>
      subject.has(key),
    ),
  };
}

function tryReadDn(dn: string) {
  try {
    return readDn(dn);
  } catch {
    return undefined;
  }
}

export function readCertificateNames(subjectName: string, issuerName: string) {
  const subject = tryReadDn(subjectName);
  const issuer = tryReadDn(issuerName);
  return {
    names: toCertificateNames(subject ?? new Map(), issuer ?? new Map()),
    incomplete: !subject || !issuer,
  };
}

export function readCertificateNamesByOid(base64: string) {
  const { subject, issuer } = readCertificateDerNames(base64);
  return toCertificateNames(subject, issuer);
}

type CertificateNames = ReturnType<typeof toCertificateNames>;

function normalizeName(value = '') {
  return value.normalize().trim().replace(/\s+/g, ' ').toLowerCase();
}

function resolveCertificatePerson(
  person: CertificateNames['person'],
  firstName: string,
  middleName: string,
  lastName: string,
) {
  const givenNames = person.first_name;
  const normalizedGivenNames = normalizeName(givenNames);
  if (
    !givenNames ||
    (!person.middle_name && middleName === lastName) ||
    (normalizedGivenNames !== `${firstName} ${middleName}` &&
      !(
        person.middle_name &&
        normalizedGivenNames === `${firstName} ${lastName}`
      ))
  ) {
    return person;
  }

  // Фильтр подтверждает границу, а значения берём из сертификата.
  const boundary = Array.from(givenNames.matchAll(/\s+/g)).find(
    ({ index }) => normalizeName(givenNames.slice(0, index)) === firstName,
  );
  if (!boundary) {
    return person;
  }
  return {
    ...person,
    first_name: givenNames.slice(0, boundary.index).trim(),
    middle_name:
      person.middle_name ??
      givenNames.slice(boundary.index + boundary[0].length).trim(),
  };
}

function normalizeFilterValue(key: string, value: string) {
  if (key === 'snils') {
    return value.replace(/[\s\p{Pd}]/gu, '');
  }
  if (key === 'inn' || key === 'ogrn') {
    return value.replace(/\s/g, '');
  }
  return normalizeName(value);
}

function matchesFields(
  fields: Partial<Record<string, string>>,
  filter?: Partial<Record<string, string>>,
) {
  return Object.entries(filter ?? {}).every(([key, value]) => {
    if (value === undefined) {
      return true;
    }
    const actual = fields[key];
    const expected = normalizeFilterValue(key, value);
    return (
      actual !== undefined &&
      expected !== '' &&
      normalizeFilterValue(key, actual) === expected
    );
  });
}

function joinGivenNames(firstName: string, middleName: string) {
  if (!middleName || firstName.endsWith(` ${middleName}`)) {
    return firstName;
  }
  return `${firstName} ${middleName}`;
}

function matchPerson(
  { person, hasMiddleNameAttribute }: CertificateNames,
  filter: NonNullable<CertificateFilters['person']> = {},
) {
  const { last_name, first_name, middle_name, ...identifiers } = filter;
  const lastName = normalizeName(last_name);
  const firstName = normalizeName(first_name);
  const middleName = normalizeName(middle_name);
  if (!lastName || !firstName || !middleName) {
    return matchesFields(person, filter) ? person : undefined;
  }

  const actualMiddleName = normalizeName(person.middle_name);
  if (
    normalizeName(person.last_name) !== lastName ||
    (hasMiddleNameAttribute && actualMiddleName !== middleName) ||
    !matchesFields(person, identifiers)
  ) {
    return undefined;
  }

  const resolved = resolveCertificatePerson(
    person,
    firstName,
    middleName,
    lastName,
  );
  const actualFirstName = normalizeName(resolved.first_name);
  return actualFirstName &&
    joinGivenNames(actualFirstName, normalizeName(resolved.middle_name)) ===
      joinGivenNames(firstName, middleName)
    ? resolved
    : undefined;
}

export function matchCertificate(
  names: CertificateNames,
  filters?: CertificateFilters,
) {
  const person = matchPerson(names, filters?.person);
  return person &&
    matchesFields(names.organization, filters?.organization) &&
    matchesFields(names.issuer, filters?.issuer)
    ? { ...names, person }
    : undefined;
}
