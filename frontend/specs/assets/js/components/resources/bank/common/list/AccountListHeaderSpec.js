import React from 'react';
import AccountListHeader from '../../../../../../../../assets/js/components/resources/bank/common/list/AccountListHeader.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

function output(props = {}) {
  return renderedOutput(React.createElement(AccountListHeader, {
    title: 'Debts', base: '/bank/debts', context: { kind: 'personal' }, archived: false, newLabel: 'New debt', canCreate: true, ...props,
  }));
}

describe('AccountListHeader', () => {
  it('renders the title, the archived toggle and the create button', () => {
    const page = output();

    expect(page.containsElement('h1', 'Debts')).toBeTrue();
    expect(page.containsInOrder('href="#/bank/debts?archived=true"', 'Show archived')).toBeTrue();
    expect(page.containsInOrder('href="#/bank/debts/new"', 'New debt')).toBeTrue();
  });

  it('hides the create button without the create permission, keeping the toggle and extras', () => {
    const page = output({
      canCreate: false,
      children: React.createElement('a', { href: '#/bank/debts/extra' }, 'Extra link'),
    });

    expect(page.contains('New debt')).toBeFalse();
    expect(page.containsAttribute('href', '#/bank/debts/new')).toBeFalse();
    expect(page.contains('Show archived')).toBeTrue();
    expect(page.contains('Extra link')).toBeTrue();
  });

  it('hides archived rows again from the toggle', () => {
    expect(output({ archived: true }).containsInOrder('href="#/bank/debts"', 'Hide archived')).toBeTrue();
  });

  it('builds the links under an organization', () => {
    const page = output({ context: { kind: 'organization', orgId: 5 } });

    expect(page.containsAttribute('href', '#/orgs/5/bank/debts?archived=true')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/bank/debts/new')).toBeTrue();
  });

  it('renders extra links beside the create button', () => {
    const page = output({ children: React.createElement('a', { href: '#/bank/debts/extra' }, 'Extra link') });

    expect(page.containsInOrder('Show archived', 'Extra link', 'New debt')).toBeTrue();
  });
});
