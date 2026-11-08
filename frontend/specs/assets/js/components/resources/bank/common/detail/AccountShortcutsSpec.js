import React from 'react';
import AccountShortcuts from '../../../../../../../../assets/js/components/resources/bank/common/detail/AccountShortcuts.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const ACCOUNT = { id: 7, archived_at: null };
const IN = { direction: 'in', description: 'Application', amount: '' };
const OUT = { direction: 'out', description: 'Withdrawal', amount: '' };
const SHORTCUTS = [['Add application', 'outline-success', IN], ['Add withdrawal', 'outline-danger', OUT]];

describe('AccountShortcuts', () => {
  let onStartNew;

  beforeEach(() => {
    onStartNew = jasmine.createSpy('onStartNew');
  });

  function props(overrides = {}) {
    return {
      account: ACCOUNT, shortcuts: SHORTCUTS, onStartNew, ...overrides,
    };
  }

  it('renders the buttons in order, then the children', () => {
    const page = renderedOutput(React.createElement(
      AccountShortcuts, props(), React.createElement('p', { key: 'x' }, 'EXTRA'),
    ));

    expect(page.containsInOrder('Add application', 'Add withdrawal', 'EXTRA')).toBeTrue();
    expect(page.contains('btn-outline-success')).toBeTrue();
  });

  it('opens the inline form with each preset', () => {
    const [buttons] = AccountShortcuts(props()).props.children;

    buttons[0].props.onClick();
    buttons[1].props.onClick();

    expect(onStartNew.calls.allArgs()).toEqual([[IN], [OUT]]);
  });

  it('is hidden on an archived account', () => {
    expect(renderedOutput(React.createElement(AccountShortcuts, props({
      account: { ...ACCOUNT, archived_at: '2026-02-01T00:00:00.000Z' },
    }), 'EXTRA')).isEmpty()).toBeTrue();
  });
});
