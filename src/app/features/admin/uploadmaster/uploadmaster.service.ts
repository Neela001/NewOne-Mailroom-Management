import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';
import { normalizeRowKeys } from '../../master/shared/pascal-case.util';
import { UploadDefinitionGetRequest, UploadDefinitionHistoryRow, UploadDefinitionRow, UploadDefinitionSaveRequest, UploadProcedureOption } from './uploadmaster.model';

// Dedicated service for Upload Master's own shape — see uploadmaster.
// model.ts's own comment for the real admin/upload-master/* endpoints
// this is built against.
@Injectable({ providedIn: 'root' })
export class UploadMasterService {
  private readonly api = inject(ApiService);

  // CONFIRMED LIVE: like every other master entity's own untyped `/get`,
  // this one comes back raw PascalCase.
  get(body: UploadDefinitionGetRequest): Observable<UploadDefinitionRow[]> {
    return this.api.post<UploadDefinitionGetRequest, unknown>('admin/upload-master/get', body).pipe(
      map((res) => {
        const data = res.data;
        if (!Array.isArray(data)) return [];
        return data.map((row) => normalizeRowKeys(row as Record<string, unknown>)) as unknown as UploadDefinitionRow[];
      }),
    );
  }

  add(body: UploadDefinitionSaveRequest): Observable<ApiResponse<unknown>> {
    return this.api.post<UploadDefinitionSaveRequest, unknown>('admin/upload-master/add', body);
  }

  edit(body: UploadDefinitionSaveRequest): Observable<ApiResponse<unknown>> {
    return this.api.post<UploadDefinitionSaveRequest, unknown>('admin/upload-master/edit', body);
  }

  delete(uploadDefinitionId: string): Observable<ApiResponse<unknown>> {
    return this.api.post<{ uploadDefinitionId: string }, unknown>('admin/upload-master/delete', { uploadDefinitionId });
  }

  // CONFIRMED LIVE: unlike Voter's own typed/camelCase history, this one
  // comes back raw PascalCase too (same fix as Desk/Email Setting).
  history(uploadDefinitionId: string): Observable<UploadDefinitionHistoryRow[]> {
    return this.api.post<{ uploadDefinitionId: string }, unknown>('admin/upload-master/history/get', { uploadDefinitionId }).pipe(
      map((res) => {
        const data = res.data;
        if (!Array.isArray(data)) return [];
        return data.map((row) => normalizeRowKeys(row as Record<string, unknown>)) as unknown as UploadDefinitionHistoryRow[];
      }),
    );
  }

  // CONFIRMED LIVE: no request body; returns the real, backend-pre-filtered
  // list of compatible procedures (also raw PascalCase) — see
  // uploadmaster.model.ts's own UploadProcedureOption comment.
  procedures(): Observable<UploadProcedureOption[]> {
    return this.api.post<Record<string, never>, unknown>('admin/upload-master/procedures/get', {}).pipe(
      map((res) => {
        const data = res.data;
        if (!Array.isArray(data)) return [];
        return data.map((row) => normalizeRowKeys(row as Record<string, unknown>)) as unknown as UploadProcedureOption[];
      }),
    );
  }
}
