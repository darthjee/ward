import { pageWindow } from '../../../../../../../assets/js/components/resources/bank/common/pageWindow.js';

describe('pageWindow', () => {
  [
    [1, 1, [1]],
    [1, 10, [1, 2, 3]],
    [2, 10, [1, 2, 3, 4]],
    [5, 10, [3, 4, 5, 6, 7]],
    [10, 10, [8, 9, 10]],
    [3, 4, [1, 2, 3, 4]],
    [20, 10, [8, 9, 10]],
    [0, 10, [1, 2, 3]],
  ].forEach(([page, total, expected]) => {
    it(`shows ${expected} for page ${page} of ${total}`, () => {
      expect(pageWindow(page, total)).toEqual(expected);
    });
  });

  it('accepts a custom radius', () => {
    expect(pageWindow(5, 10, 1)).toEqual([4, 5, 6]);
  });

  it('is empty without pages', () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });
});
