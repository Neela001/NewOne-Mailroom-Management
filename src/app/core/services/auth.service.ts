import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { StorageKey } from '../models/storage-key.enum';
import { ApiResponse } from '../models/api-response.model';
import { CaptchaImageResponse, LoginRequest, LoginResponse, OtpStartRequest, OtpStartResponse, OtpVerifyRequest } from '../models/auth.model';

// Entity/paths below are copied verbatim from the live spec — see
// auth.model.ts's own comment. `login()` stores the real token/expiry/user
// on success so authGuard and the Bearer interceptor can read them; the
// caller (LoginComponent) is still the one deciding what counts as success
// (`res.success`) and what message to show (`res.message`).
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);

  getCaptcha(): Observable<ApiResponse<CaptchaImageResponse>> {
    return this.api.get<CaptchaImageResponse>('auth/captcha');
  }

  login(credentials: LoginRequest): Observable<ApiResponse<LoginResponse>> {
    return this.api.post<LoginRequest, LoginResponse>('auth/login', credentials).pipe(tap((res) => this.storeSessionOnSuccess(res)));
  }

  // Real, separate two-step flow confirmed in the spec (auth/otp/request ->
  // challengeId, then auth/otp/verify -> the same LoginResponse a normal
  // login returns) — see auth.model.ts's own comment. requestOtp() still
  // needs a fresh captcha, same as regular login.
  requestOtp(credentials: OtpStartRequest): Observable<ApiResponse<OtpStartResponse>> {
    return this.api.post<OtpStartRequest, OtpStartResponse>('auth/otp/request', credentials);
  }

  verifyOtp(credentials: OtpVerifyRequest): Observable<ApiResponse<LoginResponse>> {
    return this.api.post<OtpVerifyRequest, LoginResponse>('auth/otp/verify', credentials).pipe(tap((res) => this.storeSessionOnSuccess(res)));
  }

  logout(): Observable<ApiResponse<unknown>> {
    return this.api.post<unknown, unknown>('auth/logout', {});
  }

  private storeSessionOnSuccess(res: ApiResponse<LoginResponse>): void {
    if (res.success && res.data?.accessToken) {
      this.storage.set(StorageKey.ACCESS_TOKEN, res.data.accessToken);
      this.storage.set(StorageKey.TOKEN_EXPIRES_AT, res.data.expiresAtUtc);
      this.storage.set(StorageKey.USER, res.data);
    }
  }

  getAccessToken(): string | null {
    return this.storage.get<string>(StorageKey.ACCESS_TOKEN);
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  clearSession(): void {
    this.storage.clear();
  }
}
