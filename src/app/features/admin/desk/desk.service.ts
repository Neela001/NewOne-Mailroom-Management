import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';
import { normalizeRowKeys } from '../../master/shared/pascal-case.util';
import {
  DeskDeleteRequest,
  DeskGetRequest,
  DeskHistoryRow,
  DeskLocationOption,
  DeskLocationOptionsRequest,
  DeskLocationRow,
  DeskRow,
  DeskSaveWithLocationsRequest,
} from './desk.model';

// Dedicated service for Desk's own non-generic shape (one combined
// save-with-locations endpoint, a site-scoped location-options catalog) —
// see desk.model.ts's own comment for the real `master/desk/*` endpoints
// this was corrected to use, and why Desk isn't MasterApiService-driven.
@Injectable({ providedIn: 'root' })
export class DeskService {
  private readonly api = inject(ApiService);

  // CONFIRMED LIVE: like every other master entity's own untyped `/get`,
  // this one comes back raw PascalCase — normalized the same way
  // MasterApiService.get() already does for every other entity (see
  // pascal-case.util.ts's own comment), since this dedicated service
  // calls ApiService directly rather than going through it.
  get(body: DeskGetRequest): Observable<DeskRow[]> {
    return this.api.post<DeskGetRequest, unknown>('master/desk/get', body).pipe(
      map((res) => {
        const data = res.data;
        if (!Array.isArray(data)) return [];
        return data.map((row) => normalizeRowKeys(row as Record<string, unknown>)) as unknown as DeskRow[];
      }),
    );
  }

  save(body: DeskSaveWithLocationsRequest): Observable<ApiResponse<unknown>> {
    return this.api.post<DeskSaveWithLocationsRequest, unknown>('master/desk/save-with-locations', body);
  }

  delete(body: DeskDeleteRequest): Observable<ApiResponse<unknown>> {
    return this.api.post<DeskDeleteRequest, unknown>('master/desk/delete', body);
  }

  history(deskId: string): Observable<DeskHistoryRow[]> {
    return this.api.post<{ deskId: string }, unknown>('master/desk/history/get', { deskId }).pipe(
      map((res) => {
        const data = res.data;
        if (!Array.isArray(data)) return [];
        return data.map((row) => normalizeRowKeys(row as Record<string, unknown>)) as unknown as DeskHistoryRow[];
      }),
    );
  }

  // siteId required, deskId optional — passing the desk being edited flags
  // its own already-assigned combinations via isChecked (see
  // desk.model.ts's own DeskLocationOption comment).
  locationOptions(body: DeskLocationOptionsRequest): Observable<DeskLocationOption[]> {
    return this.api.post<DeskLocationOptionsRequest, unknown>('master/desk/location-options/get', body).pipe(
      map((res) => {
        const data = res.data;
        if (!Array.isArray(data)) return [];
        return data.map((row) => normalizeRowKeys(row as Record<string, unknown>)) as unknown as DeskLocationOption[];
      }),
    );
  }

  locations(deskId: string): Observable<DeskLocationRow[]> {
    return this.api.post<{ deskId: string }, unknown>('master/desk/location/get', { deskId }).pipe(
      map((res) => {
        const data = res.data;
        if (!Array.isArray(data)) return [];
        return data.map((row) => normalizeRowKeys(row as Record<string, unknown>)) as unknown as DeskLocationRow[];
      }),
    );
  }
}
