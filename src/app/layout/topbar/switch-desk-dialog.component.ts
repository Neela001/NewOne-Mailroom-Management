import { Component, computed, inject, signal } from '@angular/core';
import { DialogRef } from '../../shared/ui/dialog/dialog-ref';
import { DeskContextService } from '../../core/services/desk-context.service';
import { DeskAssignmentRow } from '../../core/models/desk.model';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

// "Switch Desk" — lets the user pick which of their own REAL assigned desks
// (DeskContextService.assignedDesks(), from admin/desk-user/me/get) is
// "current" for this session. See desk-context.service.ts's own comment for
// why this is honestly a client-side, per-session preference rather than a
// real server-side desk switch: no such endpoint exists in the live
// backend, and no currently-implemented screen in this app consumes a
// deskId to scope its data in the first place (no live transaction/report
// endpoints at all yet). selectDesk() itself is the real enforcement point
// (only ever accepts a desk actually present in the server-fetched list) --
// this component never writes to DeskContextService's storage directly.
@Component({
  selector: 'app-switch-desk-dialog',
  standalone: true,
  imports: [ButtonComponent, IconComponent, EmptyStateComponent],
  templateUrl: './switch-desk-dialog.component.html',
  styleUrl: './switch-desk-dialog.component.scss',
})
export class SwitchDeskDialogComponent {
  protected readonly deskContext = inject(DeskContextService);
  private readonly toast = inject(ToastService);
  protected readonly dialogRef = inject(DialogRef<boolean>);

  // A locally-highlighted row, separate from DeskContextService's own
  // currentDesk() — lets the user move the selection (click or arrow keys)
  // before committing with the Switch button or Enter, without changing
  // the session's actual current desk until they do.
  protected readonly highlightedDeskId = signal<string | null>(this.deskContext.currentDesk()?.deskId ?? null);
  protected readonly switching = signal(false);

  protected readonly rows = computed(() => this.deskContext.assignedDesks());

  protected readonly highlightedIsCurrent = computed(() => this.highlightedDeskId() === this.deskContext.currentDesk()?.deskId);

  constructor() {
    if (!this.deskContext.hasLoaded()) {
      this.deskContext.loadAssignments();
    }
  }

  protected selectRow(row: DeskAssignmentRow): void {
    this.highlightedDeskId.set(row.deskId);
  }

  // Arrow-key navigation over the table rows, Enter to switch to whichever
  // row is currently highlighted — the keyboard-navigation requirement this
  // dialog is built to satisfy, not just mouse row selection.
  protected onTableKeydown(event: KeyboardEvent): void {
    const list = this.rows();
    if (list.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const currentIndex = list.findIndex((r) => r.deskId === this.highlightedDeskId());
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = currentIndex < 0 ? 0 : Math.max(0, Math.min(list.length - 1, currentIndex + delta));
      this.highlightedDeskId.set(list[nextIndex].deskId);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.confirmSwitch();
    }
  }

  protected reload(): void {
    this.deskContext.loadAssignments();
  }

  protected close(): void {
    this.dialogRef.close(false);
  }

  protected confirmSwitch(): void {
    const deskId = this.highlightedDeskId();
    if (!deskId || this.switching() || this.highlightedIsCurrent()) return;

    this.switching.set(true);
    const row = this.rows().find((r) => r.deskId === deskId);
    const ok = this.deskContext.selectDesk(deskId);
    this.switching.set(false);

    if (ok) {
      this.toast.show(`Switched to ${row?.deskName ?? 'the selected desk'}.`);
      this.dialogRef.close(true);
    } else {
      this.toast.show('That desk is no longer assigned to you. Reload and try again.', 'error');
    }
  }
}
