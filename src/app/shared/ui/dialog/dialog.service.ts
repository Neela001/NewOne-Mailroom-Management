import { Injectable, Injector, Type, inject } from '@angular/core';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { FocusTrapFactory } from '@angular/cdk/a11y';
import { DIALOG_DATA } from './dialog-data.token';
import { DialogRef } from './dialog-ref';

export interface DialogConfig<D = unknown> {
  data?: D;
  width?: string;
  maxWidth?: string;
  // Optional — every existing call site omits these and keeps today's
  // content-driven height capped by .app-dialog-panel's own max-height:90vh
  // (see that class's own comment). Only a dialog that genuinely needs to
  // fill most of the viewport (e.g. Email Settings opened from within Add
  // Desk — see desk-form-dialog.component.ts's own openEmailSettings()
  // comment) sets these, together with a panelClass that makes its own
  // root a flex column so ITS OWN inner scrollable region (not this whole
  // panel) does the scrolling.
  height?: string;
  maxHeight?: string;
  panelClass?: string | string[];
}

// Replaces @angular/material's MatDialog — a minimal, fully custom modal
// host built directly on @angular/cdk/overlay (the headless, unstyled
// positioning/scroll-lock/backdrop primitives Material's own dialog is
// itself built on). @angular/cdk carries no default visual appearance of
// its own (unlike @angular/material, which is what the redesign brief
// means by "no Angular Material appearance") — it's the same category of
// dependency as @angular/cdk/layout's BreakpointObserver, already used
// elsewhere in this app without controversy. The actual panel chrome
// (white surface, radius, shadow, 90vh scroll cap) is this app's own CSS —
// see styles.scss's own .app-dialog-panel/.app-dialog-backdrop.
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  private readonly focusTrapFactory = inject(FocusTrapFactory);

  open<C, D = unknown, R = unknown>(component: Type<C>, config: DialogConfig<D> = {}): DialogRef<R> {
    const panelClasses = ['app-dialog-panel', ...(Array.isArray(config.panelClass) ? config.panelClass : config.panelClass ? [config.panelClass] : [])];

    const overlayRef = this.overlay.create({
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      scrollStrategy: this.overlay.scrollStrategies.block(),
      hasBackdrop: true,
      backdropClass: 'app-dialog-backdrop',
      panelClass: panelClasses,
      width: config.width,
      maxWidth: config.maxWidth ?? '94vw',
      height: config.height,
      maxHeight: config.maxHeight,
    });

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTrap = this.focusTrapFactory.create(overlayRef.overlayElement);
    const dialogRef = new DialogRef<R>(overlayRef, focusTrap, previouslyFocused);

    const dialogInjector = Injector.create({
      parent: this.injector,
      providers: [
        { provide: DIALOG_DATA, useValue: config.data },
        { provide: DialogRef, useValue: dialogRef },
      ],
    });

    overlayRef.attach(new ComponentPortal(component, null, dialogInjector));
    focusTrap.focusInitialElementWhenReady();

    overlayRef.backdropClick().subscribe(() => dialogRef.close());
    overlayRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dialogRef.close();
      }
    });

    return dialogRef;
  }
}
