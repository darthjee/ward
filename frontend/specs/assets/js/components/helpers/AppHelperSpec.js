import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AppHelper from '../../../../../assets/js/components/helpers/AppHelper.jsx';
import LoginModal from '../../../../../assets/js/components/common/loginModal/LoginModal.jsx';
import OwnerContextProvider from '../../../../../assets/js/components/common/ownerContext/OwnerContextProvider.jsx';
import Header from '../../../../../assets/js/components/common/header/Header.jsx';
import OrganizationNew from '../../../../../assets/js/components/resources/organizations/pages/OrganizationNew.jsx';
import OrganizationOverview from '../../../../../assets/js/components/resources/organizations/pages/OrganizationOverview.jsx';
import OrganizationEdit from '../../../../../assets/js/components/resources/organizations/pages/OrganizationEdit.jsx';
import NotFound from '../../../../../assets/js/components/common/notFound/NotFound.jsx';
import BankAccountList from '../../../../../assets/js/components/resources/bank/accounts/pages/BankAccountList.jsx';
import BankAccountNew from '../../../../../assets/js/components/resources/bank/accounts/pages/BankAccountNew.jsx';
import BankAccountEdit from '../../../../../assets/js/components/resources/bank/accounts/pages/BankAccountEdit.jsx';
import BankAccountDetail from '../../../../../assets/js/components/resources/bank/accounts/pages/BankAccountDetail.jsx';
import BankDebtList from '../../../../../assets/js/components/resources/bank/debts/pages/BankDebtList.jsx';
import BankDebtNew from '../../../../../assets/js/components/resources/bank/debts/pages/BankDebtNew.jsx';
import BankDebtEdit from '../../../../../assets/js/components/resources/bank/debts/pages/BankDebtEdit.jsx';
import BankDebtDetail from '../../../../../assets/js/components/resources/bank/debts/pages/BankDebtDetail.jsx';
import BankInvestmentList from '../../../../../assets/js/components/resources/bank/investments/pages/BankInvestmentList.jsx';
import BankInvestmentNew from '../../../../../assets/js/components/resources/bank/investments/pages/BankInvestmentNew.jsx';
import BankInvestmentEdit from '../../../../../assets/js/components/resources/bank/investments/pages/BankInvestmentEdit.jsx';
import BankInvestmentDetail from '../../../../../assets/js/components/resources/bank/investments/pages/BankInvestmentDetail.jsx';
import BankCalendarList from '../../../../../assets/js/components/resources/bank/calendar/pages/BankCalendarList.jsx';
import BankCalendarMonth from '../../../../../assets/js/components/resources/bank/calendar/pages/BankCalendarMonth.jsx';
import BankProviderList from '../../../../../assets/js/components/resources/bank/providers/pages/BankProviderList.jsx';
import BankProviderNew from '../../../../../assets/js/components/resources/bank/providers/pages/BankProviderNew.jsx';
import BankProviderEdit from '../../../../../assets/js/components/resources/bank/providers/pages/BankProviderEdit.jsx';
import BankProviderDetail from '../../../../../assets/js/components/resources/bank/providers/pages/BankProviderDetail.jsx';
import BankProviderAccountant from '../../../../../assets/js/components/resources/bank/providers/pages/BankProviderAccountant.jsx';
import BankBillNew from '../../../../../assets/js/components/resources/bank/bills/pages/BankBillNew.jsx';
import BankBillEdit from '../../../../../assets/js/components/resources/bank/bills/pages/BankBillEdit.jsx';
import HashRouteResolver from '../../../../../assets/js/utils/routing/HashRouteResolver.js';
import ModalRedirect from '../../../../../assets/js/components/common/ModalRedirect.jsx';
import ResetPasswordLanding from '../../../../../assets/js/components/resources/accounts/pages/ResetPasswordLanding.jsx';

