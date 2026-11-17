import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';

// Covers the one real behavior in this service beyond a thin HTTP
// pass-through: storeSessionOnSuccess() only persisting a session when the
// backend actually returned one, and the exact Swagger field names
// (captchaId/captchaCode) being sent on login/OTP requests — see
// auth.model.ts's own comment and the Phase 2 captcha field-mapping report.
describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  it('getCaptcha() calls GET auth/captcha', () => {
    service.getCaptcha().subscribe();
    const req = httpMock.expectOne(apiUrl('auth/captcha'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: { captchaId: 'c1', imageBase64: 'abc', expiresInSeconds: 120 } });
  });

  it('login() sends captchaId + captchaCode exactly as named in LoginRequest', () => {
    service
      .login({ userName: 'bob', password: 'pw', captchaId: 'c1', captchaCode: '1234', loginSource: 'web' })
      .subscribe();

    const req = httpMock.expectOne(apiUrl('auth/login'));
    expect(req.request.body.captchaId).toBe('c1');
    expect(req.request.body.captchaCode).toBe('1234');
    req.flush({ success: false, message: 'Invalid credentials', data: null });
  });

  it('login() stores the access token on a successful response', () => {
    service.login({ userName: 'bob', password: 'pw', captchaId: 'c1', captchaCode: '1234' }).subscribe();

    httpMock.expectOne(apiUrl('auth/login')).flush({
      success: true,
      data: { userId: 'u1', userName: 'bob', userType: 'Employee', accessToken: 'token-123', tokenType: 'Bearer', expiresAtUtc: '2026-01-01T00:00:00Z', isFirstLogin: false, forcePasswordChange: false },
    });

    expect(service.getAccessToken()).toBe('token-123');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('login() does NOT store a session when the backend rejects the request', () => {
    service.login({ userName: 'bob', password: 'wrong', captchaId: 'c1', captchaCode: '1234' }).subscribe();

    httpMock.expectOne(apiUrl('auth/login')).flush({ success: false, message: 'Invalid credentials', data: null });

    expect(service.getAccessToken()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('verifyOtp() sends challengeId + otp exactly as named in OtpVerifyRequest, no captcha fields', () => {
    service.verifyOtp({ challengeId: 'ch1', otp: '123456' }).subscribe();

    const req = httpMock.expectOne(apiUrl('auth/otp/verify'));
    expect(req.request.body).toEqual({ challengeId: 'ch1', otp: '123456' });
    req.flush({ success: false, data: null });
  });

  it('clearSession() removes a previously stored token', () => {
    service.login({ userName: 'bob', password: 'pw', captchaId: 'c1', captchaCode: '1234' }).subscribe();
    httpMock.expectOne(apiUrl('auth/login')).flush({
      success: true,
      data: { userId: 'u1', userName: 'bob', userType: 'Employee', accessToken: 'token-123', tokenType: 'Bearer', expiresAtUtc: '2026-01-01T00:00:00Z', isFirstLogin: false, forcePasswordChange: false },
    });
    expect(service.isAuthenticated()).toBe(true);

    service.clearSession();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.getAccessToken()).toBeNull();
  });
});
