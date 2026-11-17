import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { VoterService } from './voter.service';
import { ConfigService } from '../../../core/services/config.service';

// CONFIRMED LIVE (real backend, real account, 2026-11-11): see voter.model.ts's
// own comment for the real master/voter-record/* endpoints and response
// shapes this is built against.
describe('VoterService', () => {
  let service: VoterService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(VoterService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  it('get() normalizes the real PascalCase /get response to camelCase', () => {
    let result: unknown[] | undefined;
    service.get({ searchText: null, isActive: null }).subscribe((rows) => (result = rows));

    const req = httpMock.expectOne(apiUrl('master/voter-record/get'));
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, data: [{ VoterRecordId: '1', VoterId: 'V1', Name: 'குருமாரி', IsActive: true }] });

    expect(result).toEqual([{ voterRecordId: '1', voterId: 'V1', name: 'குருமாரி', isActive: true }]);
  });

  it('get() returns [] when data is not an array', () => {
    let result: unknown[] | undefined;
    service.get({ searchText: null, isActive: null }).subscribe((rows) => (result = rows));

    httpMock.expectOne(apiUrl('master/voter-record/get')).flush({ success: true, data: null });

    expect(result).toEqual([]);
  });

  it('add() posts to master/voter-record/add', () => {
    service.add({ wardNo: '1', boothNo: '1', serialNumber: 1, voterId: 'V1', name: 'Test' }).subscribe();

    const req = httpMock.expectOne(apiUrl('master/voter-record/add'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.voterId).toBe('V1');
    req.flush({ success: true, data: null });
  });

  it('edit() posts to master/voter-record/edit with the existing voterRecordId', () => {
    service.edit({ voterRecordId: 'id-1', name: 'Updated' }).subscribe();

    const req = httpMock.expectOne(apiUrl('master/voter-record/edit'));
    expect(req.request.body.voterRecordId).toBe('id-1');
    req.flush({ success: true, data: null });
  });

  it('delete() posts the voterRecordId to master/voter-record/delete', () => {
    service.delete('id-1').subscribe();

    const req = httpMock.expectOne(apiUrl('master/voter-record/delete'));
    expect(req.request.body).toEqual({ voterRecordId: 'id-1' });
    req.flush({ success: true, data: null });
  });

  it('history() does NOT normalize — the real response is already camelCase', () => {
    let result: unknown[] | undefined;
    service.history('id-1').subscribe((rows) => (result = rows));

    const req = httpMock.expectOne(apiUrl('master/voter-record/history/get'));
    expect(req.request.body).toEqual({ voterRecordId: 'id-1' });
    req.flush({ success: true, data: [{ voterRecordHistoryId: 1, voterRecordId: 'id-1', actionType: 'CREATE' }] });

    expect(result).toEqual([{ voterRecordHistoryId: 1, voterRecordId: 'id-1', actionType: 'CREATE' }]);
  });

  it('importBatch() posts the records array and unwraps results by clientRowId', () => {
    let result: unknown[] | undefined;
    service.importBatch([{ clientRowId: 'c1', voterId: 'V1', serialNumber: 1, name: 'Test' }]).subscribe((r) => (result = r));

    const req = httpMock.expectOne(apiUrl('master/voter-record/import-batch'));
    expect(req.request.body.records).toEqual([{ clientRowId: 'c1', voterId: 'V1', serialNumber: 1, name: 'Test' }]);
    req.flush({ success: true, data: { results: [{ clientRowId: 'c1', success: true, voterRecordId: 'new-id' }] } });

    expect(result).toEqual([{ clientRowId: 'c1', success: true, voterRecordId: 'new-id' }]);
  });
});
