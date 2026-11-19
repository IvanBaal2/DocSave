import {
  checkDigit,
  describeDocument,
  emptyFields,
  extract,
  findMrz,
  mrzClean,
  parseBcbp,
  parseDate,
} from '../src/scan/extract';

const value = (fields: { key: string; value: string }[], key: string) => fields.find((f) => f.key === key)?.value;
const status = (fields: { key: string; status: string }[], key: string) => fields.find((f) => f.key === key)?.status;

// ICAO 9303 specimen documents (fictional "Utopia" data).
const TD3 = ['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10'];
const TD1 = ['I<UTOD231458907<<<<<<<<<<<<<<<', '7408122F1204159UTO<<<<<<<<<<<6', 'ERIKSSON<<ANNA<MARIA<<<<<<<<<<'];

describe('MRZ check digits', () => {
  test('ICAO examples', () => {
    expect(checkDigit('L898902C3')).toBe(6);
    expect(checkDigit('740812')).toBe(2);
    expect(checkDigit('120415')).toBe(9);
  });
});

describe('passport (TD3)', () => {
  test('parses the ICAO specimen with all check digits valid', () => {
    const r = findMrz(['PASSPORT', 'UTOPIA', ...TD3]);
    expect(r?.format).toBe('TD3');
    expect(r?.validChecks).toBe(3);
    expect(r?.fullName).toBe('Anna Maria Eriksson');
    expect(r?.documentNumber).toBe('L898902C3');
    expect(r?.dateOfBirth).toBe('1974-08-12');
    expect(r?.expiryDate).toBe('2012-04-15');
    expect(r?.sex).toBe('Female');
  });

  test('tolerates typical OCR noise (spaces, « for <, O for 0 in dates)', () => {
    const noisy = ['P<UTO ERIKSSON«ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO74O8122F12O4159ZE184226B<<<<<10'];
    const r = findMrz(noisy);
    expect(r?.dateOfBirth).toBe('1974-08-12');
    expect(r?.expiryDate).toBe('2012-04-15');
  });

  test('extract() fills fields and marks the rest missing (never invents)', () => {
    const e = extract('passport', TD3);
    expect(e.source).toBe('mrz');
    expect(e.verified).toBe(true);
    expect(value(e.fields, 'fullName')).toBe('Anna Maria Eriksson');
    expect(value(e.fields, 'documentNumber')).toBe('L898902C3');
    expect(value(e.fields, 'nationality')).toContain('UTO');
    expect(e.keyDate).toBe('2012-04-15');
    // Issue date is not in the MRZ and no label was printed → missing, not guessed.
    expect(status(e.fields, 'issueDate')).toBe('missing');
    expect(value(e.fields, 'issueDate')).toBe('');
  });

  test('picks up a labelled issue date from the visual zone', () => {
    const e = extract('passport', ['Date of issue / Date de délivrance', '15 APR/AVR 2002', ...TD3]);
    expect(value(e.fields, 'issueDate')).toBe('2002-04-15');
  });

  test('corrupted MRZ (failed check digits) is rejected', () => {
    const bad = [TD3[0], 'L898902C37UTO7408129F1204150ZE184226B<<<<<10'];
    expect(findMrz(bad)).toBeUndefined();
    const e = extract('passport', bad);
    expect(e.fields.every((f) => f.status === 'missing')).toBe(true);
  });
});

describe('ID card (TD1)', () => {
  test('parses three-line MRZ', () => {
    const e = extract('id-card', ['IDENTITY CARD', ...TD1]);
    expect(e.source).toBe('mrz');
    expect(value(e.fields, 'documentNumber')).toBe('D23145890');
    expect(value(e.fields, 'fullName')).toBe('Anna Maria Eriksson');
    expect(value(e.fields, 'dateOfBirth')).toBe('1974-08-12');
    expect(value(e.fields, 'expiryDate')).toBe('2012-04-15');
  });
});

describe('EU driving licence', () => {
  test('reads numbered fields', () => {
    const e = extract('licence', [
      'DRIVING LICENCE',
      '1. MUSTERMANN',
      '2. ERIKA',
      '3. 12.08.1974 BERLIN',
      '4a. 19.01.2013',
      '4b. 18.01.2028',
      '4c. Stadt Köln',
      '5. B072RRE2I55',
      '9. AM/B/L',
    ]);
    expect(value(e.fields, 'fullName')).toBe('ERIKA MUSTERMANN');
    expect(value(e.fields, 'dateOfBirth')).toBe('1974-08-12');
    expect(value(e.fields, 'issueDate')).toBe('2013-01-19');
    expect(value(e.fields, 'expiryDate')).toBe('2028-01-18');
    expect(value(e.fields, 'documentNumber')).toBe('B072RRE2I55');
    expect(value(e.fields, 'categories')).toBe('AM/B/L');
    expect(e.keyDate).toBe('2028-01-18');
  });
});

