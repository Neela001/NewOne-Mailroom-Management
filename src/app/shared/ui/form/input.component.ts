import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

let nextId = 0;

// Drop-in replacement for <mat-form-field><mat-label>…<input matInput>
// — a plain ControlValueAccessor so [formControlName] keeps working
// unchanged at every call site (see master-form-dialog.component.ts's own
// field-rendering loop, unchanged by this swap). Validity/touched state
// stays owned by the parent's FormGroup, same as before — this component
// only renders the label/required marker/error text it's told to.
@Component({
  selector: 'app-input',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="flex flex-col gap-1.5">
      @if (label()) {
        <label [for]="id" class="text-[13px] font-medium text-navy-700">
          {{ label() }}
          @if (required()) {
            <span class="text-error-fg">*</span>
          }
        </label>
      }
      <div class="relative">
        @if (prefixIcon()) {
          <app-icon
            [name]="prefixIcon()!"
            [size]="size() === 'lg' ? 18 : 16"
            class="absolute top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none"
            [class.left-3]="size() === 'md'"
            [class.left-3.5]="size() === 'lg'"
          />
        }
        <input
          [id]="id"
          [type]="effectiveType()"
          [value]="value()"
          [disabled]="disabled()"
          [placeholder]="placeholder()"
          [autocomplete]="autocomplete() ?? 'off'"
          (input)="onInput($event)"
          (blur)="onBlur()"
          [class]="inputClasses()"
          [class.pl-9]="prefixIcon() && size() === 'md'"
          [class.pl-10]="prefixIcon() && size() === 'lg'"
          [class.pr-9]="revealable() && size() === 'md'"
          [class.pr-11]="revealable() && size() === 'lg'"
          [class.border-navy-200]="!invalid()"
          [class.focus:border-brand-400]="!invalid()"
          [class.focus:ring-2]="!invalid()"
          [class.focus:ring-brand-100]="!invalid()"
          [class.border-[#e3b3b3]]="invalid()"
          [class.focus:border-error-fg]="invalid()"
          [attr.aria-invalid]="invalid() || null"
          [attr.aria-describedby]="invalid() ? id + '-error' : null"
        />
        @if (revealable()) {
          <button
            type="button"
            class="absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded text-navy-400 hover:text-navy-700"
            [class.right-2]="size() === 'md'"
            [class.h-6]="size() === 'md'"
            [class.w-6]="size() === 'md'"
            [class.right-3]="size() === 'lg'"
            [class.h-7]="size() === 'lg'"
            [class.w-7]="size() === 'lg'"
            [attr.aria-label]="revealed() ? 'Hide password' : 'Show password'"
            (click)="revealed.set(!revealed())"
          >
            <app-icon [name]="revealed() ? 'visibility' : 'visibility_off'" [size]="size() === 'lg' ? 18 : 16" />
          </button>
        }
      </div>
      @if (invalid() && errorText()) {
        <p [id]="id + '-error'" class="text-xs text-error-fg">{{ errorText() }}</p>
      }
    </div>
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => InputComponent), multi: true }],
})
export class InputComponent implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly type = input<string>('text');
  readonly required = input(false);
  readonly placeholder = input<string>('');
  readonly autocomplete = input<string | null>(null);
  readonly invalid = input(false);
  readonly errorText = input<string | null>(null);
  // Self-contained show/hide toggle for a password field — only meaningful
  // when type() === 'password'; renders the eye-icon suffix button and
  // flips the native input's own type between 'password' and 'text'.
  readonly revealable = input(false);
  readonly prefixIcon = input<string | null>(null);
  // 'md' (36px) is the standard height used everywhere else in the app;
  // 'lg' (50px) exists for the login/OTP screens' own explicit request for
  // larger, more prominent fields on that one surface.
  readonly size = input<'md' | 'lg'>('md');

  protected readonly id = `app-input-${nextId++}`;
  protected readonly value = signal<string>('');
  protected readonly disabled = signal(false);
  protected readonly revealed = signal(false);
  protected readonly effectiveType = computed(() => (this.revealable() && this.revealed() ? 'text' : this.type()));

  protected readonly inputClasses = computed(() => {
    const base = 'w-full box-border rounded-[10px] border bg-white text-navy-900 outline-none transition-colors duration-150 placeholder:text-navy-400 disabled:bg-navy-50 disabled:text-navy-400';
    const sizing = this.size() === 'lg' ? 'h-[50px] px-3.5 text-[15px]' : 'h-9 px-3 text-sm';
    return `${base} ${sizing}`;
  });

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: unknown): void {
    this.value.set(value == null ? '' : String(value));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.value.set(next);
    this.onChange(next);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
