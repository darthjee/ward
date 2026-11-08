import { buildLoadEffect, runLoad } from '../../../../../../../assets/js/components/resources/bank/common/runLoad.js';
import ApiError from '../../../../../../../assets/js/client/ApiError.js';

describe('runLoad', () => {
  let callbacks;

  beforeEach(() => {
    callbacks = jasmine.createSpyObj('callbacks', ['onLoaded', 'onNotFound', 'onError']);
  });

  it('reports the loaded value', async () => {
    await runLoad(() => Promise.resolve({ id: 1 }), callbacks);

    expect(callbacks.onLoaded).toHaveBeenCalledWith({ id: 1 });
  });

  it('reports nothing for an expired session', async () => {
    await runLoad(() => Promise.resolve(undefined), callbacks);

    expect(callbacks.onLoaded).not.toHaveBeenCalled();
  });

  it('reports Not-found on a 404', async () => {
    await runLoad(() => Promise.reject(new ApiError(404, 'x')), callbacks);

    expect(callbacks.onNotFound).toHaveBeenCalled();
  });

  it('reports the classified error otherwise', async () => {
    await runLoad(() => Promise.reject(new ApiError(503, 'x')), callbacks);

    expect(callbacks.onError).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'transient' }));
  });

  it('drops late answers', async () => {
    await runLoad(() => Promise.resolve(1), callbacks, () => false);
    await runLoad(() => Promise.reject(new ApiError(404, 'x')), callbacks, () => false);

    expect(callbacks.onLoaded).not.toHaveBeenCalled();
    expect(callbacks.onNotFound).not.toHaveBeenCalled();
  });

  it('builds an effect whose cleanup flips the liveness check', () => {
    let isActive;
    const cleanup = buildLoadEffect((check) => {
      isActive = check;
    })();

    expect(isActive()).toBeTrue();
    cleanup();
    expect(isActive()).toBeFalse();
  });
});
