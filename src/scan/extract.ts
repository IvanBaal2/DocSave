/**
 * On-device document information extraction.
 *
 * Input is the text that the platform OCR (ML Kit bundled model / Apple Vision)
 * recognised on the device, or a decoded boarding-pass barcode. Nothing here
 * touches the network. The rules are deliberately conservative: a field is
 * only filled when it was actually read (and, for machine-readable zones,
 * passed the ICAO check digits). Everything else is reported as "missing" so
 * the user can type it in; nothing is ever guessed or invented.
 */
import { locale } from '../i18n';
import type { DocField } from '../vault/types';

export type ScanKind =
  | 'passport'
  | 'id-card'
  | 'licence'
  | 'org-id'
  | 'boarding'
  | 'ticket'
  | 'loyalty'
  | 'giftcard'
  | 'coupon'
  | 'certificate'
  | 'receipt'
  /** A card stored as an image only (bank cards): nothing is read from it. */
  | 'generic-card'
  /** An ordinary photo: nothing is read from it. */
  | 'photo'
  | 'generic';

export type Extraction = {
  fields: DocField[];
  /** Holder / passenger name if recognised. */
  holder?: string;
  /** ISO date: expiry for identity documents, travel date for travel documents. */
  keyDate?: string;
  /** How the data was obtained, for the review screen. */
  source: 'mrz' | 'barcode' | 'text' | 'none';
  /** MRZ / barcode verified with check digits. */
  verified: boolean;
};

// ── Field templates (what each kind of document is expected to contain) ─────

const TEMPLATES: Record<ScanKind, [string, string][]> = {
  passport: [
    ['fullName', 'Full name'],
    ['documentNumber', 'Passport number'],
    ['nationality', 'Nationality'],
    ['dateOfBirth', 'Date of birth'],
    ['sex', 'Sex'],
    ['issueDate', 'Issue date'],
    ['expiryDate', 'Expiry date'],
    ['issuingCountry', 'Issuing country'],
  ],
  'id-card': [
    ['fullName', 'Full name'],
    ['documentNumber', 'Document number'],
    ['nationality', 'Nationality'],
    ['dateOfBirth', 'Date of birth'],
    ['sex', 'Sex'],
    ['issueDate', 'Issue date'],
    ['expiryDate', 'Expiry date'],
    ['issuingCountry', 'Issuing country'],
  ],
  licence: [
    ['fullName', 'Full name'],
    ['dateOfBirth', 'Date of birth'],
    ['documentNumber', 'Licence number'],
    ['issueDate', 'Issue date'],
    ['expiryDate', 'Expiry date'],
    ['categories', 'Vehicle categories'],
    ['issuingAuthority', 'Issuing authority'],
  ],
  'org-id': [
    ['fullName', 'Full name'],
    ['documentNumber', 'ID number'],
    ['organisation', 'Company / school'],
    ['role', 'Position / course'],
    ['issueDate', 'Issue date'],
    ['expiryDate', 'Valid until'],
  ],
  loyalty: [
    ['brand', 'Store / brand'],
    ['cardNumber', 'Card number'],
    ['memberName', 'Member name'],
    ['expiryDate', 'Valid until'],
  ],
  giftcard: [
    ['brand', 'Store / brand'],
    ['cardNumber', 'Card number'],
    ['pin', 'PIN / security code'],
    ['balance', 'Value'],
    ['expiryDate', 'Valid until'],
  ],
  coupon: [
    ['brand', 'Store / brand'],
    ['code', 'Coupon code'],
    ['offer', 'Offer'],
    ['expiryDate', 'Valid until'],
  ],
  boarding: [
    ['passengerName', 'Passenger'],
    ['carrier', 'Airline'],
    ['flightNumber', 'Flight number'],
    ['from', 'From'],
    ['to', 'To'],
    ['travelDate', 'Date'],
    ['seat', 'Seat'],
    ['bookingReference', 'Booking reference'],
  ],
  ticket: [
    ['passengerName', 'Passenger'],
    ['carrier', 'Carrier'],
    ['flightNumber', 'Flight / train number'],
    ['from', 'From'],
    ['to', 'To'],
    ['travelDate', 'Date'],
    ['bookingReference', 'Booking reference'],
  ],
  certificate: [
    ['title', 'Title'],
    ['documentDate', 'Date on document'],
  ],
  generic: [
    ['title', 'Title'],
    ['documentDate', 'Date on document'],
  ],
  receipt: [
    ['merchant', 'Shop / merchant'],
    ['documentDate', 'Date of purchase'],
    ['total', 'Total'],
  ],
  'generic-card': [],
  photo: [],
};

export function emptyFields(kind: ScanKind): DocField[] {
  return TEMPLATES[kind].map(([key, label]) => ({ key, label, value: '', status: 'missing' as const }));
}

function fill(kind: ScanKind, values: Record<string, string | undefined>): DocField[] {
  return TEMPLATES[kind].map(([key, label]) => {
    const v = values[key]?.trim();
    return v ? { key, label, value: v, status: 'recognized' as const } : { key, label, value: '', status: 'missing' as const };
  });
}

