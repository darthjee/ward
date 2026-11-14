import CalendarMonthController, { entriesByDay } from '../../../../../../../../../assets/js/components/resources/bank/calendar/pages/controllers/CalendarMonthController.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

const CONTEXT = { kind: 'organization', orgId: 5 };

describe('CalendarMonthController', () => {
  it('groups entries by effective date', () => {
    const byDay = entriesByDay([
      { effective_date: '2026-11-02', id: 1 }, { effective_date: '2026-11-03', id: 2 }, { effective_date: '2026-11-02', id: 3 },
    ]);

    expect([...byDay.keys()]).toEqual(['2026-11-02', '2026-11-03']);
    expect(byDay.get('2026-11-02').map((o) => o.id)).toEqual([1, 3]);
  });

  describe('load', () => {
    let client;
    let deps;
    let controller;

    beforeEach(() => {
      client = { getCalendar: jasmine.createSpy('getCalendar').and.resolveTo({ occurrences: [], totals: [] }) };
      deps = {
        context: CONTEXT,
        setData: jasmine.createSpy('setData'),
        setError: jasmine.createSpy('setError'),
        setNotFound: jasmine.createSpy('setNotFound'),
        reload: jasmine.createSpy('reload'),
      };
      controller = new CalendarMonthController({ ...deps, client });
    });

    [['a 30-day month', '2026-11', '2026-11-30'], ['a 31-day month', '2026-12', '2026-12-31'], ['February', '2026-02', '2026-02-28']]
      .forEach(([label, month, last]) => {
        it(`requests the whole range of ${label}`, async () => {
          await controller.load(month);

          expect(client.getCalendar).toHaveBeenCalledOnceWith(CONTEXT, `${month}-01`, last);
          expect(deps.setData).toHaveBeenCalledWith({ occurrences: [], totals: [], month });
        });
      });

    it('flags Not-found', async () => {
      client.getCalendar.and.rejectWith(new ApiError(404, 'x', 'NOT_FOUND'));
      await controller.load('2026-11');

      expect(deps.setNotFound).toHaveBeenCalledWith(true);
    });

    it('reports an error with a retry', async () => {
      client.getCalendar.and.rejectWith(new Error('network'));
      await controller.load('2026-11');

      expect(deps.setError.calls.mostRecent().args[0].retry).toBe(deps.reload);
    });

    it('ignores a stale answer', async () => {
      await controller.load('2026-11', () => false);

      expect(deps.setData).not.toHaveBeenCalled();
    });
  });
});
