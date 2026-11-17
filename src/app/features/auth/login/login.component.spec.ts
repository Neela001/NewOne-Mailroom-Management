import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FormGroup } from '@angular/forms';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { LoginComponent } from './login.component';
import { ConfigService } from '../../../core/services/config.service';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

// Protected members are intentionally not part of LoginComponent's public
// API — this test-only view exposes just the ones these specs assert on,
// the same accepted pattern Angular component tests use rather than
// loosening the component's own encapsulation for production code.
type TestableLoginComponent = LoginComponent & {
  captchaFailed(): boolean;
  captchaReady(): boolean;
  errorMessage(): string | null;
  captchaImageSrc(): string | null;
  loginForm: FormGroup;
};

// Covers the captcha-gating fix: Sign In must be disabled whenever the
// captcha hasn't successfully loaded (captchaFailed() true or no image
// yet), re-enabled only once a real captchaId + image come back — see
// login.component.ts's own captchaReady comment.
describe('LoginComponent', () => {
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
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges(); // triggers the constructor's loadCaptcha()
    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('disables Sign In and shows the gate hint when the captcha request fails (e.g. a backend 500)', () => {
    const fixture = createComponent();
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: false, message: 'boom' }, { status: 500, statusText: 'Internal Server Error' });
    fixture.detectChanges();

    const component = fixture.componentInstance as TestableLoginComponent;
    expect(component.captchaFailed()).toBe(true);
    expect(component.captchaReady()).toBe(false);

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.submit-button button');
    expect(button.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.captcha-gate-hint')).toBeTruthy();
  });

  it('enables Sign In once a real captchaId + image come back', () => {
    const fixture = createComponent();
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: true, data: { captchaId: 'c1', imageBase64: 'abc', expiresInSeconds: 120 } });
    fixture.detectChanges();

    const component = fixture.componentInstance as TestableLoginComponent;
    expect(component.captchaReady()).toBe(true);

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.submit-button button');
    expect(button.disabled).toBe(false);
  });

  it('does not double-prefix imageBase64 when the backend already returns a full data: URI (regression: real response shape confirmed after the backend fix)', () => {
    const fixture = createComponent();
    const realImage = 'data:image/png;base64,iVBORw0KGgoAAAANSU';
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: true, data: { captchaId: 'c1', imageBase64: realImage, expiresInSeconds: 120 } });
    fixture.detectChanges();

    const component = fixture.componentInstance as TestableLoginComponent;
    expect(component.captchaImageSrc()).toBe(realImage);

    const img: HTMLImageElement = fixture.nativeElement.querySelector('.captcha-image');
    expect(img.getAttribute('src')).toBe(realImage);
  });

  it('still adds the data: prefix for a hypothetical bare-base64 response', () => {
    const fixture = createComponent();
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: true, data: { captchaId: 'c1', imageBase64: 'abc', expiresInSeconds: 120 } });
    fixture.detectChanges();

    const component = fixture.componentInstance as TestableLoginComponent;
    expect(component.captchaImageSrc()).toBe('data:image/png;base64,abc');
  });

  it('onSubmit() refuses to call login() when the captcha never loaded, even if called directly', () => {
    const fixture = createComponent();
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: false, message: 'boom' }, { status: 500, statusText: 'Internal Server Error' });
    fixture.detectChanges();

    const component = fixture.componentInstance as TestableLoginComponent;
    component.onSubmit();

    httpMock.expectNone(apiUrl('auth/login'));
    expect(component.errorMessage()).toBe('Please load the CAPTCHA before continuing.');
  });

  // Regression for the real bug report: the live backend returns a 400 with
  // a normal JSON body, {success:false, message:"CAPTCHA verification
  // failed.", data:null, traceId:"..."} — Angular routes a non-2xx response
  // to the Observable's error branch, and the previous code's `error: () =>
  // {...}` discarded the response entirely and showed a hardcoded generic
  // string instead of this real message.
  function loadRealCaptcha(fixture: ReturnType<typeof createComponent>) {
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: true, data: { captchaId: 'c1', imageBase64: 'data:image/png;base64,abc', expiresInSeconds: 120 } });
    fixture.detectChanges();
  }

  function fillValidForm(component: TestableLoginComponent) {
    component.loginForm.setValue({
      userName: 'Manager',
      password: 'Test@1234',
      captchaCode: 'ABC123',
    });
  }

  it('shows the real backend message from a 400 HTTP error response on login, not a hardcoded fallback', () => {
    const fixture = createComponent();
    loadRealCaptcha(fixture);
    const component = fixture.componentInstance as TestableLoginComponent;
    fillValidForm(component);

    component.onSubmit();
    httpMock
      .expectOne(apiUrl('auth/login'))
      .flush({ success: false, message: 'CAPTCHA verification failed.', data: null, traceId: 't1' }, { status: 400, statusText: 'Bad Request' });
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: true, data: { captchaId: 'c2', imageBase64: 'data:image/png;base64,def', expiresInSeconds: 120 } });

    expect(component.errorMessage()).toBe('CAPTCHA verification failed.');
  });

  it('shows the real backend message from a resolved {success:false} response (non-HTTP-error failure)', () => {
    const fixture = createComponent();
    loadRealCaptcha(fixture);
    const component = fixture.componentInstance as TestableLoginComponent;
    fillValidForm(component);

    component.onSubmit();
    httpMock.expectOne(apiUrl('auth/login')).flush({ success: false, message: 'Invalid username or password.', data: null });
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: true, data: { captchaId: 'c2', imageBase64: 'data:image/png;base64,def', expiresInSeconds: 120 } });

    expect(component.errorMessage()).toBe('Invalid username or password.');
  });

  it('shows no error text (not a fabricated default) when a failure has no usable message', () => {
    const fixture = createComponent();
    loadRealCaptcha(fixture);
    const component = fixture.componentInstance as TestableLoginComponent;
    fillValidForm(component);

    component.onSubmit();
    httpMock.expectOne(apiUrl('auth/login')).flush(null, { status: 0, statusText: 'Unknown Error' });
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: true, data: { captchaId: 'c2', imageBase64: 'data:image/png;base64,def', expiresInSeconds: 120 } });

    expect(component.errorMessage()).toBeNull();
  });

  it('a failed submit reloads the captcha but keeps the real error message visible', () => {
    const fixture = createComponent();
    loadRealCaptcha(fixture);
    const component = fixture.componentInstance as TestableLoginComponent;
    fillValidForm(component);

    component.onSubmit();
    httpMock.expectOne(apiUrl('auth/login')).flush({ success: false, message: 'CAPTCHA verification failed.' }, { status: 400, statusText: 'Bad Request' });

    // A fresh captcha is requested...
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: true, data: { captchaId: 'c2', imageBase64: 'data:image/png;base64,def', expiresInSeconds: 120 } });
    // ...but the error from the submit that just failed must still be showing.
    expect(component.errorMessage()).toBe('CAPTCHA verification failed.');
  });

  it('refreshCaptcha() (the refresh-icon button) clears a stale error, unlike the automatic post-failure reload', () => {
    const fixture = createComponent();
    loadRealCaptcha(fixture);
    const component = fixture.componentInstance as TestableLoginComponent;
    fillValidForm(component);

    component.onSubmit();
    httpMock.expectOne(apiUrl('auth/login')).flush({ success: false, message: 'CAPTCHA verification failed.' }, { status: 400, statusText: 'Bad Request' });
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: true, data: { captchaId: 'c2', imageBase64: 'data:image/png;base64,def', expiresInSeconds: 120 } });
    expect(component.errorMessage()).toBe('CAPTCHA verification failed.');

    component.refreshCaptcha();
    expect(component.errorMessage()).toBeNull();
    httpMock.expectOne(apiUrl('auth/captcha')).flush({ success: true, data: { captchaId: 'c3', imageBase64: 'data:image/png;base64,ghi', expiresInSeconds: 120 } });
  });
});
