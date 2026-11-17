import { OverlayRef } from '@angular/cdk/overlay';
import { FocusTrap } from '@angular/cdk/a11y';
import { Observable, Subject } from 'rxjs';

// Our own replacement for @angular/material's MatDialogRef — same shape
// (close(result) / afterClosed()) so call sites that already did
// `dialog.open(...).afterClosed().subscribe(...)` against MatDialog needed
// no change beyond the import, just the underlying service.
export class DialogRef<R = unknown> {
  private readonly closedSubject = new Subject<R | undefined>();
  private closed = false;

  constructor(
    private readonly overlayRef: OverlayRef,
    private readonly focusTrap: FocusTrap,
    private readonly restoreFocusTo: HTMLElement | null,
  ) {}

  close(result?: R): void {
    if (this.closed) return;
    this.closed = true;
    this.focusTrap.destroy();
    this.overlayRef.dispose();
    this.restoreFocusTo?.focus({ preventScroll: true });
    this.closedSubject.next(result);
    this.closedSubject.complete();
  }

  afterClosed(): Observable<R | undefined> {
    return this.closedSubject.asObservable();
  }
}
