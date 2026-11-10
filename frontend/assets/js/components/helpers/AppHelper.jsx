import { Fragment } from 'react';
import Header from '../common/header/Header.jsx';
import LoginModal from '../common/loginModal/LoginModal.jsx';
import ModalRedirect from '../common/ModalRedirect.jsx';
import OwnerContextProvider from '../common/ownerContext/OwnerContextProvider.jsx';
import Home from '../resources/home/pages/Home.jsx';
import ResetPasswordLanding from '../resources/accounts/pages/ResetPasswordLanding.jsx';
import AdminUsers from '../resources/admin/pages/AdminUsers.jsx';
import AdminUserEdit from '../resources/admin/pages/AdminUserEdit.jsx';
import AuthorizationRequests from '../resources/accounts/pages/AuthorizationRequests.jsx';
import MyAccount from '../resources/accounts/pages/MyAccount.jsx';
import OrganizationNew from '../resources/organizations/pages/OrganizationNew.jsx';
import OrganizationOverview from '../resources/organizations/pages/OrganizationOverview.jsx';
import OrganizationEdit from '../resources/organizations/pages/OrganizationEdit.jsx';
import NotFound from '../common/notFound/NotFound.jsx';
import BankAccountList from '../resources/bank/accounts/pages/BankAccountList.jsx';
import BankAccountNew from '../resources/bank/accounts/pages/BankAccountNew.jsx';
import BankAccountEdit from '../resources/bank/accounts/pages/BankAccountEdit.jsx';
import BankAccountDetail from '../resources/bank/accounts/pages/BankAccountDetail.jsx';
import BankDebtList from '../resources/bank/debts/pages/BankDebtList.jsx';
import BankDebtNew from '../resources/bank/debts/pages/BankDebtNew.jsx';
import BankDebtEdit from '../resources/bank/debts/pages/BankDebtEdit.jsx';
import BankDebtDetail from '../resources/bank/debts/pages/BankDebtDetail.jsx';
import BankInvestmentList from '../resources/bank/investments/pages/BankInvestmentList.jsx';
import BankInvestmentNew from '../resources/bank/investments/pages/BankInvestmentNew.jsx';
import BankInvestmentEdit from '../resources/bank/investments/pages/BankInvestmentEdit.jsx';
import BankInvestmentDetail from '../resources/bank/investments/pages/BankInvestmentDetail.jsx';
import BankProviderList from '../resources/bank/providers/pages/BankProviderList.jsx';
import BankProviderNew from '../resources/bank/providers/pages/BankProviderNew.jsx';
import BankProviderEdit from '../resources/bank/providers/pages/BankProviderEdit.jsx';
import BankProviderDetail from '../resources/bank/providers/pages/BankProviderDetail.jsx';
import BankProviderAccountant from '../resources/bank/providers/pages/BankProviderAccountant.jsx';

const PAGES = new Map([
  ['register', <ModalRedirect mode="register" />],
  ['login', <ModalRedirect mode="password" />],
  ['reset-password', <ResetPasswordLanding />],
  ['admin-users', <AdminUsers />],
  ['admin-user-edit', <AdminUserEdit />],
  ['authorization-requests', <AuthorizationRequests />],
  ['my-account', <MyAccount />],
  ['org-new', <OrganizationNew />],
  ['org-overview', <OrganizationOverview />],
  ['org-edit', <OrganizationEdit />],
  ['bank-accounts', <BankAccountList />],
  ['bank-account-new', <BankAccountNew />],
  ['bank-account-edit', <BankAccountEdit />],
  ['bank-account', <BankAccountDetail />],
  ['bank-debts', <BankDebtList />],
  ['bank-debt-new', <BankDebtNew />],
  ['bank-debt-edit', <BankDebtEdit />],
  ['bank-debt', <BankDebtDetail />],
  ['bank-investments', <BankInvestmentList />],
  ['bank-investment-new', <BankInvestmentNew />],
  ['bank-investment-edit', <BankInvestmentEdit />],
  ['bank-investment', <BankInvestmentDetail />],
  ['bank-providers', <BankProviderList />],
  ['bank-provider-new', <BankProviderNew />],
  ['bank-provider-edit', <BankProviderEdit />],
  ['bank-provider-accountant', <BankProviderAccountant />],
  ['bank-provider', <BankProviderDetail />],
  ['not-found', <NotFound />],
  ['home', <Home />],
]);

/**
 * Build a React key for an owner context, so a page is remounted (fresh state, fresh fetch) when
 * the context changes, e.g. from one organization to another.
 *
 * @param {object} context - The owner context.
 * @returns {string} `personal` or `org-<id>`.
 */
function contextKey(context) {
  return context?.kind === 'organization' ? `org-${context.orgId}` : 'personal';
}

/**
 * Helper for application page rendering: maps a page key to its component.
 * Follows the object-module convention: a plain exported object whose public methods are
 * the only entry points.
 */
const AppHelper = {
  /**
   * Render the app shell wrapping the page matching the given route, plus the route-independent
   * login modal. The header and page are wrapped in the {@link OwnerContextProvider}, fed with
   * the route. The page is keyed by the owner context, so switching contexts remounts it.
   * Unknown page keys fall back to the home page.
   *
   * @param {{page: string, context: object}} route - Current route (page key and owner context).
   * @returns {React.ReactElement} The rendered app shell.
   */
  render(route) {
    return (
      <>
        <OwnerContextProvider route={route}>
          <Header>
            <Fragment key={contextKey(route.context)}>
              {PAGES.get(route.page) ?? PAGES.get('home')}
            </Fragment>
          </Header>
        </OwnerContextProvider>
        <LoginModal />
      </>
    );
  },
};

export default AppHelper;
