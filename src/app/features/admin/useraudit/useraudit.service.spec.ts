import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { UserAuditService } from './useraudit.service';
import { ConfigService } from '../../../core/services/config.service';

describe('UserAuditService', () => {
  let service: UserAuditService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(UserAuditService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  it('search() posts pagination/filter fields to admin/audit/get', () => {
    service.search({ userName: 'alice', pageNumber: 2, pageSize: 20 }).subscribe();

    const req = httpMock.expectOne(apiUrl('admin/audit/get'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userName: 'alice', pageNumber: 2, pageSize: 20 });
    req.flush({ success: true, data: { totalCount: 0, pageNumber: 2, pageSize: 20, totalPages: 0, items: [] } });
  });

  it('search() falls back to an empty page rather than throwing when data is missing', () => {
    let result: { totalCount: number; items?: unknown[] | null } | undefined;
    service.search({ pageNumber: 1, pageSize: 20 }).subscribe((res) => (result = res));

    httpMock.expectOne(apiUrl('admin/audit/get')).flush({ success: false, data: null });

    expect(result?.totalCount).toBe(0);
    expect(result?.items).toEqual([]);
  });
});