describe('boarding pass barcode (IATA BCBP)', () => {
  const sample = 'M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 326J001A0025 100';
  test('parses the standard example', () => {
    const bp = parseBcbp(sample, new Date(2026, 10, 19));
    expect(bp?.passengerName).toBe('Luc Desmarais');
    expect(bp?.bookingReference).toBe('ABC123');
    expect(bp?.from).toBe('YUL');
    expect(bp?.to).toBe('FRA');
    expect(bp?.flightNumber).toBe('AC834');
    expect(bp?.seat).toBe('1A');
    expect(bp?.travelDate).toBe('2026-11-22'); // day 326
  });

  test('extract() prefers barcode data', () => {
    const e = extract('boarding', ['BOARDING PASS'], sample);
    expect(e.source).toBe('barcode');
    expect(value(e.fields, 'from')).toBe('YUL');
  });

  test('rejects non-BCBP data', () => {
    expect(parseBcbp('https://example.com')).toBeUndefined();
  });
});

describe('tickets from printed text', () => {
  test('finds airline, flight, route, booking reference and date', () => {
    const e = extract('ticket', [
      'Ryanair',
      'Booking reference: QX7P2L',
      'Flight FR 1234',
      'MAD → DUB',
      'Passenger: Ana Garcia',
      'Departure 24/12/2026 07:15',
    ]);
    expect(value(e.fields, 'carrier')).toBe('Ryanair');
    expect(value(e.fields, 'flightNumber')).toBe('FR1234');
    expect(value(e.fields, 'from')).toBe('MAD');
    expect(value(e.fields, 'to')).toBe('DUB');
    expect(value(e.fields, 'bookingReference')).toBe('QX7P2L');
    expect(value(e.fields, 'passengerName')).toBe('Ana Garcia');
    expect(value(e.fields, 'travelDate')).toBe('2026-12-24');
  });

  test('unreadable ticket yields only missing fields', () => {
    const e = extract('ticket', ['~~~', '...']);
    expect(e.source).toBe('none');
    expect(e.fields.every((f) => f.status === 'missing')).toBe(true);
  });
});

describe('helpers', () => {
  test('date formats', () => {
    expect(parseDate('2032-04-15')).toBe('2032-04-15');
    expect(parseDate('15.04.2032')).toBe('2032-04-15');
    expect(parseDate('15 APR 2032')).toBe('2032-04-15');
    expect(parseDate('31/02/2030')).toBeUndefined();
  });

  test('mrzClean', () => {
    expect(mrzClean('p<uto eriksson «anna')).toBe('P<UTOERIKSSON<ANNA');
  });

  test('description is built from recognised values only', () => {
    const d = describeDocument('Passport', [
      { key: 'fullName', value: 'Anna Maria Eriksson' },
      { key: 'expiryDate', value: '2032-04-15' },
    ]);
    expect(d).toMatch(/^Passport · Anna Maria Eriksson · expires /);
    expect(describeDocument('Contract', [])).toBe('Contract');
  });

  test('templates start empty', () => {
    expect(emptyFields('passport').every((f) => f.status === 'missing' && f.value === '')).toBe(true);
  });
});

describe('ID front without MRZ', () => {
  test('reads only clearly labelled values', () => {
    const e = extract('id-card', [
      'NATIONAL IDENTITY CARD',
      'Date of birth',
      '12 08 1974',
      'Document No. CAX123456',
      'Valid until 01.02.2031',
    ]);
    expect(e.source).toBe('text');
    expect(value(e.fields, 'dateOfBirth')).toBe('1974-08-12');
    expect(value(e.fields, 'documentNumber')).toBe('CAX123456');
    expect(value(e.fields, 'expiryDate')).toBe('2031-02-01');
    expect(status(e.fields, 'fullName')).toBe('missing');
  });
});

import { assessSnapshot, screenRectToPhoto, similarity } from '../src/scan/capture';

