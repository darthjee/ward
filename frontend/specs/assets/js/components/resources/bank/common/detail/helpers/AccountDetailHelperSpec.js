import React from 'react';
import AccountDetailHelper from '../../../../../../../../../assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelper.jsx';
import { initialLedgerForm } from '../../../../../../../../../assets/js/components/resources/bank/common/detail/hooks/useLedgerForm.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const ACCOUNT = {
  id: 3, name: 'Thing', currency: 'BRL', balance: '1.00', archived_at: null,
};
const LEDGER = {
  transactions: [],
  opening: { date: '2026-01-01', amount: '1.00', balance: '1.00' },
  pagination: {
    page: 1, per_page: 50, total_pages: 1, total_count: 0,
  },
};
const noop = () => undefined;
const HANDLERS = new Proxy({}, { get: () => noop });

function state(overrides = {}) {
  return {
    context: { kind: 'personal' },
    accountId: '3',
    page: 1,
    data: { account: ACCOUNT, ledger: LEDGER },
    loadError: null,
    error: null,
    form: initialLedgerForm('2026-05-10'),
    actionPending: null,
    confirmation: null,
    ...overrides,
  };
}

describe('AccountDetailHelper', () => {
  let options;

  beforeEach(() => {
    options = {
      base: '/bank/things',
      backLabel: 'Things',
      renderHeader: jasmine.createSpy('renderHeader').and.returnValue(React.createElement('h1', null, 'HEADER')),
    };
  });

  it('links back to the section list with its label', () => {
    expect(renderedOutput(AccountDetailHelper.render(state(), HANDLERS, options))
      .containsInOrder('href="#/bank/things"', '← Things')).toBeTrue();
  });

  it('renders the section header with the has-transactions signal', () => {
    renderedOutput(AccountDetailHelper.render(state(), HANDLERS, options));

    expect(options.renderHeader).toHaveBeenCalledWith({
      account: ACCOUNT, hasTransactions: false, actionPending: null, context: { kind: 'personal' },
    }, HANDLERS);
  });

  it('renders the shortcuts slot between the Ledger heading and the inline form', () => {
    const renderShortcuts = jasmine.createSpy('renderShortcuts').and.returnValue(React.createElement('p', null, 'SHORTCUTS'));
    const page = renderedOutput(AccountDetailHelper.render(state(), HANDLERS, { ...options, renderShortcuts }));

    expect(page.containsInOrder('HEADER', 'Ledger', 'SHORTCUTS', 'New transaction')).toBeTrue();
    expect(renderShortcuts).toHaveBeenCalledWith(ACCOUNT, HANDLERS);
  });

  it('renders without shortcuts', () => {
    expect(renderedOutput(AccountDetailHelper.render(state(), HANDLERS, options)).containsInOrder('Ledger', 'New transaction'))
      .toBeTrue();
  });

  it('links the empty page back to page 1 under the section base', () => {
    const page = renderedOutput(AccountDetailHelper.render(state({
      page: 3, data: { account: ACCOUNT, ledger: { ...LEDGER, opening: null } },
    }), HANDLERS, options));

    expect(page.containsAttribute('href', '#/bank/things/3?page=1')).toBeTrue();
  });
});