// ── Dates ────────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12,
  // common multilingual abbreviations on passports / tickets
  ENE: 1, FEV: 2, FÉV: 2, AVR: 4, ABR: 4, MAI: 5, MAG: 5, JUIN: 6, GIU: 6, JUIL: 7, LUG: 7, AGO: 8, AOU: 8, AOÛ: 8,
  SET: 9, OTT: 10, DIC: 12, DEZ: 12, OKT: 10, MRZ: 3, MÄR: 3,
};

const pad = (n: number) => String(n).padStart(2, '0');

function validDate(y: number, m: number, d: number): string | undefined {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Parses dates in common printed formats into ISO (YYYY-MM-DD). Day-first for numeric forms. */
export function parseDate(text: string): string | undefined {
  const t = text.toUpperCase();
  let m = /\b(\d{4})[-./](\d{1,2})[-./](\d{1,2})\b/.exec(t);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = /\b(\d{1,2})[-./ ](\d{1,2})[-./ ](\d{4})\b/.exec(t);
  if (m) return validDate(+m[3], +m[2], +m[1]);
  m = /\b(\d{1,2})\s*([A-ZÀ-Ý]{3,4})(?:\/[A-ZÀ-Ý]{3,4})*\.?\s*(\d{4}|\d{2})\b/.exec(t);
  if (m && MONTHS[m[2]]) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return validDate(y, MONTHS[m[2]], +m[1]);
  }
  m = /\b(\d{1,2})[-./](\d{1,2})[-./](\d{2})\b/.exec(t);
  if (m) return validDate(2000 + +m[3], +m[2], +m[1]);
  return undefined;
}

export function allDates(lines: string[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    const d = parseDate(l);
    if (d) out.push(d);
  }
  return out;
}

export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Machine Readable Zone (ICAO 9303) ────────────────────────────────────────

const charValue = (c: string): number => {
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55;
  return 0; // '<'
};

export function checkDigit(field: string): number {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i++) sum += charValue(field[i]) * w[i % 3];
  return sum % 10;
}

const DIGIT_FIX: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7' };
const toDigits = (s: string) => s.replace(/[OQDILZSBGT]/g, (c) => DIGIT_FIX[c]);

function checked(field: string, digit: string, numeric: boolean): string | undefined {
  const candidates = numeric ? [field, toDigits(field)] : [field, field.replace(/O/g, '0')];
  const d = toDigits(digit);
  for (const c of candidates) {
    if (/^\d$/.test(d) && checkDigit(c) === Number(d)) return c;
  }
  return undefined;
}

/** Cleans an OCR line into MRZ alphabet (A-Z, 0-9, <). */
export function mrzClean(line: string): string {
  return line
    .toUpperCase()
    .replace(/[«‹(\[{]/g, '<')
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9<]/g, '')
    .replace(/K{3,}/g, (m) => '<'.repeat(m.length)) // OCR often reads <<< as KKK
    .replace(/<K</g, '<<<');
}

/** Could this OCR line be part of a machine-readable zone? */
function mrzCandidate(l: string): boolean {
  if (l.length < 26 || l.length > 48) return false;
  if (l.includes('<')) return true;
  // Some lines (e.g. UAE ID line 1) are filled with digits and contain few or no '<'.
  return (l.match(/\d/g)?.length ?? 0) >= 8;
}

function mrzDate(yymmdd: string, kind: 'birth' | 'expiry'): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const yy = +yymmdd.slice(0, 2);
  const nowYY = new Date().getFullYear() % 100;
  const year = kind === 'birth' ? (yy > nowYY ? 1900 + yy : 2000 + yy) : yy >= 70 ? 1900 + yy : 2000 + yy;
  return validDate(year, +yymmdd.slice(2, 4), +yymmdd.slice(4, 6));
}

function mrzName(s: string): string {
  const [surname, given = ''] = s.split('<<');
  const fmt = (x: string) =>
    x
      .replace(/<+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());
  return [fmt(given), fmt(surname)].filter(Boolean).join(' ');
}

