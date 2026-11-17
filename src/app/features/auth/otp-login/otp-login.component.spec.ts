import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FormGroup } from '@angular/forms';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { OtpLoginComponent } from './otp-login.component';
import { ConfigService } from '../../../core/services/config.service';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

// Mirrors login.component.spec.ts's own captcha-gating coverage for the
// OTP flow's step 1 (Request OTP) — step 2 (Verify & Sign In) needs no
// captcha at all, per the real OtpVerifyRequest schema (challengeId + otp
// only — see auth.model.ts's own comment), so it isn't gated here.
type TestableOtpLoginComponent = OtpLoginComponent & {
  captchaFailed(): boolean;
  captchaReady(): boolean;
  errorMessage(): string | null;
  captchaImageSrc(): string | null;
  step1Form: FormGroup;
  step2Form: FormGroup;
};

describe('OtpLoginComponent', () => {
  let httpMock: HttpTestingController;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideAppIcons()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(OtpLoginComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('disables Request OTP when the captcha request fails', () => {
    const fixture = createComponent();
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: false, message: 'boom' }, { status: 500, statusText: 'Internal Server Error' });
    fixture.detectChanges();

    const component = fixture.componentInstance as TestableOtpLoginComponent;
    expect(component.captchaReady()).toBe(false);

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.submit-button button');
    expect(button.disabled).toBe(true);
  });

  it('enables Request OTP once a real captchaId + image come back', () => {
    const fixture = createComponent();
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: true, data: { captchaId: 'c1', imageBase64: 'abc', expiresInSeconds: 120 } });
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.submit-button button');
    expect(button.disabled).toBe(false);
  });

  it('does not double-prefix imageBase64 when the backend already returns a full data: URI', () => {
    const fixture = createComponent();
    const realImage = 'data:image/png;base64,iVBORw0KGgoAAAANSU';
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: true, data: { captchaId: 'c1', imageBase64: realImage, expiresInSeconds: 120 } });
    fixture.detectChanges();

    const component = fixture.componentInstance as TestableOtpLoginComponent;
    expect(component.captchaImageSrc()).toBe(realImage);
  });

  it('requestOtp() refuses to call auth/otp/request when the captcha never loaded', () => {
    const fixture = createComponent();
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: false, message: 'boom' }, { status: 500, statusText: 'Internal Server Error' });
    fixture.detectChanges();

    const component = fixture.componentInstance as TestableOtpLoginComponent;
    component.requestOtp();

    httpMock.expectNone(apiUrl('auth/otp/request'));
    expect(component.errorMessage()).toBe('Please load the CAPTCHA before continuing.');
  });

  // Same real-message regression coverage as login.component.spec.ts's own
  // — see that file's comment for the exact live-confirmed response shape.
  function loadRealCaptcha(fixture: ReturnType<typeof createComponent>) {
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: true, data: { captchaId: 'c1', imageBase64: 'data:image/png;base64,abc', expiresInSeconds: 120 } });
    fixture.detectChanges();
  }

  it('shows the real backend message from a 400 HTTP error response on requestOtp(), not a hardcoded fallback', () => {
    const fixture = createComponent();
    loadRealCaptcha(fixture);
    const component = fixture.componentInstance as TestableOtpLoginComponent;
    component.step1Form.setValue({ userName: 'Manager', password: 'Test@1234', captchaCode: 'ABC123' });

    component.requestOtp();
    httpMock
      .expectOne(apiUrl('auth/otp/request'))
      .flush({ success: false, message: 'CAPTCHA verification failed.', data: null }, { status: 400, statusText: 'Bad Request' });
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: true, data: { captchaId: 'c2', imageBase64: 'data:image/png;base64,def', expiresInSeconds: 120 } });

    expect(component.errorMessage()).toBe('CAPTCHA verification failed.');
  });

  it('shows no error text (not a fabricated default) when verifyOtp() fails with no usable message', () => {
    const fixture = createComponent();
    loadRealCaptcha(fixture);
    const component = fixture.componentInstance as TestableOtpLoginComponent;
    component.step1Form.setValue({ userName: 'Manager', password: 'Test@1234', captchaCode: 'ABC123' });
    component.requestOtp();
    httpMock.expectOne(apiUrl('auth/otp/request')).flush({ success: true, data: { challengeId: 'ch1', expiresInSeconds: 120 } });

    component.step2Form.setValue({ otp: '123456' });
    component.verifyOtp();
    httpMock.expectOne(apiUrl('auth/otp/verify')).flush(null, { status: 0, statusText: 'Unknown Error' });

    expect(component.errorMessage()).toBeNull();
  });

  it('shows the real backend message when verifyOtp() resolves with {success:false}', () => {
    const fixture = createComponent();
    loadRealCaptcha(fixture);
    const component = fixture.componentInstance as TestableOtpLoginComponent;
    component.step1Form.setValue({ userName: 'Manager', password: 'Test@1234', captchaCode: 'ABC123' });
    component.requestOtp();
    httpMock.expectOne(apiUrl('auth/otp/request')).flush({ success: true, data: { challengeId: 'ch1', expiresInSeconds: 120 } });

    component.step2Form.setValue({ otp: '000000' });
    component.verifyOtp();
    httpMock.expectOne(apiUrl('auth/otp/verify')).flush({ success: false, message: 'Invalid or expired OTP.', data: null });

    expect(component.errorMessage()).toBe('Invalid or expired OTP.');
  });
});
