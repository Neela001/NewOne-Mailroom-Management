import { Component, ElementRef, effect, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;

// Drop-in replacement for <mat-checkbox> — native <input type="checkbox">
// (full native keyboard/a11y behavior for free) visually hidden and
// replaced by a styled sibling box driven off :checked, same
// ControlValueAccessor contract as app-input/app-select.
@Component({
  selector: 'app-checkbox',
  standalone: true,
  template: `
    <label [for]="id" class="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-navy-700" [class.opacity-50]="disabled()" [class.cursor-not-allowed]="disabled()">
      <span class="relative inline-flex h-[18px] w-[18px] flex-none items-center justify-center">
        <input
          #checkboxInput
          [id]="id"
          type="checkbox"
          class="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          [checked]="checked()"
          [disabled]="disabled()"
          (change)="onChangeEvent($event)"
          (blur)="onBlur()"
        />
        <span
          class="pointer-events-none flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border border-navy-300 bg-white transition-colors duration-150 peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500"
        >
          @if (checked()) {
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          }
        </span>
      </span>
      <ng-content />
    </label>
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CheckboxComponent), multi: true }],
})
export class CheckboxComponent implements ControlValueAccessor {
  protected readonly id = `app-checkbox-${nextId++}`;
  protected readonly checked = signal(false);
  protected readonly disabled = signal(false);

  // Tri-state header checkbox support (e.g. Role Rights' own per-column
  // "some rows checked, some not" state — see rolerights-list.component.ts's
  // own headerState() comment) — the native DOM `.indeterminate` property
  // has no HTML attribute equivalent, so it's synced imperatively rather
  // than bound in the template. Optional; every existing checkbox (writing
  // only a plain boolean, never this input) is unaffected.
  readonly indeterminate = input(false);
  private readonly checkboxInput = viewChild<ElementRef<HTMLInputElement>>('checkboxInput');

  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    effect(() => {
      const el = this.checkboxInput()?.nativeElement;
      if (el) el.indeterminate = this.indeterminate();
    });
  }

  writeValue(value: unknown): void {
    this.checked.set(!!value);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onChangeEvent(event: Event): void {
    const next = (event.target as HTMLInputElement).checked;
    this.checked.set(next);
    this.onChange(next);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