const COUNTRIES: Record<string, string> = {
  AFG: 'Afghanistan', ALB: 'Albania', DZA: 'Algeria', ARG: 'Argentina', AUS: 'Australia', AUT: 'Austria',
  BEL: 'Belgium', BGD: 'Bangladesh', BGR: 'Bulgaria', BOL: 'Bolivia', BRA: 'Brazil', CAN: 'Canada', CHE: 'Switzerland',
  CHL: 'Chile', CHN: 'China', COL: 'Colombia', CRI: 'Costa Rica', CUB: 'Cuba', CYP: 'Cyprus', CZE: 'Czechia',
  D: 'Germany', DEU: 'Germany', DNK: 'Denmark', DOM: 'Dominican Republic', ECU: 'Ecuador', EGY: 'Egypt',
  ESP: 'Spain', EST: 'Estonia', ETH: 'Ethiopia', FIN: 'Finland', FRA: 'France', GBR: 'United Kingdom', GEO: 'Georgia',
  GHA: 'Ghana', GRC: 'Greece', GTM: 'Guatemala', HKG: 'Hong Kong', HND: 'Honduras', HRV: 'Croatia', HUN: 'Hungary',
  IDN: 'Indonesia', IND: 'India', IRL: 'Ireland', IRN: 'Iran', IRQ: 'Iraq', ISL: 'Iceland', ISR: 'Israel', ITA: 'Italy',
  JAM: 'Jamaica', JOR: 'Jordan', JPN: 'Japan', KAZ: 'Kazakhstan', KEN: 'Kenya', KOR: 'South Korea', KWT: 'Kuwait',
  LBN: 'Lebanon', LKA: 'Sri Lanka', LTU: 'Lithuania', LUX: 'Luxembourg', LVA: 'Latvia', MAR: 'Morocco', MDA: 'Moldova',
  MEX: 'Mexico', MLT: 'Malta', MYS: 'Malaysia', NGA: 'Nigeria', NIC: 'Nicaragua', NLD: 'Netherlands', NOR: 'Norway',
  NPL: 'Nepal', NZL: 'New Zealand', PAK: 'Pakistan', PAN: 'Panama', PER: 'Peru', PHL: 'Philippines', POL: 'Poland',
  PRT: 'Portugal', PRY: 'Paraguay', QAT: 'Qatar', ROU: 'Romania', RUS: 'Russia', SAU: 'Saudi Arabia', SEN: 'Senegal',
  SGP: 'Singapore', SLV: 'El Salvador', SRB: 'Serbia', SVK: 'Slovakia', SVN: 'Slovenia', SWE: 'Sweden', THA: 'Thailand',
  TUN: 'Tunisia', TUR: 'Türkiye', TWN: 'Taiwan', UKR: 'Ukraine', URY: 'Uruguay', USA: 'United States',
  VEN: 'Venezuela', VNM: 'Vietnam', ZAF: 'South Africa', ARE: 'United Arab Emirates',
  EUE: 'European Union', UTO: 'Utopia (specimen)',
};

function country(code: string): string {
  const c = code.replace(/</g, '');
  return COUNTRIES[c] ? `${COUNTRIES[c]} (${c})` : c;
}

export type MrzResult = {
  format: 'TD1' | 'TD2' | 'TD3';
  documentCode: string;
  issuingCountry: string;
  documentNumber?: string;
  nationality: string;
  dateOfBirth?: string;
  sex?: string;
  expiryDate?: string;
  fullName: string;
  /** Number of check digits that validated (document number, birth, expiry). */
  validChecks: number;
};

const SEX: Record<string, string> = { M: 'Male', F: 'Female', X: 'Unspecified', '<': 'Unspecified' };

function fitLen(line: string, len: number): string | null {
  if (line.length === len) return line;
  if (line.length > len && line.length <= len + 2) return line.slice(0, len);
  if (line.length >= len - 2 && line.length < len) return line.padEnd(len, '<');
  return null;
}

function parseTD3(a: string, b: string): MrzResult {
  const num = checked(b.slice(0, 9), b[9], false);
  const dob = checked(b.slice(13, 19), b[19], true);
  const exp = checked(b.slice(21, 27), b[27], true);
  return {
    format: 'TD3',
    documentCode: a.slice(0, 2).replace(/</g, ''),
    issuingCountry: a.slice(2, 5),
    fullName: mrzName(a.slice(5)),
    documentNumber: num?.replace(/</g, ''),
    nationality: b.slice(10, 13),
    dateOfBirth: dob ? mrzDate(dob, 'birth') : undefined,
    sex: SEX[b[20]] ?? undefined,
    expiryDate: exp ? mrzDate(exp, 'expiry') : undefined,
    validChecks: [num, dob, exp].filter(Boolean).length,
  };
}

function parseTD2(a: string, b: string): MrzResult {
  const num = checked(b.slice(0, 9), b[9], false);
  const dob = checked(b.slice(13, 19), b[19], true);
  const exp = checked(b.slice(21, 27), b[27], true);
  return {
    format: 'TD2',
    documentCode: a.slice(0, 2).replace(/</g, ''),
    issuingCountry: a.slice(2, 5),
    fullName: mrzName(a.slice(5)),
    documentNumber: num?.replace(/</g, ''),
    nationality: b.slice(10, 13),
    dateOfBirth: dob ? mrzDate(dob, 'birth') : undefined,
    sex: SEX[b[20]] ?? undefined,
    expiryDate: exp ? mrzDate(exp, 'expiry') : undefined,
    validChecks: [num, dob, exp].filter(Boolean).length,
  };
}

function parseTD1(a: string, b: string, c: string): MrzResult {
  const num = checked(a.slice(5, 14), a[14], false);
  const dob = checked(b.slice(0, 6), b[6], true);
  const exp = checked(b.slice(8, 14), b[14], true);
  return {
    format: 'TD1',
    documentCode: a.slice(0, 2).replace(/</g, ''),
    issuingCountry: a.slice(2, 5),
    documentNumber: num?.replace(/</g, ''),
    dateOfBirth: dob ? mrzDate(dob, 'birth') : undefined,
    sex: SEX[b[7]] ?? undefined,
    expiryDate: exp ? mrzDate(exp, 'expiry') : undefined,
    nationality: b.slice(15, 18),
    fullName: mrzName(c),
    validChecks: [num, dob, exp].filter(Boolean).length,
  };
}

