import { TestBed } from '@angular/core/testing';
import { HttpEventType } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { UploadFilesService } from './uploadfiles.service';
import { ConfigService } from '../../../core/services/config.service';

// CONFIRMED LIVE (real backend, real account, 2026-11-12): see
// uploadfiles.model.ts's own comment for the real admin/uploads/*
// endpoints and response shapes this is built against. admin/uploads/get
// and admin/uploads/history/get both CONFIRMED LIVE return `data: []` on
// this real account (no Upload Files job has ever been run) — the job-row
// field-name tests below therefore use a synthetic row shaped from the
// task's own stated columns, flagged as unconfirmed pending a real job
// (see mapUploadJobRow's own comment in uploadfiles.service.ts).
describe('UploadFilesService', () => {
  let service: UploadFilesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(UploadFilesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  it('definitions() posts no body and normalizes the real PascalCase response to camelCase', () => {
    let result: unknown[] | undefined;
    service.definitions().subscribe((rows) => (result = rows));

    const req = httpMock.expectOne(apiUrl('admin/uploads/definitions/get'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ success: true, data: [{ UploadDefinitionId: 'd1', UploadName: 'Country Vertical Data', ContextParameterName: null, IsActive: true }] });

    expect(result).toEqual([{ uploadDefinitionId: 'd1', uploadName: 'Country Vertical Data', contextParameterName: null, isActive: true }]);
  });

  it('jobs() posts uploadId and maps the job row using the documented field aliases', () => {
    let result: unknown[] | undefined;
    service.jobs(null).subscribe((rows) => (result = rows));

    const req = httpMock.expectOne(apiUrl('admin/uploads/get'));
    expect(req.request.body).toEqual({ uploadId: null });
    req.flush({
      success: true,
      data: [{ UploadId: 'u1', UploadNo: 'U-0001', UploadName: 'Country Vertical Data', UploadedAt: '2026-11-12T00:00:00Z', TotalCount: 10, SuccessCount: 8, FailedCount: 2, CurrentStatus: 'Completed', Remarks: 'Done' }],
    });

    expect(result).toEqual([
      {
        uploadId: 'u1',
        uploadNo: 'U-0001',
        uploadDefinitionId: undefined,
        uploadName: 'Country Vertical Data',
        uploadedAt: '2026-11-12T00:00:00Z',
        totalCount: 10,
        successCount: 8,
        failedCount: 2,
        status: 'Completed',
        remarks: 'Done',
      },
    ]);
  });

  it('jobs() returns [] when data is not an array', () => {
    let result: unknown[] | undefined;
    service.jobs(null).subscribe((rows) => (result = rows));

    httpMock.expectOne(apiUrl('admin/uploads/get')).flush({ success: true, data: null });

    expect(result).toEqual([]);
  });

  it('history() posts the required uploadId', () => {
    service.history('u1').subscribe();

    const req = httpMock.expectOne(apiUrl('admin/uploads/history/get'));
    expect(req.request.body).toEqual({ uploadId: 'u1' });
    req.flush({ success: true, data: [] });
  });

  it('contexts() posts the definitionId', () => {
    service.contexts('d1').subscribe();

    const req = httpMock.expectOne(apiUrl('admin/uploads/contexts/get'));
    expect(req.request.body).toEqual({ definitionId: 'd1' });
    req.flush({ success: true, data: [] });
  });

  it('submit() posts multipart form data with DefinitionId/RequestId/File and reports progress + the final response', () => {
    const file = new File(['x'], 'test.xlsx');
    const events: unknown[] = [];
    service.submit({ definitionId: 'd1', requestId: 'r1', file }).subscribe((event) => events.push(event));

    const req = httpMock.expectOne(apiUrl('admin/uploads/submit'));
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('DefinitionId')).toBe('d1');
    expect(body.get('RequestId')).toBe('r1');
    expect(body.get('ContextId')).toBeNull();
    expect((body.get('File') as File).name).toBe('test.xlsx');

    req.flush({ success: true, data: null });
    const response = events.find((e) => (e as { type: number }).type === HttpEventType.Response) as { body: { success: boolean } } | undefined;
    expect(response?.body.success).toBe(true);
  });

  it('downloadTemplate() GETs the real template endpoint as a blob', () => {
    let result: Blob | undefined;
    service.downloadTemplate('d1').subscribe((blob) => (result = blob));

    const req = httpMock.expectOne(apiUrl('admin/uploads/template/d1'));
    expect(req.request.method).toBe('GET');
    req.flush(new Blob(['fake xlsx']));

    expect(result).toBeInstanceOf(Blob);
  });

  it('downloadResult() GETs the real result endpoint with failedOnly in the query string', () => {
    service.downloadResult('u1', true).subscribe();

    const req = httpMock.expectOne(apiUrl('admin/uploads/u1/result?failedOnly=true'));
    expect(req.request.method).toBe('GET');
    req.flush(new Blob(['fake xlsx']));
  });
});
