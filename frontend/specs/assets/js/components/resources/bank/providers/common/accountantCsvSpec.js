import {
  ACCOUNTANT_CSV_HEADER, CSV_BOM, accountantCsvFilename, buildAccountantCsv,
} from '../../../../../../../../assets/js/components/resources/bank/providers/common/accountantCsv.js';

const HEADER_LINE = '"Date","Account","Provider","Provider tax id","Description","Amount","Currency"\r\n';

function charge(overrides = {}, account = {}) {
  return {
    id: 1,
    date: '2026-02-05',
    description: 'Internet Feb',
    amount: '-129.90',
    sent_to_accountant_at: null,
    ...overrides,
    account: {
      id: 4, name: 'Office ISP', bank_name: 'Fiber Co', provider_tax_id: '12.345/0001-90', currency: 'BRL', ...account,
    },
  };
}

function rows(csv) {
  return csv.slice(CSV_BOM.length).split('\r\n');
}

describe('accountantCsv', () => {
  it('defines the seven English header columns', () => {
    expect(ACCOUNTANT_CSV_HEADER).toEqual(['Date', 'Account', 'Provider', 'Provider tax id', 'Description', 'Amount', 'Currency']);
  });

  it('starts with the UTF-8 BOM and the header row', () => {
    const csv = buildAccountantCsv([charge()]);

    expect(csv.startsWith('\uFEFF')).toBeTrue();
    expect(csv.slice(1).startsWith(HEADER_LINE)).toBeTrue();
  });

  it('writes one quoted row per charge, CRLF-terminated, in order', () => {
    const csv = buildAccountantCsv([charge(), charge({ id: 2, date: '2026-02-10', description: 'Rent', amount: '-2000.00' })]);

    expect(rows(csv)).toEqual([
      HEADER_LINE.slice(0, -2),
      '"2026-02-05","Office ISP","Fiber Co","12.345/0001-90","Internet Feb","-129.90","BRL"',
      '"2026-02-10","Office ISP","Fiber Co","12.345/0001-90","Rent","-2000.00","BRL"',
      '',
    ]);
  });

  it('doubles embedded quotes', () => {
    expect(buildAccountantCsv([charge({ description: 'The "big" one' })])).toContain('"The ""big"" one"');
  });

  it('keeps commas and newlines inside a quoted description', () => {
    expect(buildAccountantCsv([charge({ description: 'a, b\nc' })])).toContain('"a, b\nc"');
  });

  [['=', '=SUM(A1)'], ['+', '+1'], ['-', '-2'], ['@', '@cmd'], ['tab', '\tx'], ['CR', '\rx']].forEach(([label, value]) => {
    it(`prefixes a text cell starting with ${label} in every text column`, () => {
      const csv = buildAccountantCsv([charge({ description: value }, { name: value, bank_name: value, provider_tax_id: value })]);
      const cell = `"'${value}"`;

      expect(csv).toContain(`"2026-02-05",${cell},${cell},${cell},${cell},"-129.90","BRL"`);
    });
  });

  it('does not prefix a text cell with the trigger characters elsewhere', () => {
    expect(buildAccountantCsv([charge({ description: 'a=b-c' })])).toContain('"a=b-c"');
  });

  it('leaves the amount unprefixed, negative or positive', () => {
    expect(buildAccountantCsv([charge({ amount: '-0.01' })])).toContain(',"-0.01","BRL"');
    expect(buildAccountantCsv([charge({ amount: '1500' })])).toContain(',"1500","BRL"');
  });

  it('writes an empty quoted field for a missing provider or tax id', () => {
    expect(buildAccountantCsv([charge({}, { bank_name: null, provider_tax_id: '' })]))
      .toContain('"2026-02-05","Office ISP","","","Internet Feb"');
  });

  it('keeps each row in its own currency', () => {
    const csv = buildAccountantCsv([charge(), charge({ id: 2, amount: '-1500' }, { currency: 'JPY' })]);

    expect(csv).toContain('"-129.90","BRL"');
    expect(csv).toContain('"-1500","JPY"');
  });

  it('tolerates a charge without its account', () => {
    expect(buildAccountantCsv([{ date: '2026-02-05', description: 'x', amount: '-1' }])).toContain('"2026-02-05","","","","x","-1",""');
  });

  it('writes only the BOM and the header for an empty list', () => {
    expect(buildAccountantCsv([])).toBe(`\uFEFF${HEADER_LINE}`);
    expect(buildAccountantCsv(undefined)).toBe(`\uFEFF${HEADER_LINE}`);
  });

  it('names the file after the range', () => {
    expect(accountantCsvFilename('2026-02-01', '2026-02-28')).toBe('ward-accountant-2026-02-01-2026-02-28.csv');
  });
});