/** Finds and parses a machine-readable zone among OCR lines. Returns the best candidate. */
export function findMrz(lines: string[]): MrzResult | undefined {
  const cleaned = lines.map(mrzClean).filter(mrzCandidate);
  // OCR sometimes splits one MRZ line in two pieces: add joined neighbours too.
  const cand: string[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    cand.push(cleaned[i]);
    const j = cleaned[i] + (cleaned[i + 1] ?? '');
    if (cleaned[i + 1] && [30, 36, 44].some((n) => Math.abs(j.length - n) <= 2) && cleaned[i].length < 28) cand.push(j);
  }
  let best: MrzResult | undefined;
  const consider = (r: MrzResult) => {
    if (!best || r.validChecks > best.validChecks) best = r;
  };
  const n = cand.length;
  for (let i = 0; i < n; i++) {
    // Allow one stray line between MRZ lines (window of up to 3).
    for (let j = i + 1; j < Math.min(n, i + 3); j++) {
      const a44 = fitLen(cand[i], 44);
      const b44 = fitLen(cand[j], 44);
      if (a44 && b44 && /^[PV]/.test(a44)) consider(parseTD3(a44, b44));
      const a36 = fitLen(cand[i], 36);
      const b36 = fitLen(cand[j], 36);
      if (a36 && b36 && /^[ACIV]/.test(a36)) consider(parseTD2(a36, b36));
      for (let k = j + 1; k < Math.min(n, j + 3); k++) {
        const a30 = fitLen(cand[i], 30);
        const b30 = fitLen(cand[j], 30);
        const c30 = fitLen(cand[k], 30);
        if (a30 && b30 && c30 && /^[ACI]/.test(a30)) consider(parseTD1(a30, b30, c30));
      }
    }
  }
  return best && best.validChecks >= 2 ? best : undefined;
}

// ── EU driving licence (Directive 2006/126/EC numbered fields) ───────────────

function euLicence(lines: string[]) {
  const v: Record<string, string> = {};
  for (const raw of lines) {
    const m = /^\s*(1|2|3|4a|4b|4c|5|9)\s*[.,:)]\s*(.+)$/i.exec(raw.trim());
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (!v[key]) v[key] = m[2].trim();
  }
  const surname = v['1'];
  const given = v['2'];
  const fullName = [given, surname].filter(Boolean).join(' ').replace(/\s+/g, ' ');
  return {
    found: Object.keys(v).length,
    fullName: fullName || undefined,
    dateOfBirth: v['3'] ? parseDate(v['3']) : undefined,
    issueDate: v['4a'] ? parseDate(v['4a']) : undefined,
    expiryDate: v['4b'] ? parseDate(v['4b']) : undefined,
    issuingAuthority: v['4c'],
    documentNumber: v['5']?.replace(/\s+/g, ''),
    categories: v['9'],
  };
}

// ── Labelled values (visual zone of ID documents / tickets) ──────────────────

function labelled(lines: string[], labels: RegExp): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = labels.exec(l);
    if (!m) continue;
    const rest = l.slice(m.index + m[0].length).replace(/^[\s:./-]+/, '').trim();
    if (rest.length >= 2) return rest;
    const next = lines[i + 1]?.trim();
    if (next && next.length >= 2) return next;
  }
  return undefined;
}

/** Finds a date printed after (or on the line below) a label. */
function labelledDate(lines: string[], labels: RegExp): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const m = labels.exec(lines[i]);
    if (!m) continue;
    for (const candidate of [lines[i].slice(m.index + m[0].length), lines[i + 1], lines[i + 2]]) {
      const d = candidate ? parseDate(candidate) : undefined;
      if (d) return d;
    }
  }
  return undefined;
}

const ISSUE_LABEL =
  /(date of issue|issue date|issuing date|issued on|issued|fecha de expedici[oó]n|fecha de emisi[oó]n|date de d[ée]livrance|data di rilascio|ausstellungsdatum|data de emiss[aã]o)/i;
