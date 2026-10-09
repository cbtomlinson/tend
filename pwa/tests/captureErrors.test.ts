import { describe, expect, it } from 'vitest';
import { captureErrorMessage } from '@/services/vision';

describe('captureErrorMessage', () => {
  it('names the real problem per error code', () => {
    expect(captureErrorMessage(new Error('offline'))).toMatch(/No connection/);
    expect(captureErrorMessage(new Error('rate_limited'))).toMatch(/wait a minute/);
    expect(captureErrorMessage(new Error('bad_image'))).toMatch(/retaking/);
    expect(captureErrorMessage(new Error('unreadable_image'))).toMatch(/open that photo/);
  });
  it('falls back to a generic retry message', () => {
    expect(captureErrorMessage(new Error('extraction_failed'))).toMatch(/try again/);
    expect(captureErrorMessage('weird')).toMatch(/try again/);
  });
});
