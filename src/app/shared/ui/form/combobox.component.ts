import { Component, ElementRef, computed, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
import { SelectOption } from './select.component';

let nextId = 0;

// Searchable replacement for app-select (and, before it, <mat-select>) —
// for any field whose option list is large enough that scrolling a plain
// dropdown to find one entry is painful (Country/State/City/Postalcode/
// Area/Site/Employee… — see each entity's own form-dialog template for
// which fields use this vs the plain app-select). Same
// {label, value}[] options input and ControlValueAccessor contract as
// app-select, so it's a drop-in swap at any [formControlName] call site —
// filtering happens entirely over whatever options() it's already been
// given; it never fetches anything itself (the parent's existing
// optionsSource loading in master-form-dialog.component.ts /
// desk-form-dialog.component.ts is completely unchanged).
@Component({
  selector: 'app-combobox',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="flex flex-col gap-1.5">
      @if (label()) {
        <label [id]="labelId" class="text-[13px] font-medium text-navy-700">
          {{ label() }}
          @if (required()) {
            <span class="text-error-fg">*</span>
          }
        </label>
      }
      <div class="relative">
        <div
          #trigger
          [id]="id"
          tabindex="0"
          role="combobox"
          aria-haspopup="listbox"
          [attr.aria-expanded]="isOpen()"
          [attr.aria-controls]="isOpen() ? panelId : null"
          [attr.aria-labelledby]="label() ? labelId : null"
          [attr.aria-disabled]="disabled() || null"
          (click)="toggle()"
          (keydown)="onTriggerKeydown($event)"
          class="flex h-9 w-full box-border cursor-pointer items-center justify-between gap-2 rounded-[10px] border bg-white px-3 text-sm outline-none transition-colors duration-150"
          [class.pointer-events-none]="disabled()"
          [class.opacity-50]="disabled()"
          [class.text-navy-900]="selectedLabel()"
          [class.text-navy-400]="!selectedLabel()"
          [class.border-navy-200]="!invalid()"
          [class.focus:border-brand-400]="!invalid()"
          [class.focus:ring-2]="!invalid()"
          [class.focus:ring-brand-100]="!invalid()"
          [class.border-[#e3b3b3]]="invalid()"
        >
          <span class="truncate">{{ selectedLabel() || placeholder() || 'Select…' }}</span>
          <span class="flex flex-none items-center gap-0.5">
            @if (selectedLabel() && !disabled()) {
              <button type="button" class="flex h-5 w-5 items-center justify-center rounded text-navy-400 hover:text-navy-700" aria-label="Clear selection" (click)="clear($event)">
                <app-icon name="close" [size]="13" />
              </button>
            }
            <app-icon name="expand_more" [size]="16" class="text-navy-400" />
          </span>
        </div>

        @if (isOpen()) {
          <div class="fixed inset-0 z-40" (click)="close()"></div>
          <div
            [id]="panelId"
            role="listbox"
            class="fixed z-50 flex flex-col rounded-xl border border-navy-200 bg-white shadow-lg"
            [style.top.px]="panelPos().top"
            [style.left.px]="panelPos().left"
            [style.width.px]="panelPos().width"
          >
            <div class="border-b border-navy-100 p-1.5">
              <div class="relative">
                <app-icon name="search" [size]="14" class="absolute left-2 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
                <input
                  #searchInput
                  type="text"
                  class="h-8 w-full box-border rounded-lg border border-navy-200 bg-white pl-7 pr-2 text-sm text-navy-900 outline-none focus:border-brand-400"
                  placeholder="Search…"
                  [value]="query()"
                  (input)="onQueryInput($event)"
                  (keydown)="onSearchKeydown($event)"
                  autocomplete="off"
                  [attr.aria-label]="'Search ' + (label() || 'options')"
                />
              </div>
            </div>
            <div class="max-h-60 overflow-y-auto py-1">
              @if (loading()) {
                <div class="flex items-center justify-center gap-2 px-3 py-4 text-sm text-navy-500">
                  <span class="h-4 w-4 animate-spin rounded-full border-2 border-navy-200 border-t-brand-600"></span>
                  <span>Loading…</span>
                </div>
              } @else if (error()) {
                <div class="flex items-center justify-center gap-1.5 px-3 py-4 text-sm text-error-fg">
                  <app-icon name="error_outline" [size]="15" />
                  <span>Couldn't load options.</span>
                </div>
              } @else if (filteredOptions().length === 0) {
                <p class="px-3 py-4 text-center text-sm text-navy-500">{{ noResultsText() }}</p>
              } @else {
                @for (opt of filteredOptions(); track $index; let i = $index) {
                  <button
                    type="button"
                    role="option"
                    [attr.aria-selected]="opt.value === lastValue()"
                    class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                    [class.bg-brand-50]="i === highlightedIndex()"
                    [class.text-brand-700]="opt.value === lastValue()"
                    [class.font-medium]="opt.value === lastValue()"
                    [class.text-navy-800]="opt.value !== lastValue()"
                    (mouseenter)="highlightedIndex.set(i)"
                    (click)="select(opt)"
                  >
                    <span class="flex-1 truncate">{{ opt.label }}</span>
                    @if (opt.value === lastValue()) {
                      <app-icon name="check_circle_outline" [size]="14" class="flex-none text-brand-600" />
                    }
                  </button>
                }
              }
            </div>
          </div>
        }
      </div>
      @if (invalid() && errorText()) {
        <p class="text-xs text-error-fg">{{ errorText() }}</p>
      }
    </div>
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ComboboxComponent), multi: true }],
})
export class ComboboxComponent implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly required = input(false);
  readonly placeholder = input<string>('');
  readonly options = input<SelectOption[]>([]);
  readonly invalid = input(false);
  readonly errorText = input<string | null>(null);
  // True while the parent is still fetching options() (same optionsSource
  // load master-form-dialog.component.ts / desk-form-dialog.component.ts
  // already does) — shows a loading row instead of a premature "No
  // results found." flash.
  readonly loading = input(false);
  readonly error = input(false);
  readonly noResultsText = input('No results found.');

  protected readonly id = `app-combobox-${nextId++}`;
  protected readonly labelId = `${this.id}-label`;
  protected readonly panelId = `${this.id}-panel`;

  private readonly triggerRef = viewChild<ElementRef<HTMLElement>>('trigger');
  private readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly disabled = signal(false);
  protected readonly isOpen = signal(false);
  protected readonly query = signal('');
  protected readonly highlightedIndex = signal(0);
  protected readonly panelPos = signal({ top: 0, left: 0, width: 240 });

  protected readonly lastValue = signal<unknown>(undefined);
  protected readonly selectedLabel = computed(() => this.options().find((o) => o.value === this.lastValue())?.label ?? '');

  // Case-insensitive partial match on the label — works for both text
  // (City/State/Country names) and numeric-looking codes (Postalcode)
  // since both are rendered as plain strings here; no separate "numeric
  // search mode" is needed; typing "600001" simply substring-matches
  // against a label of "600001".
  protected readonly filteredOptions = computed(() => {
    const q = this.query().trim().toLowerCase();
    const opts = this.options();
    if (!q) return opts;
    return opts.filter((o) => o.label.toLowerCase().includes(q));
  });

  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};

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

  protected toggle(): void {
    if (this.disabled()) return;
    if (this.isOpen()) this.close();
    else this.open();
  }

  private open(): void {
    const el = this.triggerRef()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estHeight = 260;
    const openUpward = rect.bottom + estHeight > window.innerHeight;
    this.panelPos.set({
      top: openUpward ? Math.max(8, rect.top - estHeight) : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
    this.query.set('');
    const selectedIndex = this.options().findIndex((o) => o.value === this.lastValue());
    this.highlightedIndex.set(Math.max(0, selectedIndex));
    this.isOpen.set(true);
    queueMicrotask(() => this.searchInputRef()?.nativeElement.focus());
  }

  protected close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.onTouched();
    this.triggerRef()?.nativeElement.focus();
  }

  protected select(opt: SelectOption): void {
    this.lastValue.set(opt.value);
    this.onChange(opt.value);
    this.close();
  }

  protected clear(event: Event): void {
    event.stopPropagation();
    this.lastValue.set('');
    this.onChange('');
  }

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.highlightedIndex.set(0);
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.isOpen()) this.open();
    } else if (event.key === 'Escape') {
      this.close();
    }
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    const opts = this.filteredOptions();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedIndex.set(Math.min(this.highlightedIndex() + 1, opts.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedIndex.set(Math.max(this.highlightedIndex() - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const opt = opts[this.highlightedIndex()];
      if (opt) this.select(opt);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.key === 'Tab') {
      this.close();
    }
  }
}
