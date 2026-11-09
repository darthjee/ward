import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import useMarkUnsent from '../../../../../../../../../assets/js/components/resources/bank/providers/common/hooks/useMarkUnsent.js';
import AccountantClient from '../../../../../../../../../assets/js/client/AccountantClient.js';

function probe(deps) {
  let result;
  const Probe = () => {
    result = useMarkUnsent(deps);
    return null;
  };

  renderToStaticMarkup(React.createElement(Probe));

  return result;
}

describe('useMarkUnsent', () => {
  let deps;

  beforeEach(() => {
    deps = { context: { kind: 'personal' }, reload: jasmine.createSpy('reload'), setError: jasmine.createSpy('setError') };
  });

  it('starts idle', () => {
    expect(probe(deps).state).toEqual({ markUnsentPending: false });
  });

  it('posts the row id to mark-unsent and reloads', async () => {
    spyOn(AccountantClient, 'markUnsent').and.resolveTo({ charges: [] });

    await probe(deps).handlers.onMarkUnsent({ id: 9 });

    expect(AccountantClient.markUnsent).toHaveBeenCalledWith({ kind: 'personal' }, [9]);
    expect(deps.reload).toHaveBeenCalled();
  });
});