const EXPIRY_LABEL =
  /(date of expiry|expiry date|expiration( date)?|expiry|expires|exp\.? date|valid until|valid thru|validity|v[aá]lido hasta|v[aá]lida hasta|fecha de caducidad|caducidad|vencimiento|date d'expiration|scadenza|g[uü]ltig bis|data de validade)/i;
const DOB_LABEL = /(date of birth|birth date|fecha de nacimiento|date de naissance|data di nascita|geburtsdatum|data de nascimento)/i;
const DOCNUM_LABEL =
  /(document no\.?|document number|card no\.?|card number|id\.? no\.?|id number|identity (card )?number|personal no\.?|employee (id|no\.?|number)|staff (id|no\.?)|student (id|no\.?|number)|matr[ií]cula|n[uú]m(ero)?\.? (de )?(documento|soporte|identidad)|n[°º] du document|ausweisnummer)/i;
const NAME_LABEL = /^\s*(full name|name|surname and given names?|nombre( y apellidos)?|apellidos y nombre|nom|nome|name\/nom)\b\s*[:.]?/i;
const NATIONALITY_LABEL = /(nationality|nacionalidad|nationalit[ée]|nazionalit[àa]|staatsangeh[öo]rigkeit)/i;
const SEX_LABEL = /^\s*(sex|sexo|sexe|gender)\b\s*[:.]?/i;
const ORG_HINT =
  /\b(university|universidad|universit[éeàa]|college|school|colegio|escuela|institute|instituto|academy|academia|inc\.?|ltd\.?|llc|corp(oration)?|company|gmbh|s\.?a\.?|s\.?l\.?|group|hospital|ministry|bank)\b/i;
const ROLE_LABEL = /^\s*(position|job title|designation|department|course|program(me)?|faculty|cargo|puesto|curso|grado)\b\s*[:.]?/i;

const LAST_NAME_LABEL = /^\s*(last name|surname|family name|apellidos?|nom de famille|cognome|nachname)\b\s*[:.]?/i;
const FIRST_NAME_LABEL = /^\s*(first name|given names?|forenames?|nombres?|pr[ée]noms?|nome|vorname)\b\s*[:.]?/i;
const MIDDLE_NAME_LABEL = /^\s*(middle name)\b\s*[:.]?/i;
const LICENCE_NO_LABEL =
  /(licen[cs]e no\.?|licen[cs]e number|driver'?s? licen[cs]e no\.?|dl no\.?|d\.l\. no\.?|traffic code no\.?|n[uú]m(ero)?\.? (de )?(licencia|permiso|carn[eé])|permis n[°º])/i;
const CLASS_LABEL = /^\s*(class(es)?|categor(y|ies)|vehicle (class|category)|restrictions?|clase|cat[ée]gories?)\b\s*[:.]?/i;

/** Single-word name parts (surname / given names on separate labelled lines). */
function cleanNamePart(v?: string): string | undefined {
  if (!v) return undefined;
  const t = v.replace(/\s+/g, ' ').replace(/[,;]+$/, '').trim();
  return /^[\p{L}][\p{L} '.-]{0,40}$/u.test(t) && !/\d/.test(t) ? t : undefined;
}

/** Full name from a "Name" line, or from separate first / middle / last name lines. */
function nameFromLabels(lines: string[]): string | undefined {
  const full = cleanName(labelledAtStart(lines, NAME_LABEL));
  if (full) return full;
  const last = cleanNamePart(labelledAtStart(lines, LAST_NAME_LABEL));
  const first = cleanNamePart(labelledAtStart(lines, FIRST_NAME_LABEL));
  const middle = cleanNamePart(labelledAtStart(lines, MIDDLE_NAME_LABEL));
  if (last && first) return [first, middle, last].filter(Boolean).join(' ');
  return undefined;
}

/** A plausible person name: letters, spaces, hyphens, apostrophes; 2–6 words. */
function cleanName(v?: string): string | undefined {
  if (!v) return undefined;
  const t = v.replace(/\s+/g, ' ').trim();
  if (!/^[\p{L}][\p{L} '.-]{2,60}$/u.test(t) || /\d/.test(t)) return undefined;
  const words = t.split(' ');
  return words.length >= 2 && words.length <= 6 ? t : undefined;
}

function labelledAtStart(lines: string[], labels: RegExp): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const m = labels.exec(lines[i]);
    if (!m) continue;
    const rest = lines[i].slice(m[0].length).replace(/^[\s:./-]+/, '').trim();
    if (rest.length >= 1) return rest;
    const next = lines[i + 1]?.trim();
    if (next) return next;
  }
  return undefined;
}

function sexValue(v?: string): string | undefined {
  const t = v?.trim().toUpperCase();
  if (!t) return undefined;
  if (/^(M|MALE|H|HOMBRE|MASCULINO|MASCULIN)\b/.test(t)) return 'Male';
  if (/^(F|FEMALE|MUJER|FEMENINO|FÉMININ|FEMININ)\b/.test(t)) return 'Female';
  return undefined;
}

function countryValue(v?: string): string | undefined {
  const t = v?.replace(/[^\p{L} ]/gu, '').trim();
  return t && t.length >= 3 && t.length <= 40 ? t : undefined;
}

// ── Boarding pass barcode (IATA Resolution 792, BCBP) ────────────────────────

export type BoardingPass = {
  passengerName: string;
  bookingReference: string;
  from: string;
  to: string;
  carrier: string;
  flightNumber: string;
  travelDate?: string;
  seat: string;
};

export function parseBcbp(data: string, now = new Date()): BoardingPass | undefined {
  if (!/^M[1-4]/.test(data) || data.length < 58) return undefined;
  const name = data.slice(2, 22).trim();
  const [sur, given = ''] = name.split('/');
  const julian = parseInt(data.slice(44, 47), 10);
  let travelDate: string | undefined;
  if (julian >= 1 && julian <= 366) {
    // The barcode has no year: choose the occurrence closest to today.
    const candidates = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => {
      const d = new Date(Date.UTC(y, 0, 1));
      d.setUTCDate(julian);
      return d;
    });
    candidates.sort((a, b) => Math.abs(a.getTime() - now.getTime()) - Math.abs(b.getTime() - now.getTime()));
    const d = candidates[0];
    travelDate = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const carrier = data.slice(36, 39).trim();
  const flight = data.slice(39, 44).trim().replace(/^0+/, '');
  const seat = data.slice(48, 52).trim().replace(/^0+/, '');
  const title = (x: string) => x.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());
  return {
    passengerName: [title(given), title(sur)].filter(Boolean).join(' '),
    bookingReference: data.slice(23, 30).trim(),
    from: data.slice(30, 33),
    to: data.slice(33, 36),
    carrier,
    flightNumber: `${carrier}${flight}`,
    travelDate,
    seat,
  };
}

// ── Tickets (printed / PDF text) ─────────────────────────────────────────────

const AIRLINES = [
  'Ryanair', 'Vueling', 'Iberia', 'easyJet', 'Air Europa', 'Lufthansa', 'Air France', 'KLM', 'British Airways',
  'TAP', 'Emirates', 'Qatar Airways', 'Turkish Airlines', 'Wizz Air', 'Volotea', 'Binter', 'ITA Airways',
  'Philippine Airlines', 'Cebu Pacific', 'Swiss', 'Eurowings', 'SAS', 'Norwegian', 'Aer Lingus', 'United',
  'Delta', 'American Airlines', 'Singapore Airlines', 'Etihad', 'Saudia', 'Aeromexico', 'LATAM', 'Avianca',
  'Renfe', 'Iryo', 'Ouigo', 'Trenitalia', 'Italo', 'SNCF', 'Deutsche Bahn', 'Eurostar', 'Amtrak',
];

function ticketFromText(lines: string[]) {
  const text = lines.join('\n');
  const carrier = AIRLINES.find((a) => new RegExp(`\\b${a.replace(/ /g, '\\s+')}\\b`, 'i').test(text));
  const flight =
    /\b(?:flight|vuelo|vol|flug|volo|voo)\s*(?:no\.?|n[º°])?\s*[:#]?\s*([A-Z0-9]{2}\s?\d{1,4})\b/i.exec(text)?.[1] ??
    /\b(?:train|tren|treno|zug)\s*(?:no\.?|n[º°])?\s*[:#]?\s*(\d{2,6})\b/i.exec(text)?.[1];
  const pnr = /\b(?:booking (?:ref(?:erence)?|code)|reservation (?:code|number)|pnr|localizador|code de r[ée]servation|buchungscode|record locator)\s*[:#]?\s*([A-Z0-9]{5,8})\b/i.exec(text)?.[1];
  const route = /\b([A-Z]{3})\s*(?:-|–|—|→|>|to|a)\s*([A-Z]{3})\b/.exec(text);
  const passenger =
    labelled(lines, /(passenger( name)?|pasajero|passager|passagier|nome passeggero|name)\b/i) ??
    /\b([A-Z]{2,}\/[A-Z]{2,}(?:\s[A-Z]+)?)\b/.exec(text)?.[1];
  const dates = allDates(lines);
  return {
    carrier,
    flightNumber: flight?.replace(/\s+/g, ''),
    bookingReference: pnr,
    from: route?.[1],
    to: route?.[2],
    passengerName: passenger,
    travelDate: dates[0],
  };
}

// ── Receipts ──────────────────────────────────────────────────────────────────

const TOTAL_LABEL = /\b(total|importe|totale|gesamt|summe|montant|valor|amount due|a pagar|à payer|zu zahlen)\b/i;
const MONEY = /(?:[€$£]\s*)?\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2}(?:\s*(?:€|eur|usd|gbp|\$|£))?/i;

/** Shop name (first text line), purchase date and total, only when they are printed on the receipt. */
export function extractReceipt(lines: string[]): { merchant?: string; documentDate?: string; total?: string } {
  const merchant = lines.find((l) => /[A-Za-zÀ-ÿ]{3,}/.test(l) && l.length <= 48 && !TOTAL_LABEL.test(l));
  const documentDate = allDates(lines)[0];
  let total: string | undefined;
  for (let i = 0; i < lines.length && !total; i++) {
    if (!TOTAL_LABEL.test(lines[i]) || /sub\s*-?total/i.test(lines[i])) continue;
    total = (MONEY.exec(lines[i]) ?? MONEY.exec(lines[i + 1] ?? ''))?.[0]?.trim();
  }
  return { merchant, documentDate, total };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Extracts structured fields for a document kind from OCR lines (all sides
 * concatenated) and an optional boarding-pass barcode payload.
 */
export function extract(kind: ScanKind, lines: string[], barcode?: string): Extraction {
  const clean = lines.map((l) => l.trim()).filter(Boolean);

  // Photos and image-only cards: nothing is read, nothing is required.
  if (kind === 'photo' || kind === 'generic-card') {
    return { fields: [], keyDate: undefined, source: 'none', verified: false };
  }

  if (kind === 'receipt') {
    const r = extractReceipt(clean);
    const fields = fill(kind, r);
    return { fields, keyDate: undefined, source: r.merchant || r.total || r.documentDate ? 'text' : 'none', verified: false };
  }

  if (kind === 'passport' || kind === 'id-card') {
    const mrz = findMrz(clean);
    const issueDate = labelledDate(clean, ISSUE_LABEL);
    if (mrz) {
      const fields = fill(kind, {
        fullName: mrz.fullName,
        documentNumber: mrz.documentNumber,
        nationality: country(mrz.nationality),
        dateOfBirth: mrz.dateOfBirth,
        sex: mrz.sex,
        issueDate,
        expiryDate: mrz.expiryDate,
        issuingCountry: country(mrz.issuingCountry),
      });
      return { fields, holder: mrz.fullName, keyDate: mrz.expiryDate, source: 'mrz', verified: mrz.validChecks === 3 };
    }
    // No MRZ readable: fall back to clearly labelled values only.
    const num = labelled(clean, DOCNUM_LABEL);
    const expiryDate = labelledDate(clean, EXPIRY_LABEL);
    const fullName = nameFromLabels(clean);
    const nationality = countryValue(labelled(clean, NATIONALITY_LABEL));
    const sex = sexValue(labelledAtStart(clean, SEX_LABEL));
    const fields = fill(kind, {
      fullName,
      documentNumber: num?.replace(/\s+/g, '').match(/^[A-Z0-9-]{4,20}/i)?.[0],
      nationality,
      sex,
      dateOfBirth: labelledDate(clean, DOB_LABEL),
      issueDate,
      expiryDate,
    });
    const any = fields.some((f) => f.status === 'recognized');
    return { fields, holder: fullName, keyDate: expiryDate, source: any ? 'text' : 'none', verified: false };
  }

  if (kind === 'loyalty' || kind === 'giftcard' || kind === 'coupon') {
    const code = barcode?.trim();
    const brand = clean.find(
      (l) =>
        /^[\p{L}][\p{L}&'. -]{1,28}$/u.test(l) &&
        !/^(gift|card|loyalty|member(ship)?|coupon|voucher|valid|expires?|balance|pin|code|scan|terms)\b/i.test(l),
    );
    const number =
      code ??
      labelled(clean, /(card (no\.?|number)|member(ship)? (no\.?|number|id)|n[uú]mero de (tarjeta|socio))/i)
        ?.replace(/\s+/g, '')
        .match(/^[A-Z0-9-]{4,30}/i)?.[0];
    const pin = labelled(clean, /^\s*(pin|security code|scratch code|c[oó]digo)\b/i)?.match(/^[A-Z0-9-]{3,20}/i)?.[0];
    // Prefer amounts written with a leading currency sign; never take a PIN / card line.
    const prefixed = /(?:[$€£¥₱]|\b(?:AED|USD|EUR|GBP|PHP)\b)\s?\d+(?:[.,]\d{2})?/i;
    const suffixed = /\b\d+(?:[.,]\d{2})?\s?(?:€|\b(?:EUR|USD|AED|PHP)\b)/i;
    const moneyLines = clean.filter((l) => !/^\s*(pin|code|card)/i.test(l));
    const money =
      moneyLines.map((l) => prefixed.exec(l)?.[0]).find(Boolean) ??
      moneyLines.map((l) => suffixed.exec(l)?.[0]).find(Boolean);
    const promo =
      kind === 'coupon'
        ? (code ?? labelled(clean, /(promo(tion)? code|coupon code|voucher code|discount code|c[oó]digo( promocional)?)/i)?.match(/^[A-Z0-9-]{3,24}/i)?.[0])
        : undefined;
    const offer = kind === 'coupon' ? clean.find((l) => /(\d+\s?%|\boff\b|discount|descuento|free|gratis|2x1|buy one)/i.test(l)) : undefined;
    const expiryDate = labelledDate(clean, EXPIRY_LABEL) ?? labelledDate(clean, /(valid|v[aá]lido|use by|until|hasta)/i);
    const fields = fill(kind, {
      brand,
      cardNumber: number,
      memberName: kind === 'loyalty' ? nameFromLabels(clean) : undefined,
      pin,
      balance: money,
      code: promo,
      offer,
      expiryDate,
    });
    const any = fields.some((f) => f.status === 'recognized');
    return {
      fields,
      holder: brand,
      keyDate: expiryDate,
      source: code ? 'barcode' : any ? 'text' : 'none',
      verified: !!code,
    };
  }

  if (kind === 'org-id') {
    const fullName = nameFromLabels(clean);
    const num = labelled(clean, DOCNUM_LABEL)?.replace(/\s+/g, '').match(/^[A-Z0-9-]{3,20}/i)?.[0];
    const organisation = clean.find((l) => ORG_HINT.test(l) && l.length <= 70);
    const role = labelledAtStart(clean, ROLE_LABEL);
    const expiryDate = labelledDate(clean, EXPIRY_LABEL);
    const issueDate = labelledDate(clean, ISSUE_LABEL);
    const fields = fill('org-id', { fullName, documentNumber: num, organisation, role, issueDate, expiryDate });
    const any = fields.some((f) => f.status === 'recognized');
    return { fields, holder: fullName, keyDate: expiryDate, source: any ? 'text' : 'none', verified: false };
  }

  if (kind === 'licence') {
    const eu = euLicence(clean);
    const mrz = findMrz(clean); // some licences / permits carry an MRZ on the back
    // Non-EU layouts (e.g. UAE, Philippines, US): labelled fields.
    const generic = {
      fullName: nameFromLabels(clean),
      dateOfBirth: labelledDate(clean, DOB_LABEL),
      documentNumber: labelled(clean, LICENCE_NO_LABEL)?.replace(/\s+/g, '').match(/^[A-Z0-9-]{4,20}/i)?.[0],
      issueDate: labelledDate(clean, ISSUE_LABEL),
      expiryDate: labelledDate(clean, EXPIRY_LABEL),
      categories: labelledAtStart(clean, CLASS_LABEL)?.slice(0, 40),
      issuingAuthority: labelled(clean, /(place of issue|issuing authority|issued by|authority|lugar de expedici[oó]n)/i)?.slice(0, 50),
    };
    const fields = fill('licence', {
      fullName: eu.fullName ?? generic.fullName ?? mrz?.fullName,
      dateOfBirth: eu.dateOfBirth ?? generic.dateOfBirth ?? mrz?.dateOfBirth,
      documentNumber: eu.documentNumber ?? generic.documentNumber ?? mrz?.documentNumber,
      issueDate: eu.issueDate ?? generic.issueDate,
      expiryDate: eu.expiryDate ?? generic.expiryDate ?? mrz?.expiryDate,
      categories: eu.categories ?? generic.categories,
      issuingAuthority: eu.issuingAuthority ?? generic.issuingAuthority,
    });
    const any = fields.some((f) => f.status === 'recognized');
    return {
      fields,
      holder: eu.fullName ?? generic.fullName ?? mrz?.fullName,
      keyDate: eu.expiryDate ?? generic.expiryDate ?? mrz?.expiryDate,
      source: mrz ? 'mrz' : any ? 'text' : 'none',
      verified: false,
    };
  }

  if (kind === 'boarding' || kind === 'ticket') {
    const bp = barcode ? parseBcbp(barcode) : undefined;
    const t = ticketFromText(clean);
    const values = {
      passengerName: bp?.passengerName ?? t.passengerName,
      carrier: bp?.carrier ?? t.carrier,
      flightNumber: bp?.flightNumber ?? t.flightNumber,
      from: bp?.from ?? t.from,
      to: bp?.to ?? t.to,
      travelDate: bp?.travelDate ?? t.travelDate,
      seat: bp?.seat,
      bookingReference: bp?.bookingReference ?? t.bookingReference,
    };
    const fields = fill(kind, values);
    const any = fields.some((f) => f.status === 'recognized');
    return {
      fields,
      holder: values.passengerName,
      keyDate: values.travelDate,
      source: bp ? 'barcode' : any ? 'text' : 'none',
      verified: !!bp,
    };
  }

  // certificates / letters / general documents
  const title = clean.find((l) => /[A-Za-zÀ-ÿ]{3,}/.test(l) && l.length >= 4 && l.length <= 80);
  const documentDate = allDates(clean)[0];
  const fields = fill(kind, { title, documentDate });
  return { fields, keyDate: undefined, source: title || documentDate ? 'text' : 'none', verified: false };
}

/** Builds the automatic description shown in the vault. */
export function describeDocument(typeLabel: string, fields: { key: string; value: string }[], keyDateLabel?: string): string {
  const get = (k: string) => fields.find((f) => f.key === k)?.value?.trim();
  const parts = [typeLabel];
  const who = get('fullName') ?? get('passengerName');
  if (who) parts.push(who);
  const route = get('from') && get('to') ? `${get('from')} → ${get('to')}` : undefined;
  if (route) parts.push(route);
  const flight = get('flightNumber');
  if (flight) parts.push(flight);
  const key = get('expiryDate') ?? get('travelDate');
  if (key && /^\d{4}-\d{2}-\d{2}$/.test(key)) parts.push(`${keyDateLabel ?? 'expires'} ${formatIsoDate(key)}`);
  const title = get('title');
  if (title && parts.length === 1) parts.push(title);
  return parts.join(' · ');
}

/** Suggested document name from the extraction. */
export function suggestName(typeLabel: string, holder?: string): string {
  return holder ? `${typeLabel} ${holder}` : typeLabel;
}

/** Saved fields plus empty slots for the details this kind of document usually has. */
export function withTemplate(kind: ScanKind, saved: DocField[] = []): DocField[] {
  const out = emptyFields(kind).map((t) => saved.find((s) => s.key === t.key) ?? t);
  for (const s of saved) if (!out.some((o) => o.key === s.key)) out.push(s);
  return out;
}
