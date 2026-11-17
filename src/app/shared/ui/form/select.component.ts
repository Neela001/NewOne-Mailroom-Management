import { Component, ElementRef, afterRenderEffect, computed, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

let nextId = 0;

export interface SelectOption {
  label: string;
  value: unknown;
}

// Drop-in replacement for <mat-form-field><mat-select><mat-option> — a
// STYLED NATIVE <select>, deliberately not a custom CDK-overlay listbox:
// native selects already have full keyboard nav, screen-reader support and
// correct viewport-edge positioning for free, which a hand-built listbox
// would have to re-implement and re-verify. Same ControlValueAccessor
// contract as app-input, so [formControlName] is unchanged at call sites.
@Component({
  selector: 'app-select',
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
        @if (leadingIcon()) {
          <app-icon [name]="leadingIcon()!" [size]="16" class="text-brand-600" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); pointer-events: none" />
        }
        <select
          #selectEl
          [id]="id"
          [disabled]="disabled()"
          [value]="rawValue()"
          (change)="onChange_($event)"
          (blur)="onBlur()"
          class="h-9 w-full box-border appearance-none border bg-white pr-8 text-sm text-navy-900 outline-none transition-colors duration-150 disabled:bg-navy-50 disabled:text-navy-400 font-medium"
          [class.rounded-full]="!!leadingIcon()"
          [class.rounded-[10px]]="!leadingIcon()"
          [class.pl-9]="!!leadingIcon()"
          [class.pl-3]="!leadingIcon()"
          [class.border-navy-200]="!invalid()"
          [class.focus:border-brand-400]="!invalid()"
          [class.focus:ring-2]="!invalid()"
          [class.focus:ring-brand-100]="!invalid()"
          [class.border-[#e3b3b3]]="invalid()"
          [attr.aria-invalid]="invalid() || null"
        >
          <option value="" disabled hidden>{{ placeholder() || 'Select…' }}</option>
          @for (opt of options(); track $index) {
            <option [value]="$index">{{ opt.label }}</option>
          }
        </select>
        <app-icon name="expand_more" [size]="16" class="text-navy-400" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); pointer-events: none" />
      </div>
      @if (invalid() && errorText()) {
        <p class="text-xs text-error-fg">{{ errorText() }}</p>
      }
    </div>
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true }],
})
export class SelectComponent implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly required = input(false);
  readonly placeholder = input<string>('');
  readonly options = input<SelectOption[]>([]);
  readonly invalid = input(false);
  readonly errorText = input<string | null>(null);
  // Set only by a toolbar-style filter (e.g. master-list's own Active/
  // Inactive filter) — switches the control to a full pill shape with a
  // leading icon, matching that context's own visual treatment; an
  // ordinary form-field select (no icon) stays the regular rounded box.
  readonly leadingIcon = input<string | null>(null);

  protected readonly id = `app-select-${nextId++}`;
  protected readonly disabled = signal(false);
  // The real option VALUE can be any type (uuid string, number, etc.), but
  // a native <option value> is always a string — bind by index into
  // options() instead of by raw value, so value identity is never lost to
  // string coercion (a problem a real uuid value never had, but a numeric
  // id would).
  //
  // rawValue is a computed, not a value writeValue() sets directly: a
  // cascaded field's options() arrive asynchronously, after Angular Forms
  // has already called writeValue() once with the row's existing value
  // (edit mode) — recomputing the index whenever options() changes too
  // (not just the underlying value) is what keeps an Edit dialog's
  // dependent dropdown correctly pre-selected once its options load.
  private readonly lastValue = signal<unknown>(undefined);
  protected readonly rawValue = computed(() => {
    const idx = this.options().findIndex((o) => o.value === this.lastValue());
    return idx === -1 ? '' : String(idx);
  });

  // [value]="rawValue()" alone is NOT enough once options() arrive
  // asynchronously (a cascading dropdown, or this field's own options
  // loading after the Add/Edit dialog already opened — e.g. Email
  // Setting's Authentication/Encryption selects): the FIRST time rawValue()
  // recomputes to a real index, a plain effect() (which only guarantees it
  // runs sometime after the SIGNAL changed, not after the @for block's own
  // DOM update has actually committed) can still fire before the matching
  // <option> exists, so the browser's native value setter silently no-ops
  // — leaving the control visually stuck on the placeholder/first option
  // forever after, even though `rawValue()` itself is already correct
  // (confirmed live: Email Setting's Edit dialog showed "(Not specified)"
  // while the underlying FormControl held the real stored value).
  // afterRenderEffect() is the one API Angular guarantees runs only once
  // the DOM (incl. @for-rendered <option>s) has actually been written for
  // this change detection round — re-applying `.value` there is what
  // actually fixes it.
  private readonly selectEl = viewChild<ElementRef<HTMLSelectElement>>('selectEl');

  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    afterRenderEffect(() => {
      const el = this.selectEl()?.nativeElement;
      const value = this.rawValue();
      if (el && el.value !== value) el.value = value;
    });
  }

  writeValue(value: unknown): void {
    this.lastValue.set(value);
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onChange_(event: Event): void {
    const idx = (event.target as HTMLSelectElement).value;
    const opt = this.options()[Number(idx)];
    this.lastValue.set(opt ? opt.value : '');
    this.onChange(opt ? opt.value : '');
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
