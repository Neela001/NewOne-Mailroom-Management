import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';
import { normalizeRowKeys } from '../../master/shared/pascal-case.util';
import { VoterBatchResult, VoterBatchRow, VoterGetRequest, VoterHistoryRow, VoterRow, VoterSaveRequest } from './voter.model';

// Dedicated service for Voter's own shape — see voter.model.ts's own
// comment for the real master/voter-record/* endpoints this is built
// against (one combined import-batch endpoint, separate add/edit rather
// than Desk's own single save-with-locations, a real typed/camelCase
// history response unlike Desk/Email Setting's own PascalCase history).
@Injectable({ providedIn: 'root' })
export class VoterService {
  private readonly api = inject(ApiService);

  // CONFIRMED LIVE: like every other master entity's own untyped `/get`,
  // this one comes back raw PascalCase — normalized the same way
  // MasterApiService.get() already does for every other entity (see
  // pascal-case.util.ts's own comment), since this dedicated service
  // calls ApiService directly.
  get(body: VoterGetRequest): Observable<VoterRow[]> {
    return this.api.post<VoterGetRequest, unknown>('master/voter-record/get', body).pipe(
      map((res) => {
        const data = res.data;
        if (!Array.isArray(data)) return [];
        return data.map((row) => normalizeRowKeys(row as Record<string, unknown>)) as unknown as VoterRow[];
      }),
    );
  }

  add(body: VoterSaveRequest): Observable<ApiResponse<unknown>> {
    return this.api.post<VoterSaveRequest, unknown>('master/voter-record/add', body);
  }

  edit(body: VoterSaveRequest): Observable<ApiResponse<unknown>> {
    return this.api.post<VoterSaveRequest, unknown>('master/voter-record/edit', body);
  }

  delete(voterRecordId: string): Observable<ApiResponse<unknown>> {
    return this.api.post<{ voterRecordId: string }, unknown>('master/voter-record/delete', { voterRecordId });
  }

  // CONFIRMED LIVE: unlike Desk/Email Setting, this history endpoint has a
  // real typed response schema (VoterRecordHistoryResponseListApiResponse)
  // and comes back properly camelCase already — no normalizeRowKeys()
  // needed here.
  history(voterRecordId: string): Observable<VoterHistoryRow[]> {
    return this.api.post<{ voterRecordId: string }, VoterHistoryRow[]>('master/voter-record/history/get', { voterRecordId }).pipe(map((res) => res.data ?? []));
  }

  // The ONLY real import mechanism (see voter.model.ts's own comment for
  // why this is a plain structured-row batch, not a file upload) — the
  // response's own per-row results are matched back to the submitted rows
  // by clientRowId.
  importBatch(records: VoterBatchRow[]): Observable<VoterBatchResult[]> {
    return this.api.post<{ records: VoterBatchRow[] }, { results: VoterBatchResult[] }>('master/voter-record/import-batch', { records }).pipe(map((res) => res.data?.results ?? []));
  }
}
