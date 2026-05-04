import { describe, expect, it } from 'vitest';

import { isAIProviderFailoverError } from './provider.js';

describe('AI provider failover', () => {
  it('fails over when the primary provider has an invalid API key', () => {
    const error = Object.assign(new Error('401 Incorrect API key provided'), {
      status: 401,
      code: 'invalid_api_key',
    });

    expect(isAIProviderFailoverError(error)).toBe(true);
  });

  it('does not fail over for model output validation errors', () => {
    expect(isAIProviderFailoverError(new Error('missing_json_object'))).toBe(false);
  });
});
