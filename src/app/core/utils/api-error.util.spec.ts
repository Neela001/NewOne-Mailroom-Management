import { HttpErrorResponse } from '@angular/common/http';
import { extractApiErrorMessage, usableMessage } from './api-error.util';

describe('extractApiErrorMessage', () => {
  it('reads the real backend message from a parsed JSON error body (live-confirmed shape: 400 + {success:false, message, data, traceId})', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { success: false, message: 'CAPTCHA verification failed.', data: null, traceId: 't1' },
    });
    expect(extractApiErrorMessage(err)).toBe('CAPTCHA verification failed.');
  });

  it('reads a plain-string error body', () => {
    const err = new HttpErrorResponse({ status: 500, error: 'Internal failure' });
    expect(extractApiErrorMessage(err)).toBe('Internal failure');
  });

  it('returns null for a network failure with no parsed body', () => {
    const err = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });
    expect(extractApiErrorMessage(err)).toBeNull();
  });

  it('returns null rather than showing an HTML error page verbatim', () => {
    const err = new HttpErrorResponse({ status: 502, error: '<!DOCTYPE html><html><body>Bad Gateway</body></html>' });
    expect(extractApiErrorMessage(err)).toBeNull();
  });

  it('returns null for a body with no usable message field', () => {
    const err = new HttpErrorResponse({ status: 400, error: { success: false, data: null } });
    expect(extractApiErrorMessage(err)).toBeNull();
  });

  it('returns null for a suspiciously long body (more likely a stack trace than a user-facing message)', () => {
    const err = new HttpErrorResponse({ status: 500, error: { message: 'x'.repeat(400) } });
    expect(extractApiErrorMessage(err)).toBeNull();
  });

  it('returns null for a non-HttpErrorResponse input', () => {
    expect(extractApiErrorMessage(new Error('boom'))).toBeNull();
  });
});

describe('usableMessage', () => {
  it('returns the message when present and non-empty', () => {
    expect(usableMessage('Invalid OTP.')).toBe('Invalid OTP.');
  });

  it('returns null for null/undefined/empty/whitespace-only messages', () => {
    expect(usableMessage(null)).toBeNull();
    expect(usableMessage(undefined)).toBeNull();
    expect(usableMessage('')).toBeNull();
    expect(usableMessage('   ')).toBeNull();
  });
});
