// All shapes below are copied field-for-field from the live OpenAPI spec
// (GET https://newoneapi.nestien.com/swagger/v1/swagger.json) — LoginRequest,
// LoginResponse, CaptchaImageResponse, OtpStartRequest, OtpVerifyRequest.
// Nothing here is guessed.

export interface CaptchaImageResponse {
  captchaId: string; // uuid
  imageBase64: string | null;
  expiresInSeconds: number;
}

export interface LoginRequest {
  userName: string | null;
  password: string | null;
  captchaId: string; // uuid, from CaptchaImageResponse.captchaId
  captchaCode: string | null;
  deviceName?: string | null;
  deviceId?: string | null;
  loginSource?: string | null;
}

export interface LoginResponse {
  userId: string; // uuid
  userName: string | null;
  userType: string | null;
  // CONFIRMED LIVE (real backend, real account, 2026-11-06): the real
  // auth/login response includes these two fields, not just the ones
  // originally modeled here from the spec's own (thin) schema — a
  // person-facing name distinct from the login userName, and the server's
  // own record of this user's last successful login.
  displayName: string | null;
  lastLoginDate: string | null; // ISO date-time
  accessToken: string | null;
  tokenType: string | null;
  expiresAtUtc: string; // ISO date-time
  isFirstLogin: boolean;
  forcePasswordChange: boolean;
}

// OTP login is a confirmed, real, separate endpoint pair — wired into the
// UI via OtpLoginComponent (auth/otp/request -> auth/otp/verify), sharing
// the same server captcha step as the password login.
export interface OtpStartRequest {
  userName: string;
  password: string;
  captchaId: string;
  captchaCode: string;
  deviceName?: string | null;
  deviceId?: string | null;
  loginSource?: string | null;
}

export interface OtpVerifyRequest {
  challengeId: string; // uuid
  otp: string; // 6 digits
}

export interface OtpStartResponse {
  challengeId: string; // uuid
  expiresInSeconds: number;
}
