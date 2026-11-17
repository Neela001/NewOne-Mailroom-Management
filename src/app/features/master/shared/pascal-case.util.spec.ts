import { normalizeRowKeys, toCamelCase } from './pascal-case.util';

// Regression coverage for the live-confirmed finding: every master/admin
// entity's own /get response comes back PascalCase, including acronym
// fields like ISDCode — see pascal-case.util.ts's own comment for the full
// evidence (real backend, real account, 2026-10-16).
describe('toCamelCase', () => {
  it('converts ordinary PascalCase fields', () => {
    expect(toCamelCase('CountryId')).toBe('countryId');
    expect(toCamelCase('CountryCode')).toBe('countryCode');
    expect(toCamelCase('SoftwareDescription')).toBe('softwareDescription');
    expect(toCamelCase('IsActive')).toBe('isActive');
    expect(toCamelCase('HasState')).toBe('hasState');
  });

  it('is acronym-aware: ISDCode -> isdCode, not iSDCode', () => {
    expect(toCamelCase('ISDCode')).toBe('isdCode');
  });

  it('is a safe no-op on an already-camelCase key', () => {
    expect(toCamelCase('countryCode')).toBe('countryCode');
    expect(toCamelCase('isdCode')).toBe('isdCode');
  });
});

describe('normalizeRowKeys', () => {
  it('normalizes a real captured response row (master/country/get) to the app\'s own camelCase config keys', () => {
    const raw = {
      CountryId: '6efcc2ee-b0c0-f111-b823-d29547537b9d',
      CountryCode: 'IN',
      CountryName: 'India',
      ISDCode: '+91',
      HasState: true,
      HasCity: true,
      HasPostalCode: true,
      HasArea: true,
      StateLabel: 'State',
      PostalCodeLabel: 'Pincode',
      IsActive: true,
    };

    expect(normalizeRowKeys(raw)).toEqual({
      countryId: '6efcc2ee-b0c0-f111-b823-d29547537b9d',
      countryCode: 'IN',
      countryName: 'India',
      isdCode: '+91',
      hasState: true,
      hasCity: true,
      hasPostalCode: true,
      hasArea: true,
      stateLabel: 'State',
      postalCodeLabel: 'Pincode',
      isActive: true,
    });
  });
});
