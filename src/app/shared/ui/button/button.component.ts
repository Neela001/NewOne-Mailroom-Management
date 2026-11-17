import { Component, computed, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

// A deliberate visual hierarchy, not one filled color per action: 'navy'
// (Add — the one true primary action on a list screen) and 'primary' both
// render as the same solid indigo fill; 'success'/'info'/'muted'/'danger'
// (Edit/View History/Search,Refresh,Cancel,Close/Delete) are all quiet
// ghost-style buttons that differ only by their text/icon tint, not a wall
// of equally-weighted colored blocks — see this file's own classes comment
// for why ("Ink & Paper" redesign: one emphasized primary per screen,
// everything else de-emphasized).
export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'navy' | 'success' | 'info' | 'muted' | 'danger';
// 'lg' (48px) exists for the login/OTP screens' own explicit request for a
// more prominent primary action — every other screen in the app uses 'md'
// (36px) consistently, per the redesign brief's own "consistent heights."
export type ButtonSize = 'sm' | 'md' | 'lg';

// Drop-in replacement for mat-flat-button/mat-stroked-button/mat-icon-button
// — one component, one set of height/padding/radius/focus rules, instead
// of three Material directives each with their own default sizing. Native
// <button> underneath so type="submit"/type="button", [disabled], and
// native click/keyboard behavior all work exactly as before.
@Component({
  selector: 'app-button',
  standalone: true,
  imports: [IconComponent],
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="classes()"
    >
      @if (loading()) {
        <span class="app-btn-spinner" aria-hidden="true"></span>
      } @else if (icon()) {
        <app-icon [name]="icon()!" [size]="iconSize()" />
      }
      <span [class.sr-only]="iconOnly() || (loading() && hideLabelWhileLoading())"><ng-content /></span>
    </button>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .app-btn-spinner {
        width: 15px;
        height: 15px;
        border-radius: 50%;
        border: 2px solid currentColor;
        border-top-color: transparent;
        opacity: 0.85;
        animation: app-btn-spin 0.6s linear infinite;
      }

      @keyframes app-btn-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly icon = input<string | null>(null);
  readonly iconOnly = input(false);
  readonly hideLabelWhileLoading = input(true);

  protected readonly iconSize = computed(() => (this.size() === 'sm' ? 15 : this.size() === 'lg' ? 18 : 17));

  protected readonly classes = computed(() => {
    const base =
      'inline-flex items-center justify-center gap-1.5 font-medium transition-colors duration-150 rounded-full select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed';

    const sizing = this.iconOnly()
      ? this.size() === 'sm'
        ? 'h-8 w-8'
        : this.size() === 'lg'
          ? 'h-12 w-12'
          : 'h-9 w-9'
      : this.size() === 'sm'
        ? 'h-8 px-3 text-[13px]'
        : this.size() === 'lg'
          ? 'h-12 px-5 text-[15px]'
          : 'h-9 px-3.5 text-sm';

    const variants: Record<ButtonVariant, string> = {
      // The one solid, emphasized action per screen (Add/Save, Sign In…).
      primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm',
      secondary: 'bg-white text-navy-700 border border-navy-200 hover:bg-navy-50 hover:border-navy-300',
      // Within a dedicated confirm dialog, Delete IS the primary decision —
      // a solid fill, not a quiet outlined button like the list footer's own.
      destructive: 'bg-error-fg text-white hover:bg-[#c21f1f] active:bg-[#a51b1b] shadow-sm',
      ghost: 'bg-transparent text-navy-600 hover:bg-navy-100 active:bg-navy-200',
      // Add — same solid azure weight as 'primary', the one emphasized
      // action on a list screen's own footer.
      navy: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm',
      // Edit/View History/Search/Refresh/Cancel/Close — a white pill with a
      // light border and azure icon+text, matching the reference's own
      // footer/toolbar button treatment exactly.
      success: 'bg-white text-brand-700 border border-navy-200 hover:bg-brand-50 hover:border-brand-200',
      info: 'bg-white text-brand-700 border border-navy-200 hover:bg-brand-50 hover:border-brand-200',
      muted: 'bg-white text-brand-700 border border-navy-200 hover:bg-brand-50 hover:border-brand-200',
      // Delete — same outlined-pill treatment, tinted red so its
      // destructive intent still reads at a glance.
      danger: 'bg-white text-error-fg border border-[#f3c6c6] hover:bg-error-bg hover:border-[#eba9a9]',
    };

    return `${base} ${sizing} ${variants[this.variant()]}`;
  });
}
