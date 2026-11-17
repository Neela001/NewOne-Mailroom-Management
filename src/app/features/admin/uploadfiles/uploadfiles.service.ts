import { HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';
import { normalizeRowKeys } from '../../master/shared/pascal-case.util';
import { UploadContextOption, UploadFileDefinitionRow, UploadJobHistoryRow, UploadJobRow, UploadSubmitRequest } from './uploadfiles.model';

function pick<T>(row: Record<string, unknown>, keys: string[]): T | undefined {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key] as T;
  }
  return undefined;
}

// See uploadfiles.model.ts's own UploadJobRow comment for why these
// aliases exist and must be re-verified against a real job row.
function mapUploadJobRow(raw: Record<string, unknown>): UploadJobRow {
  const row = normalizeRowKeys(raw);
  return {
    uploadId: pick<string>(row, ['uploadId', 'id']) ?? '',
    uploadNo: pick(row, ['uploadNo', 'uploadNumber', 'jobNo', 'jobNumber']),
    uploadDefinitionId: pick(row, ['uploadDefinitionId', 'definitionId']),
    uploadName: pick(row, ['uploadName', 'definitionName']),
    uploadedAt: pick(row, ['uploadedAt', 'createdAt', 'submittedAt', 'requestedAt']),
    totalCount: pick(row, ['totalCount', 'total', 'totalRecords', 'totalRows']),
    successCount: pick(row, ['successCount', 'success', 'successRecords', 'successRows']),
    failedCount: pick(row, ['failedCount', 'failed', 'failedRecords', 'failedRows']),
    status: pick(row, ['currentStatus', 'status', 'jobStatus']),
    remarks: pick(row, ['remarks', 'remark', 'message']),
  };
}

function mapUploadJobHistoryRow(raw: Record<string, unknown>): UploadJobHistoryRow {
  const row = normalizeRowKeys(raw);
  return {
    uploadId: pick<string>(row, ['uploadId', 'id']) ?? '',
    actionDate: pick(row, ['actionDate']),
    actionType: pick(row, ['actionType']),
    actionBy: pick(row, ['actionBy']),
    uploadNo: pick(row, ['uploadNo', 'uploadNumber', 'jobNo', 'jobNumber']),
    uploadName: pick(row, ['uploadName', 'definitionName']),
    totalCount: pick(row, ['totalCount', 'total', 'totalRecords', 'totalRows']),
    successCount: pick(row, ['successCount', 'success', 'successRecords', 'successRows']),
    failedCount: pick(row, ['failedCount', 'failed', 'failedRecords', 'failedRows']),
    status: pick(row, ['currentStatus', 'status', 'jobStatus']),
    remarks: pick(row, ['remarks', 'remark', 'message']),
  };
}

// Dedicated service for Upload Files' own shape — see uploadfiles.model.ts's
// own comment for the real admin/uploads/* ("UploadQueue") endpoints this is
// built against.
@Injectable({ providedIn: 'root' })
export class UploadFilesService {
  private readonly api = inject(ApiService);

  // CONFIRMED LIVE: no request body; returns ONLY active Upload Master
  // definitions (PascalCase at runtime, like every other untyped `/get`).
  definitions(): Observable<UploadFileDefinitionRow[]> {
    return this.api.post<Record<string, never>, unknown>('admin/uploads/definitions/get', {}).pipe(
      map((res) => {
        const data = res.data;
        if (!Array.isArray(data)) return [];
        return data.map((row) => normalizeRowKeys(row as Record<string, unknown>)) as unknown as UploadFileDefinitionRow[];
      }),
    );
  }

  // uploadId: null -> all jobs (the listing's own load/refresh call).
  jobs(uploadId: string | null = null): Observable<UploadJobRow[]> {
    return this.api.post<{ uploadId: string | null }, unknown>('admin/uploads/get', { uploadId }).pipe(
      map((res) => {
        const data = res.data;
        if (!Array.isArray(data)) return [];
        return data.map((row) => mapUploadJobRow(row as Record<string, unknown>));
      }),
    );
  }

  history(uploadId: string): Observable<UploadJobHistoryRow[]> {
    return this.api.post<{ uploadId: string }, unknown>('admin/uploads/history/get', { uploadId }).pipe(
      map((res) => {
        const data = res.data;
        if (!Array.isArray(data)) return [];
        return data.map((row) => mapUploadJobHistoryRow(row as Record<string, unknown>));
      }),
    );
  }

  // CONFIRMED LIVE: returns `data: []` for both real active definitions
  // today (neither currently declares a context parameter) — wired for the
  // day one does, never hardcoded.
  contexts(definitionId: string): Observable<UploadContextOption[]> {
    return this.api.post<{ definitionId: string }, unknown>('admin/uploads/contexts/get', { definitionId }).pipe(
      map((res) => {
        const data = res.data;
        if (!Array.isArray(data)) return [];
        return data.map((row) => normalizeRowKeys(row as Record<string, unknown>)) as unknown as UploadContextOption[];
      }),
    );
  }

  submit(request: UploadSubmitRequest): Observable<HttpEvent<ApiResponse<unknown>>> {
    const form = new FormData();
    form.set('DefinitionId', request.definitionId);
    if (request.contextId) form.set('ContextId', request.contextId);
    form.set('RequestId', request.requestId);
    form.set('File', request.file, request.file.name);
    return this.api.postMultipartWithProgress<unknown>('admin/uploads/submit', form);
  }

  // CONFIRMED LIVE: real .xlsx binary, but Content-Disposition's filename
  // isn't readable from the browser (see uploadfiles.model.ts's own
  // comment) — callers build their own filename from the definition's
  // own uploadName.
  downloadTemplate(definitionId: string): Observable<Blob> {
    return this.api.getBlob(`admin/uploads/template/${definitionId}`);
  }

  downloadResult(uploadId: string, failedOnly: boolean): Observable<Blob> {
    return this.api.getBlob(`admin/uploads/${uploadId}/result?failedOnly=${failedOnly}`);
  }
}
