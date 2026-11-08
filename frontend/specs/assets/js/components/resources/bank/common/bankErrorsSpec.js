import { classifyError } from '../../../../../../../assets/js/components/resources/bank/common/bankErrors.js';
import ApiError from '../../../../../../../assets/js/client/ApiError.js';

describe('classifyError', () => {
  it('classifies a 404 as notFound', () => {
    expect(classifyError(new ApiError(404, 'Not found', 'NOT_FOUND')).kind).toBe('notFound');
  });

  it('classifies a 409 as a conflict, keeping the code and message', () => {
    expect(classifyError(new ApiError(409, 'Archived', 'ACCOUNT_ARCHIVED'))).toEqual({
      kind: 'conflict', code: 'ACCOUNT_ARCHIVED', message: 'Archived', messages: ['Archived'],
    });
  });

  it('lists the details of a VALIDATION_FAILED 400', () => {
    const error = new ApiError(400, 'Validation failed', 'VALIDATION_FAILED', ['name is too long', 'notes is too long']);

    expect(classifyError(error)).toEqual(jasmine.objectContaining({
      kind: 'validation', messages: ['name is too long', 'notes is too long'],
    }));
  });

  it('falls back to the message of a BAD_REQUEST 400 without details', () => {
    expect(classifyError(new ApiError(400, 'Too many decimals', 'BAD_REQUEST')).messages)
      .toEqual(['Too many decimals']);
  });

  it('falls back to the message for empty details', () => {
    expect(classifyError(new ApiError(400, 'Bad', 'BAD_REQUEST', [])).messages).toEqual(['Bad']);
  });

  it('classifies a 5xx as transient', () => {
    expect(classifyError(new ApiError(503, 'Unavailable')).kind).toBe('transient');
  });

  it('classifies a network failure as transient', () => {
    expect(classifyError(new TypeError('Failed to fetch'))).toEqual(jasmine.objectContaining({
      kind: 'transient', message: jasmine.any(String),
    }));
  });

  it('classifies another status as transient with its message', () => {
    expect(classifyError(new ApiError(418, 'Teapot'))).toEqual(jasmine.objectContaining({
      kind: 'transient', message: 'Teapot',
    }));
  });
});
