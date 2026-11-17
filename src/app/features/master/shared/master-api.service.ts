import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';
import { normalizeRowKeys } from './pascal-case.util';

// Generic client for the one identical shape every master entity's own
// add/edit/delete/get/history/get action follows — see
// master-entity-config.model.ts's own comment for why this is one shared
// service, not one per entity.
@Injectable({ providedIn: 'root' })
export class MasterApiService {
  private readonly api = inject(ApiService);

  add<TReq>(apiBasePath: string, body: TReq): Observable<ApiResponse<unknown>> {
    return this.api.post(`${apiBasePath}/add`, body);
  }

  edit<TReq>(apiBasePath: string, body: TReq): Observable<ApiResponse<unknown>> {
    return this.api.post(`${apiBasePath}/edit`, body);
  }

  delete<TReq>(apiBasePath: string, body: TReq): Observable<ApiResponse<unknown>> {
    return this.api.post(`${apiBasePath}/delete`, body);
  }

  // CONFIRMED FROM THE REAL SPEC: every master entity's own /get response
  // documents `data` as untyped (`ObjectApiResponse` — no schema at all),
  // unlike /history/get which is a real, typed List<T> — see
  // api-response.model.ts's own comment. Normalizes defensively: an array
  // is used as-is, a single object becomes a 1-row array, anything else
  // becomes an empty list — never throws on an unexpected shape.
  //
  // CONFIRMED LIVE (real backend, real account, 2026-10-16): this untyped
  // shape is actually PascalCase at runtime (e.g. `CountryCode`,
  // `ISDCode`), not the camelCase used everywhere else in the API,
  // including this same entity's own /add and /history/get. Every row is
  // run through normalizeRowKeys() to convert it to the camelCase this
  // app's configs already use — see pascal-case.util.ts's own comment for
  // the full evidence and why this is isolated to /get specifically.
  get<TReq, TRow>(apiBasePath: string, body: TReq): Observable<TRow[]> {
    return this.api.post<TReq, unknown>(`${apiBasePath}/get`, body).pipe(
      map((res) => {
        const data = res.data;
        if (Array.isArray(data)) return data.map((row) => normalizeRowKeys(row as Record<string, unknown>)) as TRow[];
        if (data && typeof data === 'object') return [normalizeRowKeys(data as Record<string, unknown>)] as TRow[];
        return [];
      }),
    );
  }

  history<TReq, TRow>(apiBasePath: string, body: TReq): Observable<TRow[]> {
    return this.api.post<TReq, TRow[]>(`${apiBasePath}/history/get`, body).pipe(map((res) => res.data ?? []));
  }
}
