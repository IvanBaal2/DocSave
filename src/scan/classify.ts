/**
 * Suggests a category and document type for an imported or captured file.
 *
 * Uses only what is really there: text read on the device, a decoded barcode
 * and the file name. It never invents document details, never rejects a file,
 * and falls back to "Other Documents" (files with text) or "General Photos"
 * (pictures without readable text). The user can always change the result.
 */
import { findMrz, parseBcbp } from './extract';

export type Classification = {
  categoryId: string;
  docType: string;
  /** true when the decision is based on clear evidence (MRZ, barcode, keywords). */
  confident: boolean;
};

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');

type Rule = { re: RegExp; categoryId: string; docType: string };

// Ordered: the first matching rule wins. Keywords cover the app's languages.
const RULES: Rule[] = [
  { re: /\b(passport|pasaporte|passeport|reisepass|passaporto|passaporte)\b/, categoryId: 'identity', docType: 'passport' },
  {
    re: /(driving licen[cs]e|driver'?s? licen[cs]e|permis de conduire|permiso de conduc|carnet de conducir|fuhrerschein|patente di guida|carta de conducao)/,
    categoryId: 'identity',
    docType: 'driving_licence',
  },
  { re: /(residence permit|titre de sejour|tarjeta de residencia|aufenthaltstitel|permesso di soggiorno|\btie\b)/, categoryId: 'identity', docType: 'residence_permit' },
  {
    re: /(identity card|national id|carte nationale d'identite|carte d'identite|documento nacional de identidad|\bdni\b|personalausweis|carta d'identita|cartao de cidadao)/,
    categoryId: 'identity',
    docType: 'national_id',
  },
  { re: /(student (id|card)|carnet de estudiante|carte (d'etudiant|etudiante)|studentenausweis|tessera (universitaria|studente))/, categoryId: 'identity', docType: 'student_id' },
  { re: /(employee (id|badge)|staff (id|card)|badge professionnel|mitarbeiterausweis)/, categoryId: 'identity', docType: 'employee_id' },
  { re: /(boarding pass|tarjeta de embarque|carte d'embarquement|bordkarte|carta d'imbarco)/, categoryId: 'travel', docType: 'boarding_pass' },
  { re: /(e-?ticket|flight|airline|\bvuelo\b|\bvol\b|\bflug\b|\bvolo\b|booking reference|\bpnr\b)/, categoryId: 'travel', docType: 'plane_ticket' },
  { re: /(\btrain\b|\brenfe\b|\bsncf\b|deutsche bahn|trenitalia|\bave\b|eurostar|billete de tren)/, categoryId: 'travel', docType: 'train_ticket' },
  { re: /(hotel|booking\.com|airbnb|reservation confirm|check-in date)/, categoryId: 'travel', docType: 'hotel_reservation' },
  { re: /(travel insurance|seguro de viaje|assurance voyage|reiseversicherung)/, categoryId: 'travel', docType: 'travel_insurance' },
  { re: /(birth certificate|acta de nacimiento|certificat de naissance|geburtsurkunde|certificato di nascita)/, categoryId: 'personal', docType: 'birth_certificate' },
  { re: /(marriage certificate|acta de matrimonio|certificat de mariage|heiratsurkunde)/, categoryId: 'personal', docType: 'marriage_certificate' },
  { re: /(prescription|receta medica|ordonnance|rezept|hospital|clinic|medical report|informe medico|vaccin)/, categoryId: 'personal', docType: 'medical_document' },
  { re: /(contract|contrato|contrat|vertrag|contratto|agreement|insurance policy|poliza)/, categoryId: 'personal', docType: 'contract' },
  { re: /(gift card|tarjeta regalo|carte cadeau|geschenkkarte|carta regalo)/, categoryId: 'cards', docType: 'gift_card' },
  { re: /(voucher|gutschein|vale regalo|bon d'achat|buono)/, categoryId: 'coupons', docType: 'voucher' },
  { re: /(coupon|cupon|promo code|discount code|% off|descuento|code promo|rabatt)/, categoryId: 'coupons', docType: 'coupon' },
  { re: /(membership|member card|socio|adherent|mitglied)/, categoryId: 'cards', docType: 'membership_card' },
  { re: /(loyalty|fidelidad|fidelite|treuekarte|punti)/, categoryId: 'cards', docType: 'loyalty_card' },
  { re: /(mastercard|debit card|credit card|tarjeta de (credito|debito)|carte bancaire|maestro)/, categoryId: 'cards', docType: 'bank_card' },
  {
    re: /(receipt|recibo|ticket de caisse|quittung|kassenbon|ricevuta|scontrino|invoice|factura|facture|rechnung|fattura|\biva\b|\bvat\b)/,
    categoryId: 'receipts',
    docType: 'receipt',
  },
];

/** At least this many readable lines make a picture count as a document. */
const DOCUMENT_TEXT_LINES = 4;

export function classify(input: { lines: string[]; barcode?: string; fileName?: string; mimeType: string }): Classification {
  const { lines, barcode, fileName, mimeType } = input;

  if (barcode && parseBcbp(barcode)) return { categoryId: 'travel', docType: 'boarding_pass', confident: true };

  const mrz = findMrz(lines);
  if (mrz) {
    const passport = mrz.format === 'TD3';
    return { categoryId: 'identity', docType: passport ? 'passport' : 'national_id', confident: true };
  }

  const text = fold([fileName ?? '', ...lines].join('\n'));
  for (const r of RULES) if (r.re.test(text)) return { categoryId: r.categoryId, docType: r.docType, confident: true };

  // Receipts without the word "receipt": a TOTAL line with an amount.
  if (/\btotal\b[^\n]*\d+[.,]\d{2}/.test(text)) return { categoryId: 'receipts', docType: 'receipt', confident: true };

  if (mimeType === 'application/pdf') return { categoryId: 'other', docType: 'pdf', confident: false };
  const readable = lines.filter((l) => l.replace(/[^A-Za-z0-9À-ÿ؀-ۿ]/g, '').length >= 3).length;
  if (mimeType.startsWith('image/') && readable < DOCUMENT_TEXT_LINES) {
    return { categoryId: 'photos', docType: 'photo', confident: false };
  }
  return { categoryId: 'other', docType: 'other', confident: false };
}
