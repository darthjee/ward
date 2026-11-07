import { IsNull } from 'typeorm';
import { ownerWhere } from '../owner-context.js';

describe('ownerWhere', () => {
  describe('for a user owner', () => {
    it('filters by the user and requires no organization', () => {
      expect(ownerWhere({ kind: 'user', userId: 7 })).toEqual({ userId: 7, organizationId: IsNull() });
    });
  });

  describe('for an organization owner', () => {
    it('filters by the organization and requires no user', () => {
      expect(ownerWhere({ kind: 'organization', organizationId: 3 })).toEqual({
        userId: IsNull(),
        organizationId: 3,
      });
    });
  });
});
