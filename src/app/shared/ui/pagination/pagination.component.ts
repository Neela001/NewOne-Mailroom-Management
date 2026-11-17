import { Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

// Client-side pagination (slices an already-fetched row array) — the real
// list APIs this app calls (see master-list.component.ts's own loadList())
// have no page/pageSize request params, only searchText/isActive, so this
// paginates display only and never changes what's requested from the API.
// Icon + range on the left, a chevron/circular-page-number/chevron pager on
// the right — matching the reference's own pagination treatment.
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (total() > 0) {
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-navy-200 px-3 py-3 text-[13px] text-navy-500">
        <span class="flex items-center gap-2">
          <app-icon name="menu" [size]="15" class="text-navy-400" />
          {{ rangeLabel() }}
        </span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-full text-navy-500 transition-colors hover:bg-navy-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            [disabled]="page() <= 1"
            (click)="goTo(page() - 1)"
            aria-label="Previous page"
          >
            <app-icon name="chevron_left" [size]="16" />
          </button>
          <span class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{{ page() }}</span>
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-full text-navy-500 transition-colors hover:bg-navy-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            [disabled]="page() >= totalPages()"
            (click)="goTo(page() + 1)"
            aria-label="Next page"
          >
            <app-icon name="chevron_right" [size]="16" />
          </button>
        </div>
      </div>
    }
  `,
})
export class PaginationComponent {
  readonly total = input.required<number>();
  readonly pageSize = input(10);
  readonly page = input(1);
  readonly pageChange = output<number>();

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly rangeLabel = computed(() => {
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(this.total(), this.page() * this.pageSize());
    return `${start}–${end} of ${this.total()}`;
  });

  protected goTo(target: number): void {
    const clamped = Math.min(Math.max(1, target), this.totalPages());
    if (clamped !== this.page()) this.pageChange.emit(clamped);
  }
}
