import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { UserAuditSearchRequest, UserAuditSearchResponse } from './useraudit.model';

@Injectable({ providedIn: 'root' })
export class UserAuditService {
  private readonly api = inject(ApiService);

  search(body: UserAuditSearchRequest): Observable<UserAuditSearchResponse> {
    return this.api.post<UserAuditSearchRequest, UserAuditSearchResponse>('admin/audit/get', body).pipe(
      map(
        (res) =>
          res.data ?? {
            totalCount: 0,
            pageNumber: body.pageNumber,
            pageSize: body.pageSize,
            totalPages: 0,
            items: [],
          },
      ),
    );
  }
}
