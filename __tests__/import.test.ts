/**
 * Smart classification, receipt reading, file validation and the photo
 * crop/rotate geometry used by the camera review step.
 */
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));

import { classify } from '../src/scan/classify';
import { extract, extractReceipt } from '../src/scan/extract';
import { contentProblem, fileProblem, nameFromFile } from '../src/security/importers';
import { looksLikeDocument } from '../src/scan/capture';
import { BUILT_IN_CATEGORIES, findCategory, findDocType } from '../src/vault/categories';

const TD3 = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
];

describe('categories', () => {
  test('the document categories (no general photos)', () => {
    expect(BUILT_IN_CATEGORIES.map((c) => c.id)).toEqual([
      'identity',
      'travel',
      'personal',
      'cards',
      'coupons',
      'receipts',
      'other',
    ]);
  });
  test('documents saved under the old "Cards & Coupons" category still resolve', () => {
    expect(findCategory('wallet', [])?.id).toBe('cards');
    expect(findDocType('wallet', 'coupon')?.id).toBe('coupon');
    // receipts moved out of "Other"
    expect(findDocType('other', 'receipt')?.id).toBe('receipt');
    // General Photos was folded into Other Documents
    expect(findCategory('photos', [])?.id).toBe('other');
  });
});

describe('classification', () => {
  const img = (lines: string[], fileName?: string) => classify({ lines, fileName, mimeType: 'image/jpeg' });

  test('passport from the machine-readable zone', () => {
    expect(img(['PASSPORT', ...TD3])).toEqual({ categoryId: 'identity', docType: 'passport', confident: true });
  });
  test('receipt by keyword or by a TOTAL line', () => {
    expect(img(['SUPERMERCADO SOL', 'TICKET DE CAISSE']).docType).toBe('receipt');
    expect(img(['Cafe Luna', '2 x Latte 3,40', 'TOTAL 6,80 EUR']).categoryId).toBe('receipts');
  });
  test('coupons, vouchers and cards', () => {
    expect(img(['20% OFF', 'Promo code SPRING20']).categoryId).toBe('coupons');
    expect(img(['Gift Voucher', 'Value 50 EUR']).docType).toBe('voucher');
    expect(img(['MEMBERSHIP CARD', 'City Gym']).docType).toBe('membership_card');
  });
  test('file name helps when there is no text', () => {
    expect(classify({ lines: [], fileName: 'Boarding pass MAD-LHR.pdf', mimeType: 'application/pdf' }).docType).toBe('boarding_pass');
    expect(classify({ lines: [], fileName: 'Contrato alquiler.pdf', mimeType: 'application/pdf' }).docType).toBe('contract');
  });
  test('an ordinary photo is marked as not a document', () => {
    expect(img([])).toEqual({ categoryId: 'other', docType: 'other', confident: false, notDocument: true });
    expect(img(['OK'])).toMatchObject({ notDocument: true });
    expect(classify({ lines: [], fileName: 'scan.pdf', mimeType: 'application/pdf' }).notDocument).toBeUndefined();
  });
  test('unrecognised documents go to Other Documents', () => {
    expect(classify({ lines: [], fileName: 'scan001.pdf', mimeType: 'application/pdf' })).toMatchObject({ categoryId: 'other', docType: 'pdf', confident: false });
    expect(img(['Lorem ipsum dolor', 'sit amet consectetur', 'adipiscing elit sed', 'do eiusmod tempor'])).toMatchObject({ categoryId: 'other' });
  });
});

describe('receipts and photos', () => {
  test('reads only what is printed', () => {
    expect(extractReceipt(['MERCADONA S.A.', '12/03/2026 18:22', 'SUBTOTAL 10,00', 'TOTAL 12,10 €'])).toEqual({
      merchant: 'MERCADONA S.A.',
      documentDate: '2026-03-12',
      total: '12,10 €',
    });
    expect(extractReceipt(['thank you'])).toEqual({ merchant: 'thank you', documentDate: undefined, total: undefined });
  });
  test('photos have no fields and never fail', () => {
    expect(extract('photo', ['anything'])).toEqual({ fields: [], keyDate: undefined, source: 'none', verified: false });
    expect(extract('generic-card', ['4111 1111 1111 1111']).fields).toEqual([]);
  });
});

describe('file validation', () => {
  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  test('supported types and size limit', () => {
    expect(fileProblem('a.pdf', 'application/pdf', 1000)).toBeNull();
    expect(fileProblem('a.heic', 'image/heic', 1000)).toBeNull();
    expect(fileProblem('a.docx', DOCX, 1000)).toBeNull();
    expect(fileProblem('a.exe', 'application/octet-stream', 1000)).toMatch(/not supported/);
    expect(fileProblem('big.pdf', 'application/pdf', 30 * 1024 * 1024)).toMatch(/25 MB/);
    expect(fileProblem('empty.pdf', 'application/pdf', 0)).toMatch(/empty or damaged/);
  });
  test('damaged or renamed files are detected from their content', () => {
    expect(contentProblem(PDF, 'application/pdf')).toBeNull();
    expect(contentProblem(JPG, 'application/pdf')).toMatch(/PDF file is damaged/);
    expect(contentProblem(PDF, 'image/jpeg')).toMatch(/image file is damaged/);
    expect(contentProblem(ZIP, DOCX)).toBeNull();
    expect(contentProblem(JPG, DOCX)).toMatch(/Word document is damaged/);
    expect(contentProblem(new Uint8Array(), 'application/pdf')).toMatch(/empty or damaged/);
  });
  test('keeps the original file name', () => {
    expect(nameFromFile('Insurance 2026.pdf', 'Document 1')).toBe('Insurance 2026');
    expect(nameFromFile(undefined, 'Document 1')).toBe('Document 1');
  });
});

describe('camera refuses pictures that are not documents', () => {
  test('two or more lines of real text count as a document', () => {
    expect(looksLikeDocument(['REPUBLIC OF THE PHILIPPINES', 'STUDENT ID 2026-0042'])).toBe(true);
    expect(looksLikeDocument(['ACME Corp', 'Employee', 'Ana Cruz'])).toBe(true);
  });
  test('a photo with no text, or only a word, is not a document', () => {
    expect(looksLikeDocument([])).toBe(false);
    expect(looksLikeDocument(['OK'])).toBe(false);
    expect(looksLikeDocument(['STOP', '..'])).toBe(false);
  });
});
