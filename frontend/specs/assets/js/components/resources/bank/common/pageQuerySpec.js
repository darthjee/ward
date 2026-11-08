import { pageFromHash } from '../../../../../../../assets/js/components/resources/bank/common/pageQuery.js';

describe('pageFromHash', () => {
  [
    ['#/bank/accounts/12', 1],
    ['#/bank/accounts/12?page=3', 3],
    ['#/orgs/5/bank/accounts/12?page=7', 7],
    ['#/bank/accounts/12?page=', 1],
    ['#/bank/accounts/12?page=0', 1],
    ['#/bank/accounts/12?page=-2', 1],
    ['#/bank/accounts/12?page=abc', 1],
    ['#/bank/accounts/12?page=1.5', 1],
    ['#/bank/accounts/12?page=007', 1],
    ['#/bank/accounts/12?page=99999999999999999999', 1],
    ['', 1],
    [undefined, 1],
  ].forEach(([hash, page]) => {
    it(`reads ${page} from ${JSON.stringify(hash)}`, () => {
      expect(pageFromHash(hash)).toBe(page);
    });
  });
});
