import React from 'react';
import AccountHeaderHelper, {
  ARCHIVED_BANNER,
} from '../../../../../../../../../assets/js/components/resources/bank/common/detail/helpers/AccountHeaderHelper.jsx';
import { formatMoney } from '../../../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

const ACCOUNT = {
  id: 7, name: 'Car loan', currency: 'BRL', balance: '-9500.00', archived_at: null,
};
const noop = () => undefined;
const HANDLERS = { onArchive: noop, onUnarchive: noop, onDeleteAccount: noop };

function output(state = {}, account = {}) {
  return renderedOutput(AccountHeaderHelper.render({
    account: { ...ACCOUNT, ...account },
    hasTransactions: false,
    actionPending: null,
    context: { kind: 'personal' },
    base: '/bank/debts',
    details: React.createElement('p', null, 'Debt info'),
    ...state,
  }, HANDLERS));
}

describe('AccountHeaderHelper', () => {
  it('renders the name, the balance, then the section details', () => {
    expect(output().containsInOrder('Car loan', formatMoney('-9500.00', 'BRL'), 'Debt info')).toBeTrue();
  });

  it('links Edit under the given section base, in both contexts', () => {
    expect(output().containsAttribute('href', '#/bank/debts/7/edit')).toBeTrue();
    expect(output({ context: { kind: 'organization', orgId: 5 } }).containsAttribute('href', '#/orgs/5/bank/debts/7/edit'))
      .toBeTrue();
    expect(output({ base: '/bank/accounts' }).containsAttribute('href', '#/bank/accounts/7/edit')).toBeTrue();
  });

  it('shows the banner, Rename and Unarchive when archived', () => {
    const page = output({}, { archived_at: '2026-02-01T00:00:00.000Z' });

    expect(page.contains(ARCHIVED_BANNER)).toBeTrue();
    expect(page.contains('>Rename<')).toBeTrue();
    expect(page.contains('>Unarchive<')).toBeTrue();
    expect(page.contains('>Delete<')).toBeFalse();
  });

  it('shows Delete only for an active account without transactions', () => {
    expect(output().contains('>Delete<')).toBeTrue();
    expect(output({ hasTransactions: true }).contains('>Delete<')).toBeFalse();
  });

  it('renders without a details block', () => {
    expect(output({ details: null }).contains('Car loan')).toBeTrue();
  });

  it('escapes the name', () => {
    expect(output({}, { name: '<img src=x>' }).containsTag('img')).toBeFalse();
  });
});
