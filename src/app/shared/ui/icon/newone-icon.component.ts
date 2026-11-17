import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NEWONE_ICON_SVG } from './newone-icon-map';

// Renders one of the real NewOne icon assets (see newone-icon-map.ts's own
// provenance comment) inline — not via <img src>, specifically so its
// stroke="currentColor" can inherit whatever text color the surrounding
// element already has (the sidebar's own default/hover/active-state
// classes), the same way the app's existing Lucide-based app-icon already
// behaves. The markup is this app's own static, hand-copied constant (never
// user input), so bypassSecurityTrustHtml here carries the same trust level
// as any other bundled template content.
@Component({
  selector: 'app-newone-icon',
  standalone: true,
  template: `<span class="newone-icon-svg" [style.width.px]="size()" [style.height.px]="size()" [innerHTML]="svgHtml()"></span>`,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        line-height: 0;
      }

      .newone-icon-svg {
        display: block;
        color: inherit;
      }

      .newone-icon-svg ::ng-deep svg {
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
})
export class NewOneIconComponent {
  readonly iconKey = input.required<string>();
  readonly size = input<number>(18);

  private readonly sanitizer = inject(DomSanitizer);

  protected readonly svgHtml = computed(() => {
    const markup = NEWONE_ICON_SVG[this.iconKey()] ?? NEWONE_ICON_SVG['menu'];
    return this.sanitizer.bypassSecurityTrustHtml(markup);
  });
}