describe('auto-capture decisions', () => {
  test('passport is captured as soon as a valid MRZ is visible', () => {
    const r = assessSnapshot({ kind: 'passport', sideIndex: 0, lines: ['PASSPORT', ...TD3], previousLines: null });
    expect(r.ready).toBe(true);
    expect(r.reason).toBe('mrz');
  });

  test('passport without MRZ keeps waiting (no premature capture)', () => {
    const lines = ['PASSPORT', 'UTOPIA', 'Surname ERIKSSON', 'Given names ANNA MARIA', 'Nationality UTOPIAN'];
    const r = assessSnapshot({ kind: 'passport', sideIndex: 0, lines, previousLines: lines });
    expect(r.ready).toBe(false);
  });

  test('ID front needs stable text across two snapshots', () => {
    const lines = ['IDENTITY CARD', 'ERIKSSON', 'ANNA MARIA', 'UTO', '12 08 1974'];
    expect(assessSnapshot({ kind: 'id-card', sideIndex: 0, lines, previousLines: null }).ready).toBe(false);
    expect(assessSnapshot({ kind: 'id-card', sideIndex: 0, lines, previousLines: lines }).ready).toBe(true);
    expect(
      assessSnapshot({ kind: 'id-card', sideIndex: 0, lines, previousLines: ['SOMETHING ELSE ENTIRELY', 'NOPE'] }).ready,
    ).toBe(false);
  });

  test('empty frame asks the user to place the document', () => {
    expect(assessSnapshot({ kind: 'generic', sideIndex: 0, lines: [], previousLines: null }).message).toMatch(/Place/);
  });

  test('similarity', () => {
    expect(similarity(['ABC DEF', 'GHI'], ['ABC DEF', 'GHI'])).toBe(1);
    expect(similarity([], ['A'])).toBe(0);
  });

  test('screen frame maps to photo coordinates with cover scaling', () => {
    // 3000x4000 photo shown on a 1000x2000 screen: scaled x0.5, 250px cropped on each side.
    const r = screenRectToPhoto({ x: 100, y: 800, w: 800, h: 400 }, { width: 1000, height: 2000 }, { width: 3000, height: 4000 }, 0);
    expect(r.x).toBeCloseTo((100 + 250) / 0.5 / 3000);
    expect(r.y).toBeCloseTo(800 / 0.5 / 4000);
    expect(r.w).toBeCloseTo(800 / 0.5 / 3000);
    expect(r.h).toBeCloseTo(400 / 0.5 / 4000);
  });
});

describe('real-world OCR robustness', () => {
  // Build a valid TD1 like a UAE Emirates ID: line 1 is filled with digits and has a single '<'.
  const doc = '104654881';
  const l1 = `ILARE${doc}${checkDigit(doc)}78419901234567<`;
  const dob = '900115';
  const exp = '290301';
  const l2body = `${dob}${checkDigit(dob)}M${exp}${checkDigit(exp)}PHL<<<<<<<<<<<`;
  const l2 = `${l2body}${checkDigit(l2body.slice(0, 29)) /* composite not validated */}`.slice(0, 30);
  const l3 = 'BAAL<<IVAN<LORENCE<<<<<<<<<<<<';

  test('TD1 whose first line contains almost no "<" is found', () => {
    expect(l1.length).toBe(30);
    const e = extract('id-card', ['UNITED ARAB EMIRATES', 'Resident Identity Card', l1, l2, l3]);
    expect(e.source).toBe('mrz');
    expect(value(e.fields, 'documentNumber')).toBe(doc);
    expect(value(e.fields, 'fullName')).toBe('Ivan Lorence Baal');
    expect(value(e.fields, 'dateOfBirth')).toBe('1990-01-15');
    expect(value(e.fields, 'expiryDate')).toBe('2029-03-01');
    expect(value(e.fields, 'nationality')).toContain('Philippines');
  });

  test('a stray line between MRZ lines is tolerated', () => {
    const e = extract('id-card', [l1, 'SIGNATURE', l2, l3]);
    expect(e.source).toBe('mrz');
  });

  test('"<<<" misread as "KKK" is corrected', () => {
    const noisy = TD3[0].replace(/<{3,}/g, (m) => 'K'.repeat(m.length));
    expect(findMrz([noisy, TD3[1]])?.fullName).toBe('Anna Maria Eriksson');
  });

  test('ID front reads labelled name, nationality and sex', () => {
    const e = extract('id-card', [
      'Resident Identity Card',
      'Name: Ivan Lorence Baal',
      'Nationality: Philippines',
      'Sex: M',
      'Date of Birth',
      '15/01/1990',
      'ID Number 784-1990-1234567-8',
    ]);
    expect(value(e.fields, 'fullName')).toBe('Ivan Lorence Baal');
    expect(value(e.fields, 'nationality')).toBe('Philippines');
    expect(value(e.fields, 'sex')).toBe('Male');
    expect(value(e.fields, 'dateOfBirth')).toBe('1990-01-15');
    expect(value(e.fields, 'documentNumber')).toBe('784-1990-1234567-8');
  });

  test('a name label followed by non-name text is not accepted', () => {
    const e = extract('id-card', ['Name', '12345 ABC 999']);
    expect(status(e.fields, 'fullName')).toBe('missing');
  });
});

