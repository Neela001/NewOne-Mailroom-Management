import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { getDeviceName, getOrCreateDeviceId } from '../../../core/utils/device.util';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';

// Fields/flow match the real spec exactly (see auth.model.ts's own
// comment): a server-issued captcha image (GET auth/captcha ->
// captchaId + imageBase64), submitted back alongside userName/password/
// captchaCode on POST auth/login. Nothing here is the reference project's
// old client-generated text captcha — that doesn't exist in this API.
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, ButtonComponent, InputComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly captchaImageSrc = signal<string | null>(null);
  protected readonly captchaLoading = signal(false);
  protected readonly captchaFailed = signal(false);
  private captchaId = '';

  // True only once a real captchaId + image have both come back from
  // GET auth/captcha — gates Submit so a request can't go out with a
  // missing/stale captchaId (see LoginRequest.captchaId in auth.model.ts).
  protected readonly captchaReady = computed(() => !this.captchaFailed() && !!this.captchaImageSrc());

  protected readonly loginForm = this.fb.group({
    userName: ['', [Validators.required]],
    password: ['', [Validators.required]],
    captchaCode: ['', [Validators.required]],
  });

  constructor() {
    this.loadCaptcha();
  }

  private loadCaptcha(): void {
    this.captchaLoading.set(true);
    this.captchaFailed.set(false);
    this.captchaImageSrc.set(null);

    this.auth.getCaptcha().subscribe({
      next: (res) => {
        this.captchaLoading.set(false);
        if (res.success && res.data) {
          this.captchaId = res.data.captchaId;
          // The real backend's imageBase64 already comes back as a full
          // `data:image/png;base64,...` URI (confirmed against a live
          // response after the backend fix) — prepending the prefix again
          // here produced a malformed, doubly-prefixed URI that silently
          // failed to render. Use it as-is; only add the prefix as a
          // fallback for a hypothetical bare-base64 response.
          const raw = res.data.imageBase64;
          this.captchaImageSrc.set(raw ? (raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`) : null);
          if (!this.captchaImageSrc()) this.captchaFailed.set(true);
        } else {
          this.captchaFailed.set(true);
          // The API's own message or nothing — never a hardcoded fallback
          // (see api-error.util.ts's own comment).
          this.errorMessage.set(usableMessage(res.message));
        }
      },
      error: (err: HttpErrorResponse) => {
        this.captchaLoading.set(false);
        this.captchaFailed.set(true);
        this.errorMessage.set(extractApiErrorMessage(err));
      },
    });
  }

  // Resets the captcha input and fetches a fresh one WITHOUT touching
  // errorMessage — used right after a failed submit, where the just-shown
  // real backend error (e.g. "CAPTCHA verification failed.") needs to stay
  // visible while a new captcha loads. The public refreshCaptcha() below
  // (the refresh-icon button's own handler) is the one place a stale error
  // should actually clear, since the user is taking a fresh action there,
  // not reacting to the error that's currently showing.
  private reloadCaptcha(): void {
    this.loginForm.get('captchaCode')?.reset();
    this.loadCaptcha();
  }

  refreshCaptcha(): void {
    this.errorMessage.set(null);
    this.reloadCaptcha();
  }

  onSubmit(): void {
    if (this.loading()) return;
    if (!this.captchaReady()) {
      this.errorMessage.set('Please load the CAPTCHA before continuing.');
      return;
    }

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.loading.set(true);

    const { userName, password, captchaCode } = this.loginForm.getRawValue();
    this.auth
      .login({
        userName,
        password,
        captchaId: this.captchaId,
        captchaCode,
        deviceName: getDeviceName(),
        deviceId: getOrCreateDeviceId() || null,
        loginSource: 'web',
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success) {
            this.router.navigateByUrl('/app');
          } else {
            this.errorMessage.set(usableMessage(res.message));
            this.reloadCaptcha();
          }
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.errorMessage.set(extractApiErrorMessage(err));
          this.reloadCaptcha();
        },
      });
  }
}
