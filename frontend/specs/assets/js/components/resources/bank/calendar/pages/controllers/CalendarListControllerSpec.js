import CalendarListController, {
  dedupeUpcoming, groupByWeek,
} from '../../../../../../../../../assets/js/components/resources/bank/calendar/pages/controllers/CalendarListController.js';
import ApiError from '../../../../../../../../../assets/js/client/ApiError.js';

const CONTEXT = { kind: 'organization', orgId: 5 };

function occ(nominal, overrides = {}) {
  return {
    kind: 'debt', source_account: { id: 3 }, bill: null, nominal_date: nominal, effective_date: nominal, ...overrides,
  };
}

describe('CalendarListController', () => {
  describe('dedupeUpcoming', () => {
    it('drops occurrences already in Overdue', () => {
      const result = dedupeUpcoming(
        [occ('2026-11-14'), occ('2026-11-15'), occ('2026-11-14', { kind: 'bill', bill: { id: 1 } })],
        [occ('2026-11-14')],
      );

      expect(result.map((o) => o.nominal_date + o.kind)).toEqual(['2026-11-15debt', '2026-11-14bill']);
    });
  });

  describe('groupByWeek', () => {
    it('groups by Monday, a shifted weekend entry landing in the next week', () => {
      const groups = groupByWeek([
        occ('2026-11-13'),
        occ('2026-11-14', { effective_date: '2026-11-16' }),
        occ('2026-11-17'),
      ]);

      expect(groups.map((g) => g.weekStart)).toEqual(['2026-11-09', '2026-11-16']);
      expect(groups[1].occurrences.length).toEqual(2);
    });

    it('is empty for no occurrences', () => {
      expect(groupByWeek([])).toEqual([]);
    });
  });

  describe('load', () => {
    let client;
    let deps;
    let controller;

    beforeEach(() => {
      client = {
        getOverdue: jasmine.createSpy('getOverdue').and.resolveTo({ occurrences: [], totals: [] }),
        getCalendar: jasmine.createSpy('getCalendar').and.resolveTo({ occurrences: [], totals: [] }),
      };
      deps = {
        context: CONTEXT,
        setData: jasmine.createSpy('setData'),
        setError: jasmine.createSpy('setError'),
        setNotFound: jasmine.createSpy('setNotFound'),
        reload: jasmine.createSpy('reload'),
      };
      controller = new CalendarListController({ ...deps, client });
    });

    it('requests overdue and today..today+59', async () => {
      await controller.load(() => true, '2026-11-14');

      expect(client.getOverdue).toHaveBeenCalledWith(CONTEXT);
      expect(client.getCalendar).toHaveBeenCalledWith(CONTEXT, '2026-11-14', '2027-01-12');
      expect(deps.setData).toHaveBeenCalledWith({
        overdue: { occurrences: [], totals: [] }, upcoming: { occurrences: [], totals: [] },
      });
    });

    it('reports nothing when the session expired', async () => {
      client.getOverdue.and.resolveTo(undefined);
      await controller.load();

      expect(deps.setData).not.toHaveBeenCalled();
    });

    it('flags Not-found', async () => {
      client.getOverdue.and.rejectWith(new ApiError(404, 'x', 'NOT_FOUND'));
      await controller.load();

      expect(deps.setNotFound).toHaveBeenCalledWith(true);
    });

    it('reports an error with a retry', async () => {
      client.getCalendar.and.rejectWith(new Error('network'));
      await controller.load();

      expect(deps.setError.calls.mostRecent().args[0].retry).toBe(deps.reload);
    });

    it('drops a late answer', async () => {
      await controller.load(() => false);

      expect(deps.setData).not.toHaveBeenCalled();
    });
  });
});