describe('employee and student IDs', () => {
  test('reads name, number, organisation, role and validity', () => {
    const e = extract('org-id', [
      'Universidad Europea de Madrid',
      'STUDENT CARD',
      'Name: Ana Garcia Lopez',
      'Student ID: 22004587',
      'Course: Computer Engineering',
      'Valid until 31/08/2027',
    ]);
    expect(value(e.fields, 'fullName')).toBe('Ana Garcia Lopez');
    expect(value(e.fields, 'documentNumber')).toBe('22004587');
    expect(value(e.fields, 'organisation')).toBe('Universidad Europea de Madrid');
    expect(value(e.fields, 'role')).toBe('Computer Engineering');
    expect(value(e.fields, 'expiryDate')).toBe('2027-08-31');
    expect(e.holder).toBe('Ana Garcia Lopez');
  });

  test('employee badge without labels yields missing fields, not guesses', () => {
    const e = extract('org-id', ['ACME', 'JOHN', '0042']);
    expect(status(e.fields, 'fullName')).toBe('missing');
    expect(status(e.fields, 'organisation')).toBe('missing');
  });
});

describe('non-EU driving licences', () => {
  test('UAE style labelled licence', () => {
    const e = extract('licence', [
      'UNITED ARAB EMIRATES',
      'DRIVING LICENSE',
      'Name: Ivan Lorence Baal',
      'License No. 1234567',
      'Date of Birth 15-01-1990',
      'Issue Date 02-03-2022',
      'Expiry Date 01-03-2027',
      'Place of Issue Dubai',
    ]);
    expect(value(e.fields, 'fullName')).toBe('Ivan Lorence Baal');
    expect(value(e.fields, 'documentNumber')).toBe('1234567');
    expect(value(e.fields, 'dateOfBirth')).toBe('1990-01-15');
    expect(value(e.fields, 'issueDate')).toBe('2022-03-02');
    expect(value(e.fields, 'expiryDate')).toBe('2027-03-01');
    expect(value(e.fields, 'issuingAuthority')).toBe('Dubai');
  });

  test('Philippine style licence with separate name lines', () => {
    const e = extract('licence', [
      "DRIVER'S LICENSE",
      'Last Name', 'BAAL',
      'First Name', 'IVAN LORENCE',
      'License No. N01-12-345678',
      'Expiration Date 2028/01/15',
    ]);
    expect(value(e.fields, 'fullName')).toBe('IVAN LORENCE BAAL');
    expect(value(e.fields, 'documentNumber')).toBe('N01-12-345678');
    expect(value(e.fields, 'expiryDate')).toBe('2028-01-15');
  });
});

describe('cards and coupons', () => {
  test('loyalty card number comes from the barcode', () => {
    const e = extract('loyalty', ['Carrefour', 'MyClub', 'Member card'], '2900123456789');
    expect(value(e.fields, 'brand')).toBe('Carrefour');
    expect(value(e.fields, 'cardNumber')).toBe('2900123456789');
    expect(e.source).toBe('barcode');
  });

  test('gift card PIN, value and expiry', () => {
    const e = extract('giftcard', ['Amazon', 'Gift Card', 'Card number: 6011 2233 4455', 'PIN: 8821', '€50.00', 'Valid until 31/12/2027']);
    expect(value(e.fields, 'brand')).toBe('Amazon');
    expect(value(e.fields, 'cardNumber')).toBe('601122334455');
    expect(value(e.fields, 'pin')).toBe('8821');
    expect(value(e.fields, 'balance')).toBe('€50.00');
    expect(value(e.fields, 'expiryDate')).toBe('2027-12-31');
  });

  test('coupon code and offer', () => {
    const e = extract('coupon', ['Zara', '20% OFF your next order', 'Promo code: WINTER20', 'Expires 15/01/2027']);
    expect(value(e.fields, 'code')).toBe('WINTER20');
    expect(value(e.fields, 'offer')).toBe('20% OFF your next order');
    expect(value(e.fields, 'expiryDate')).toBe('2027-01-15');
  });
});
