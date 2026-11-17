import { InjectionToken } from '@angular/core';

// Our own replacement for @angular/material's MAT_DIALOG_DATA — same role
// (the per-open `data` payload, injected into the opened component), no
// Material dependency. See dialog.service.ts's own comment for the rest of
// the replacement.
export const DIALOG_DATA = new InjectionToken<unknown>('DIALOG_DATA');
