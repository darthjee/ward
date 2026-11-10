import {
  ACCOUNT_FIELDS, accountPath, nestedBody, whitelist,
} from '../../../../assets/js/client/accountBodies.js';

describe('accountBodies', () => {
  describe('whitelist', () => {
    it('keeps only allowed, defined keys and keeps null', () => {
      expect(whitelist({ name: 'A', notes: null, branch: undefined, user_id: 1 }, ACCOUNT_FIELDS))
        .toEqual({ name: 'A', notes: null });
    });

    it('returns an empty body for missing attributes', () => {
      expect(whitelist(undefined, ACCOUNT_FIELDS)).toEqual({});
    });
  });

  describe('nestedBody', () => {
    it('whitelists the nested object', () => {
      expect(nestedBody({ name: 'A', debt: { due_day: 3, x: 1 } }, 'debt', ['due_day']))
        .toEqual({ name: 'A', debt: { due_day: 3 } });
    });

    it('drops a null or missing nested object', () => {
      expect(nestedBody({ name: 'A', debt: null }, 'debt', ['due_day'])).toEqual({ name: 'A' });
      expect(nestedBody({ name: 'A' }, 'debt', ['due_day'])).toEqual({ name: 'A' });
    });
  });

  describe('accountPath', () => {
    it('builds the account path in both contexts', () => {
      expect(accountPath({ kind: 'personal' }, 3)).toEqual('/bank/accounts/3.json');
      expect(accountPath({ kind: 'organization', orgId: 5 }, 3, '/archive')).toEqual('/orgs/5/bank/accounts/3/archive.json');
    });
  });
});
