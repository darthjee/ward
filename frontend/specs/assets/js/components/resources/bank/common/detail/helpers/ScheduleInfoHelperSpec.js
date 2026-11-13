import ScheduleInfoHelper from '../../../../../../../../../assets/js/components/resources/bank/common/detail/helpers/ScheduleInfoHelper.jsx';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

describe('ScheduleInfoHelper', () => {
  it('renders the three schedule values', () => {
    const page = renderedOutput(ScheduleInfoHelper.render({
      bills_from: '2026-02-01', show_in_calendar: true, paying_account: { id: 1, name: 'Main' },
    }));

    expect(page.containsInOrder('Bills from', '2026-02-01', 'Show in Calendar', 'Yes', 'Default paying account', 'Main'))
      .toBeTrue();
  });

  it('shows No when hidden from the Calendar', () => {
    expect(renderedOutput(ScheduleInfoHelper.render({ show_in_calendar: false })).containsInOrder('Show in Calendar', 'No'))
      .toBeTrue();
  });

  it('shows dashes without a nested object', () => {
    expect(renderedOutput(ScheduleInfoHelper.render(null)).containsInOrder('Bills from', '—', 'Default paying account', '—'))
      .toBeTrue();
  });

  it('escapes the paying account name', () => {
    const page = renderedOutput(ScheduleInfoHelper.render({ paying_account: { id: 1, name: '<script>x</script>' } }));

    expect(page.containsTag('script')).toBeFalse();
    expect(page.contains('&lt;script&gt;x&lt;/script&gt;')).toBeTrue();
  });
});
