import {
  MAX_ORG_ID,
  PERSONAL,
  contextHash,
  contextPath,
  isSameContext,
  landingFor,
  organizationContext,
  parseOrgId,
} from '../../../../../assets/js/utils/context/ownerContext.js';

describe('ownerContext', () => {
  const org = organizationContext(5);

  describe('PERSONAL', () => {
    it('is the frozen personal context', () => {
      expect(PERSONAL).toEqual({ kind: 'personal' });
      expect(Object.isFrozen(PERSONAL)).toBe(true);
    });
  });

  describe('organizationContext', () => {
    it('builds an organization context', () => {
      expect(org).toEqual({ kind: 'organization', orgId: 5 });
    });
  });

  describe('parseOrgId', () => {
    it('parses a valid id', () => {
      expect(parseOrgId('5')).toBe(5);
      expect(parseOrgId('120')).toBe(120);
    });

    it('accepts the max boundary', () => {
      expect(MAX_ORG_ID).toBe(2147483647);
      expect(parseOrgId('2147483647')).toBe(2147483647);
    });

    it('rejects one above the max boundary', () => {
      expect(parseOrgId('2147483648')).toBeNull();
    });

    ['abc', '007', '-1', '1.5', '1e3', '99999999999', '0', '', ' 5', '5 '].forEach((segment) => {
      it(`rejects the malformed id ${JSON.stringify(segment)}`, () => {
        expect(parseOrgId(segment)).toBeNull();
      });
    });

    it('rejects non-string values', () => {
      expect(parseOrgId(null)).toBeNull();
      expect(parseOrgId(undefined)).toBeNull();
      expect(parseOrgId(5)).toBeNull();
    });
  });

  describe('contextPath', () => {
    it('returns the API path unchanged for Personal', () => {
      expect(contextPath(PERSONAL, '/x/y.json')).toBe('/x/y.json');
    });

    it('prefixes the API path for an organization', () => {
      expect(contextPath(org, '/x/y.json')).toBe('/orgs/5/x/y.json');
    });
  });

  describe('contextHash', () => {
    it('builds a Personal hash', () => {
      expect(contextHash(PERSONAL, '/bank/accounts')).toBe('#/bank/accounts');
    });

    it('builds an organization hash', () => {
      expect(contextHash(org, '/bank/accounts')).toBe('#/orgs/5/bank/accounts');
    });

    it('builds the Personal root hash', () => {
      expect(contextHash(PERSONAL, '/')).toBe('#/');
    });

    it('builds the organization root hash without a trailing slash', () => {
      expect(contextHash(org, '/')).toBe('#/orgs/5');
    });
  });

  describe('landingFor', () => {
    it('lands Personal on #/', () => {
      expect(landingFor(PERSONAL)).toBe('#/');
    });

    it('lands an organization on #/orgs/<id>', () => {
      expect(landingFor(org)).toBe('#/orgs/5');
    });
  });

  describe('isSameContext', () => {
    it('matches two Personal contexts', () => {
      expect(isSameContext(PERSONAL, { kind: 'personal' })).toBe(true);
    });

    it('matches the same organization', () => {
      expect(isSameContext(org, organizationContext(5))).toBe(true);
    });

    it('does not match different organizations', () => {
      expect(isSameContext(org, organizationContext(6))).toBe(false);
    });

    it('does not match Personal and an organization', () => {
      expect(isSameContext(PERSONAL, org)).toBe(false);
    });

    it('does not match a missing context', () => {
      expect(isSameContext(undefined, PERSONAL)).toBe(false);
    });
  });
});
