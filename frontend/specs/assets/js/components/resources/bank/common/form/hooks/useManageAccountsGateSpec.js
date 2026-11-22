import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useManageAccountsGate from '../../../../../../../../../assets/js/components/resources/bank/common/form/hooks/useManageAccountsGate.js';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';

function probe(role) {
  let result;
  const Probe = () => {
    result = useManageAccountsGate();
    return null;
  };

  renderToStaticMarkup(React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, role } },
    React.createElement(Probe),
  ));

  return result;
}

describe('useManageAccountsGate', () => {
  ['owner', 'admin'].forEach((role) => {
    it(`allows an ${role}`, () => {
      expect(probe(role)).toEqual({ forbidden: false, allowed: true });
    });
  });

  it('forbids a user', () => {
    expect(probe('user')).toEqual({ forbidden: true, allowed: false });
  });

  it('is neither forbidden nor allowed while the role is unknown', () => {
    expect(probe(null)).toEqual({ forbidden: false, allowed: false });
    expect(probe(undefined)).toEqual({ forbidden: false, allowed: false });
  });
});
