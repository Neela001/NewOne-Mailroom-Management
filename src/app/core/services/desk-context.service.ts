import { Injectable, computed, inject, signal } from '@angular/core';
import { MasterApiService } from '../../features/master/shared/master-api.service';
import { StorageService } from './storage.service';
import { StorageKey } from '../models/storage-key.enum';
import { DeskAssignmentRow } from '../models/desk.model';

// Holds this session's "current desk" — which of the user's own REAL
// assigned desks (admin/desk-user/me/get, confirmed live) the app is
// currently operating as. Reuses MasterApiService.get() rather than calling
// ApiService directly, since this endpoint shares the exact same
// undocumented-but-confirmed-PascalCase `/get` response shape every other
// master/admin entity's own `/get` has (see pascal-case.util.ts's own
// comment) — MasterApiService.get() already normalizes that correctly.
//
// IMPORTANT, CONFIRMED FROM THE LIVE SPEC (2026-11-06): there is NO
// server-side "active/current desk" concept anywhere in this backend --
// no field on LoginResponse, no claim in the JWT, no header convention in
// any security scheme, and no endpoint of any kind to set one (the only
// desk-user mutation endpoint, admin/desk-user/save, is the ADMIN screen
// that assigns which desks a user may use and which is their permanent
// default — DeskUserSaveRequest.deskIds/defaultDeskId -- not something the
// logged-in user calls on themselves to switch desks for a session). Nor
// does any CURRENTLY IMPLEMENTED list/search endpoint in this app accept a
// deskId to scope its results — this build has no live inward/outward
// courier, transaction, or report endpoints at all (confirmed against the
// live spec's own tag list), only master/admin data, none of which is
// desk-scoped.
//
// So "switching desks" here is honestly scoped to what the real backend
// actually supports today: a per-session, client-held preference (which of
// the user's own real assigned desks is "current"), enforced to always be
// one of the rows this endpoint actually returned (selectDesk() refuses
// any id not in that real list — never trusts a bare id from the UI layer
// alone) and reflected in the header. It does NOT, and currently cannot,
// change what any API call returns, because nothing live in this backend
// takes a desk parameter to change by. The moment a real desk-scoped
// endpoint exists, this service's own currentDesk()/currentDeskId() is the
// one place that would feed it.
@Injectable({ providedIn: 'root' })
export class DeskContextService {
  private readonly masterApi = inject(MasterApiService);
  private readonly storage = inject(StorageService);

  readonly assignedDesks = signal<DeskAssignmentRow[]>([]);
  readonly isLoading = signal(false);
  readonly hasLoaded = signal(false);
  readonly loadError = signal<string | null>(null);

  private readonly selectedDeskId = signal<string | null>(this.storage.get<string>(StorageKey.CURRENT_DESK_ID));

  // The real row backing the "current desk" — the session's own explicit
  // selection if it's still among the real assigned desks, else the user's
  // real permanent default, else simply the first assigned desk. Never
  // null once hasLoaded() is true and at least one desk is assigned.
  readonly currentDesk = computed<DeskAssignmentRow | null>(() => {
    const desks = this.assignedDesks();
    const selectedId = this.selectedDeskId();
    return desks.find((d) => d.deskId === selectedId) ?? desks.find((d) => d.isDefault) ?? desks[0] ?? null;
  });

  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.loadAssignments();
  }

  loadAssignments(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.masterApi.get<Record<string, unknown>, DeskAssignmentRow>('admin/desk-user/me', {}).subscribe({
      next: (rows) => {
        this.isLoading.set(false);
        this.hasLoaded.set(true);
        this.assignedDesks.set(rows);

        // The session's own persisted pick is no longer a real assigned
        // desk (reassigned/deactivated server-side since it was chosen) --
        // drop it rather than silently keep pointing the header at a desk
        // this user may no longer have access to.
        const selectedId = this.selectedDeskId();
        if (selectedId && !rows.some((r) => r.deskId === selectedId)) {
          this.selectedDeskId.set(null);
          this.storage.remove(StorageKey.CURRENT_DESK_ID);
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.hasLoaded.set(true);
        this.loadError.set('Unable to load your assigned desks.');
      },
    });
  }

  // Only ever accepts a deskId that's actually present in the real,
  // server-fetched assignedDesks() list — never trusts an id supplied only
  // by the caller (see this file's own security note and the Switch Desk
  // dialog's own comment for why this is the enforcement point).
  selectDesk(deskId: string): boolean {
    const match = this.assignedDesks().find((d) => d.deskId === deskId && d.isAvailable !== false);
    if (!match) return false;
    this.selectedDeskId.set(deskId);
    this.storage.set(StorageKey.CURRENT_DESK_ID, deskId);
    return true;
  }
}
