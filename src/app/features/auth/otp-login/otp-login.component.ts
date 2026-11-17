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

// Real, separate login path confirmed in the spec (auth/otp/request +
// auth/otp/verify — see auth.model.ts's own comment), implemented as
// documented rather than invented: Step 1 is identical to the normal
// login's own username/password/captcha, but calls auth/otp/request
// instead of auth/login and gets back a challengeId rather than a session;
// Step 2 submits a 6-digit code against that challengeId and receives the
// same LoginResponse a normal login would.
@Component({
  selector: 'app-otp-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, ButtonComponent, InputComponent],
  templateUrl: './otp-login.component.html',
  styleUrl: './otp-login.component.scss',
})
export class OtpLoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly step = signal<1 | 2>(1);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly captchaImageSrc = signal<string | null>(null);
  protected readonly captchaLoading = signal(false);
  protected readonly captchaFailed = signal(false);
  private captchaId = '';
  private challengeId = '';

  // See login.component.ts's own captchaReady comment — same gate, same
  // reason (OtpStartRequest.captchaId must be a real value, not '').
  protected readonly captchaReady = computed(() => !this.captchaFailed() && !!this.captchaImageSrc());

  protected readonly step1Form = this.fb.group({
    userName: ['', [Validators.required]],
    password: ['', [Validators.required]],
    captchaCode: ['', [Validators.required]],
  });

  protected readonly step2Form = this.fb.group({
    otp: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]],
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
          // See login.component.ts's own comment — the real backend's
          // imageBase64 already comes back as a full data URI.
          const raw = res.data.imageBase64;
          this.captchaImageSrc.set(raw ? (raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`) : null);
          if (!this.captchaImageSrc()) this.captchaFailed.set(true);
        } else {
          this.captchaFailed.set(true);
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

  // See login.component.ts's own reloadCaptcha()/refreshCaptcha() comment —
  // same split: reloadCaptcha() preserves a just-shown real error while a
  // fresh captcha loads after a failed submit, refreshCaptcha() (the
  // refresh-icon button's own handler) clears a stale one since the user is
  // taking a fresh action there.
  private reloadCaptcha(): void {
    this.step1Form.get('captchaCode')?.reset();
    this.loadCaptcha();
  }

  refreshCaptcha(): void {
    this.errorMessage.set(null);
    this.reloadCaptcha();
  }

  requestOtp(): void {
    if (this.loading()) return;
    if (!this.captchaReady()) {
      this.errorMessage.set('Please load the CAPTCHA before continuing.');
      return;
    }
    if (this.step1Form.invalid) {
      this.step1Form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.loading.set(true);

    const { userName, password, captchaCode } = this.step1Form.getRawValue();
    this.auth
      .requestOtp({
        userName: userName!,
        password: password!,
        captchaId: this.captchaId,
        captchaCode: captchaCode!,
        deviceName: getDeviceName(),
        deviceId: getOrCreateDeviceId() || null,
        loginSource: 'web',
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success && res.data) {
            this.challengeId = res.data.challengeId;
            this.step.set(2);
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

  verifyOtp(): void {
    if (this.loading()) return;
    if (this.step2Form.invalid) {
      this.step2Form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.loading.set(true);

    const { otp } = this.step2Form.getRawValue();
    this.auth.verifyOtp({ challengeId: this.challengeId, otp: otp! }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.router.navigateByUrl('/app');
        } else {
          this.errorMessage.set(usableMessage(res.message));
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(extractApiErrorMessage(err));
      },
    });
  }

  backToStep1(): void {
    this.step.set(1);
    this.step2Form.reset();
    this.errorMessage.set(null);
  }
}
