import OrganizationsClient from '../../../../assets/js/client/OrganizationsClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';

const ORGANIZATION = {
  id: 5, name: 'Acme', role: 'owner', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
};

describe('OrganizationsClient', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function lastCall() {
    return globalThis.fetch.calls.mostRecent().args;
  }

  describe('.list', () => {
    it('GETs /orgs.json without a body and resolves with the array', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: [ORGANIZATION] }]);

      const result = await OrganizationsClient.list();
      const [path, options] = lastCall();

      expect(result).toEqual([ORGANIZATION]);
      expect(path).toBe('/orgs.json');
      expect(options.method).toBe('GET');
      expect('body' in options).toBe(false);
    });
  });

  describe('.create', () => {
    it('POSTs the name to /orgs.json', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 201, json: ORGANIZATION }]);

      const result = await OrganizationsClient.create('Acme');
      const [path, options] = lastCall();

      expect(result).toEqual(ORGANIZATION);
      expect(path).toBe('/orgs.json');
      expect(options.method).toBe('POST');
      expect(options.body).toBe(JSON.stringify({ name: 'Acme' }));
    });
  });

  describe('.show', () => {
    it('GETs /orgs/:orgId.json without a body', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: ORGANIZATION }]);

      const result = await OrganizationsClient.show(5);
      const [path, options] = lastCall();

      expect(result).toEqual(ORGANIZATION);
      expect(path).toBe('/orgs/5.json');
      expect(options.method).toBe('GET');
      expect('body' in options).toBe(false);
    });
  });

  describe('.rename', () => {
    it('PATCHes the name to /orgs/:orgId.json', async () => {
      globalThis.fetch = fetchSequence([{ ok: true, status: 200, json: { ...ORGANIZATION, name: 'New' } }]);

      const result = await OrganizationsClient.rename(5, 'New');
      const [path, options] = lastCall();

      expect(result.name).toBe('New');
      expect(path).toBe('/orgs/5.json');
      expect(options.method).toBe('PATCH');
      expect(options.body).toBe(JSON.stringify({ name: 'New' }));
    });
  });
});
