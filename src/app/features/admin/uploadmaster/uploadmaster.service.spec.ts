import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { UploadMasterService } from './uploadmaster.service';
import { ConfigService } from '../../../core/services/config.service';

// CONFIRMED LIVE (real backend, real account, 2026-11-12): see uploadmaster.
// model.ts's own comment for the real admin/upload-master/* endpoints and
// response shapes this is built against.
describe('UploadMasterService', () => {
  let service: UploadMasterService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(UploadMasterService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  it('get() normalizes the real PascalCase /get response to camelCase', () => {
    let result: unknown[] | undefined;
    service.get({ searchText: null, isActive: null }).subscribe((rows) => (result = rows));

    const req = httpMock.expectOne(apiUrl('admin/upload-master/get'));
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, data: [{ UploadDefinitionId: '1', UploadName: 'Voters', IsActive: true }] });

    expect(result).toEqual([{ uploadDefinitionId: '1', uploadName: 'Voters', isActive: true }]);
  });

  it('get() returns [] when data is not an array', () => {
    let result: unknown[] | undefined;
    service.get({ searchText: null, isActive: null }).subscribe((rows) => (result = rows));

    httpMock.expectOne(apiUrl('admin/upload-master/get')).flush({ success: true, data: null });

    expect(result).toEqual([]);
  });

  it('add() posts to admin/upload-master/add', () => {
    service.add({ uploadName: 'Test', isRetrySafe: true }).subscribe();

    const req = httpMock.expectOne(apiUrl('admin/upload-master/add'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.uploadName).toBe('Test');
    req.flush({ success: true, data: null });
  });

  it('edit() posts to admin/upload-master/edit with the existing uploadDefinitionId', () => {
    service.edit({ uploadDefinitionId: 'id-1', uploadName: 'Updated', isRetrySafe: true }).subscribe();

    const req = httpMock.expectOne(apiUrl('admin/upload-master/edit'));
    expect(req.request.body.uploadDefinitionId).toBe('id-1');
    req.flush({ success: true, data: null });
  });

  it('delete() posts the uploadDefinitionId to admin/upload-master/delete', () => {
    service.delete('id-1').subscribe();

    const req = httpMock.expectOne(apiUrl('admin/upload-master/delete'));
    expect(req.request.body).toEqual({ uploadDefinitionId: 'id-1' });
    req.flush({ success: true, data: null });
  });

  it('history() normalizes the real PascalCase /history/get response to camelCase', () => {
    let result: unknown[] | undefined;
    service.history('id-1').subscribe((rows) => (result = rows));

    const req = httpMock.expectOne(apiUrl('admin/upload-master/history/get'));
    expect(req.request.body).toEqual({ uploadDefinitionId: 'id-1' });
    req.flush({ success: true, data: [{ HistoryId: 1, UploadDefinitionId: 'id-1', ActionType: 'CREATE' }] });

    expect(result).toEqual([{ historyId: 1, uploadDefinitionId: 'id-1', actionType: 'CREATE' }]);
  });

  it('procedures() posts no body and normalizes the real PascalCase response to camelCase', () => {
    let result: unknown[] | undefined;
    service.procedures().subscribe((rows) => (result = rows));

    const req = httpMock.expectOne(apiUrl('admin/upload-master/procedures/get'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ success: true, data: [{ ProcedureSchema: 'dbo', ProcedureName: 'ImportVoters', XmlParameterName: 'VoterXml', ContextParameterName: null }] });

    expect(result).toEqual([{ procedureSchema: 'dbo', procedureName: 'ImportVoters', xmlParameterName: 'VoterXml', contextParameterName: null }]);
  });

  it('procedures() returns [] when data is not an array', () => {
    let result: unknown[] | undefined;
    service.procedures().subscribe((rows) => (result = rows));

    httpMock.expectOne(apiUrl('admin/upload-master/procedures/get')).flush({ success: true, data: null });

    expect(result).toEqual([]);
  });
});