describe('AppHelper', () => {
  const routeFor = (page) => ({ page, context: { kind: 'personal' } });

  const markupFor = (page) => renderToStaticMarkup(
    React.createElement('div', null, AppHelper.render(routeFor(page))),
  );

  const partsOf = (page) => {
    const [provider, loginModal] = AppHelper.render(routeFor(page)).props.children;
    const header = provider.props.children;
    const keyed = header.props.children;
    return {
      provider, header, keyed, page: keyed.props.children, loginModal,
    };
  };

  it('redirects the register key into the register-mode modal', () => {
    const { page } = partsOf('register');

    expect(page.type).toBe(ModalRedirect);
    expect(page.props.mode).toBe('register');
  });

  it('redirects the login key into the password-mode modal', () => {
    const { page } = partsOf('login');

    expect(page.type).toBe(ModalRedirect);
    expect(page.props.mode).toBe('password');
  });

  it('mounts the login modal alongside the header, route-independent', () => {
    expect(partsOf('home').loginModal.type).toBe(LoginModal);
    expect(partsOf('reset-password').loginModal.type).toBe(LoginModal);
  });

  it('wraps the header in the owner-context provider fed with the route', () => {
    const { provider, header } = partsOf('home');

    expect(provider.type).toBe(OwnerContextProvider);
    expect(provider.props.route).toEqual(routeFor('home'));
    expect(header.type).toBe(Header);
  });

  it('keys the page by the owner context', () => {
    expect(partsOf('home').keyed.key).toBe('personal');
    expect(AppHelper.render({ page: 'org-edit', context: { kind: 'organization', orgId: 5 } })
      .props.children[0].props.children.props.children.key).toBe('org-5');
  });

  [
    ['org-new', OrganizationNew],
    ['org-overview', OrganizationOverview],
    ['org-edit', OrganizationEdit],
    ['not-found', NotFound],
    ['bank-accounts', BankAccountList],
    ['bank-account-new', BankAccountNew],
    ['bank-account-edit', BankAccountEdit],
    ['bank-account', BankAccountDetail],
    ['bank-debts', BankDebtList],
    ['bank-debt-new', BankDebtNew],
    ['bank-debt-edit', BankDebtEdit],
    ['bank-debt', BankDebtDetail],
    ['bank-investments', BankInvestmentList],
    ['bank-investment-new', BankInvestmentNew],
    ['bank-investment-edit', BankInvestmentEdit],
    ['bank-investment', BankInvestmentDetail],
    ['bank-providers', BankProviderList],
    ['bank-calendar', BankCalendarList],
    ['bank-calendar-month', BankCalendarMonth],
    ['bank-provider-new', BankProviderNew],
    ['bank-provider-edit', BankProviderEdit],
    ['bank-provider', BankProviderDetail],
    ['bank-provider-accountant', BankProviderAccountant],
    ['bank-bill-new', BankBillNew],
    ['bank-bill-edit', BankBillEdit],
  ].forEach(([key, Page]) => {
    it(`maps the ${key} key to its page`, () => {
      expect(partsOf(key).page.type).toBe(Page);
    });
  });

  it('renders the Not-found view for a malformed organization id without any request', () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = jasmine.createSpy('fetch');

    try {
      const route = new HashRouteResolver(() => '#/orgs/abc').resolve();
      const markup = renderToStaticMarkup(React.createElement('div', null, AppHelper.render(route)));

      expect(markup).toContain('Not found');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('renders the reset-password landing for the reset-password key', () => {
    expect(partsOf('reset-password').page.type).toBe(ResetPasswordLanding);
  });

  it('falls back to the home page for the removed recover key', () => {
    expect(markupFor('recover')).toContain('Ward');
  });

  it('renders the admin users page for the admin-users key', () => {
    expect(markupFor('admin-users')).toContain('Admin Users');
  });

  it('renders the authorization requests page for the authorization-requests key', () => {
    expect(markupFor('authorization-requests')).toContain('Authorization Requests');
  });

  it('renders the home page for the home key', () => {
    expect(markupFor('home')).toContain('Ward');
  });

  it('falls back to the home page for an unknown key', () => {
    expect(markupFor('unknown')).toContain('Ward');
  });

  it('always renders the header', () => {
    expect(markupFor('home')).toContain('navbar');
  });
});
