import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MasterApiService } from './master-api.service';
import { ConfigService } from '../../../core/services/config.service';

// Covers the one piece of custom, non-generated logic in this service: the
// defensive normalization in get() for the spec's own confirmed limitation
// that every master entity's /get response documents `data` as untyped
// (ObjectApiResponse) rather than a real List<T> — see
// api-response.model.ts's own comment and master-api.service.ts's own
// get() comment.
describe('MasterApiService', () => {
  let service: MasterApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MasterApiService);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(ConfigService);
  });

  afterEach(() => httpMock.verify());

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  it('passes an array response straight through', () => {
    let result: unknown[] | undefined;
    service.get('master/country', { searchText: null }).subscribe((rows) => (result = rows));

    const req = httpMock.expectOne(apiUrl('master/country/get'));
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, data: [{ countryId: '1' }, { countryId: '2' }] });

    expect(result).toEqual([{ countryId: '1' }, { countryId: '2' }]);
  });

  it('wraps a single object response in a 1-row array', () => {
    let result: unknown[] | undefined;
    service.get('master/country', { searchText: null }).subscribe((rows) => (result = rows));

    const req = httpMock.expectOne(apiUrl('master/country/get'));
    req.flush({ success: true, data: { countryId: '1' } });

    expect(result).toEqual([{ countryId: '1' }]);
  });

  it('normalizes a real PascalCase backend row to the app\'s own camelCase keys (live-confirmed finding, see pascal-case.util.ts)', () => {
    let result: Record<string, unknown>[] | undefined;
    service.get('master/country', { searchText: null }).subscribe((rows) => (result = rows as Record<string, unknown>[]));

    const req = httpMock.expectOne(apiUrl('master/country/get'));
    req.flush({ success: true, data: [{ CountryId: '1', CountryCode: 'IN', ISDCode: '+91', IsActive: true }] });

    expect(result).toEqual([{ countryId: '1', countryCode: 'IN', isdCode: '+91', isActive: true }]);
  });

  it('normalizes a null/non-object response to an empty array rather than throwing', () => {
    let result: unknown[] | undefined;
    service.get('master/country', { searchText: null }).subscribe((rows) => (result = rows));

    const req = httpMock.expectOne(apiUrl('master/country/get'));
    req.flush({ success: true, data: null });

    expect(result).toEqual([]);
  });

  it('add() posts to {apiBasePath}/add', () => {
    service.add('master/country', { countryCode: 'IN' }).subscribe();
    const req = httpMock.expectOne(apiUrl('master/country/add'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ countryCode: 'IN' });
    req.flush({ success: true, data: null });
  });

  it('edit() posts to {apiBasePath}/edit', () => {
    service.edit('master/country', { countryId: '1' }).subscribe();
    httpMock.expectOne(apiUrl('master/country/edit')).flush({ success: true, data: null });
  });

  it('delete() posts to {apiBasePath}/delete', () => {
    service.delete('master/country', { countryId: '1' }).subscribe();
    httpMock.expectOne(apiUrl('master/country/delete')).flush({ success: true, data: null });
  });

  it('history() posts to {apiBasePath}/history/get and defaults a missing data to []', () => {
    let result: unknown[] | undefined;
    service.history('master/country', { countryId: '1' }).subscribe((rows) => (result = rows));

    const req = httpMock.expectOne(apiUrl('master/country/history/get'));
    req.flush({ success: true, data: null });

    expect(result).toEqual([]);
  });
});
