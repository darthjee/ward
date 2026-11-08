import { sectionListPathFor, switchTargetFor } from '../../../../../assets/js/utils/routing/sectionTarget.js';
import { SECTIONS_CONTEXT } from '../../../../../assets/js/utils/routing/routes.js';

const PERSONAL = { kind: 'personal' };
const ORG_5 = { kind: 'organization', orgId: 5 };

describe('sectionTarget', () => {
  describe('SECTIONS_CONTEXT', () => {
    it('registers the bank accounts section', () => {
      expect(SECTIONS_CONTEXT).toContain(['/bank/accounts', '/bank/accounts']);
    });
  });

  describe('sectionListPathFor', () => {
    [
      '#/bank/accounts',
      '#/bank/accounts/',
      '#/bank/accounts/new',
      '#/bank/accounts/12',
      '#/bank/accounts/12/edit',
      '#/bank/accounts?archived=true',
      '#/orgs/3/bank/accounts/12/edit',
      '#/orgs/5/bank/accounts?archived=true',
      '/bank/accounts/12',
    ].forEach((hash) => {
      it(`maps ${hash} to the accounts list`, () => {
        expect(sectionListPathFor(hash)).toBe('/bank/accounts');
      });
    });

    [
      '#/bank/accountsx',
      '#/bank/accountsx/12',
      '#/bank',
      '#/account/my-account',
      '#/',
      '',
      '#/orgs/5',
      '#/orgs/abc/bank/accounts',
    ].forEach((hash) => {
      it(`returns null for ${JSON.stringify(hash)}`, () => {
        expect(sectionListPathFor(hash)).toBeNull();
      });
    });

    it('uses the first matching row of a custom registry', () => {
      const sections = [['/bank/debts', '/bank/debts'], ['/bank', '/bank/accounts']];

      expect(sectionListPathFor('#/orgs/2/bank/debts/4', sections)).toBe('/bank/debts');
      expect(sectionListPathFor('#/bank/other', sections)).toBe('/bank/accounts');
    });
  });

  describe('switchTargetFor', () => {
    it('lands on the Personal list from an organization edit page', () => {
      expect(switchTargetFor('#/orgs/3/bank/accounts/12/edit')(PERSONAL)).toBe('#/bank/accounts');
    });

    it('lands on the organization list and drops the query', () => {
      expect(switchTargetFor('#/bank/accounts?archived=true')(ORG_5)).toBe('#/orgs/5/bank/accounts');
    });

    it('lands on the landing page outside a section', () => {
      expect(switchTargetFor('#/account/my-account')(ORG_5)).toBe('#/orgs/5');
      expect(switchTargetFor('#/account/my-account')(PERSONAL)).toBe('#/');
    });

    it('lands on the landing page for an empty hash', () => {
      expect(switchTargetFor('')(ORG_5)).toBe('#/orgs/5');
    });
  });
});
