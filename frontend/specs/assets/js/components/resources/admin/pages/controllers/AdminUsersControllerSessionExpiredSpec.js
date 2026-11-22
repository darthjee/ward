import AdminUsersController from '../../../../../../../../assets/js/components/resources/admin/pages/controllers/AdminUsersController.js';
import sessionExpiredError from '../../../../../../../support/sessionExpiredError.js';

describe('AdminUsersController on a session-expired rejection', () => {
  let setUsers;
  let setRowResults;
  let setSearchError;
  let client;
  let controller;

  beforeEach(() => {
    setUsers = jasmine.createSpy('setUsers');
    setRowResults = jasmine.createSpy('setRowResults');
    setSearchError = jasmine.createSpy('setSearchError');
    client = jasmine.createSpyObj('client', [
      'searchUsers', 'approveUser', 'denyUser', 'generateRecoveryLink', 'sendRecoveryEmail',
    ]);
    Object.values(client).forEach((spy) => spy.and.rejectWith(sessionExpiredError()));
    controller = new AdminUsersController({
      setUsers,
      setCurrentUserId: jasmine.createSpy('setCurrentUserId'),
      setRowResults,
      setSearchError,
      client,
      confirm: () => true,
    });
  });

  it('shows no search error', async () => {
    await controller.handleSearch('foo');

    expect(setSearchError).toHaveBeenCalledOnceWith(null);
    expect(setUsers).not.toHaveBeenCalled();
  });

  [
    ['handleApprove', (c) => c.handleApprove(1)],
    ['handleDeny', (c) => c.handleDeny(1)],
    ['handleGenerateLink', (c) => c.handleGenerateLink(1)],
    ['handleSendEmail', (c) => c.handleSendEmail(1)],
  ].forEach(([name, act]) => {
    it(`${name} shows no row error`, async () => {
      await act(controller);

      expect(setRowResults).not.toHaveBeenCalled();
      expect(setUsers).not.toHaveBeenCalled();
    });
  });
});
