import { Component, computed, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { materialIconToLucide } from './icon-map';

// Drop-in replacement for <mat-icon>NAME</mat-icon> — same call-site shape
// (pass the SAME Material icon-ligature name every caller already has,
// including names read live from the backend's own menu iconName field),
// rendered as a Lucide SVG instead of the Material icon font. See
// icon-map.ts's own comment for the name-translation layer this wraps.
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [LucideDynamicIcon],
  template: `<svg [lucideIcon]="lucideName()" [size]="size()" [strokeWidth]="strokeWidth()" [class]="hostClass()"></svg>`,
  host: {
    class: 'inline-flex items-center justify-center shrink-0 leading-none',
  },
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input<number>(18);
  readonly strokeWidth = input<number>(1.75);
  readonly hostClass = input<string>('', { alias: 'class' });

  protected readonly lucideName = computed(() => materialIconToLucide(this.name()));
}
