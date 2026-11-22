import React from 'react';
import ProviderBills from '../../../../../../../../assets/js/components/resources/bank/providers/common/ProviderBills.jsx';
import ProviderBillsHelper from '../../../../../../../../assets/js/components/resources/bank/providers/common/helpers/ProviderBillsHelper.jsx';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const CONTEXT = { kind: 'organization', orgId: 5 };
const ACCOUNT = { id: 7, currency: 'BRL', archived_at: null };

function renderWithRole(role) {
  return renderedOutput(React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, context: CONTEXT, role } },
    React.createElement(ProviderBills, { context: CONTEXT, account: ACCOUNT }),
  ));
}

describe('ProviderBills', () => {
  it('renders the helper with the account and the context', () => {
    spyOn(ProviderBillsHelper, 'render').and.returnValue(React.createElement('div', null, 'bills'));

    expect(renderWithRole('owner').contains('bills')).toBeTrue();
    expect(ProviderBillsHelper.render).toHaveBeenCalledWith(
      jasmine.objectContaining({ account: ACCOUNT, context: CONTEXT }),
      jasmine.any(Object),
    );
  });

  ['owner', 'admin', 'user'].forEach((role) => {
    it(`passes the delete permission of a ${role}`, () => {
      spyOn(ProviderBillsHelper, 'render').and.returnValue(React.createElement('div'));

      renderWithRole(role);

      expect(ProviderBillsHelper.render.calls.mostRecent().args[0].canDelete).toBe(role !== 'user');
    });
  });
});
