import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;

// Drop-in replacement for <mat-form-field><textarea matInput> — a plain
// ControlValueAccessor, same contract as app-input, for a genuinely
// multi-line field (Remarks) rather than squeezing it into a single-line
// app-input — matching the reference screenshots' own scrollable Remarks
// box.
@Component({
  selector: 'app-textarea',
  standalone: true,
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
      <textarea
        [id]="id"
        [value]="value()"
        [disabled]="disabled()"
        [placeholder]="placeholder()"
        [rows]="rows()"
        (input)="onInput($event)"
        (blur)="onBlur()"
        class="w-full box-border resize-y rounded-[10px] border bg-white px-3 py-2 text-sm text-navy-900 outline-none transition-colors duration-150 placeholder:text-navy-400 disabled:bg-navy-50 disabled:text-navy-400"
        [class.border-navy-200]="!invalid()"
        [class.focus:border-brand-400]="!invalid()"
        [class.focus:ring-2]="!invalid()"
        [class.focus:ring-brand-100]="!invalid()"
        [class.border-[#e3b3b3]]="invalid()"
        [attr.aria-invalid]="invalid() || null"
      ></textarea>
      @if (invalid() && errorText()) {
        <p class="text-xs text-error-fg">{{ errorText() }}</p>
      }
    </div>
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TextareaComponent), multi: true }],
})
export class TextareaComponent implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly required = input(false);
  readonly placeholder = input<string>('');
  readonly rows = input(3);
  readonly invalid = input(false);
  readonly errorText = input<string | null>(null);

  protected readonly id = `app-textarea-${nextId++}`;
  protected readonly value = signal<string>('');
  protected readonly disabled = signal(false);

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
    const next = (event.target as HTMLTextAreaElement).value;
    this.value.set(next);
    this.onChange(next);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
