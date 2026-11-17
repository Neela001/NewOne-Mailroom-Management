import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DeskService } from './desk.service';
import { ConfigService } from '../../../core/services/config.service';

// CONFIRMED LIVE (real backend, real account, 2026-11-11): the real desk
// endpoints live under `master/desk/*`, not `admin/desk/*` (admin/desk/save
// and admin/desk/get don't exist at all in the live spec) — see
// desk.model.ts's own comment. /get's own real response is a flat PascalCase
// array (like every other master entity's untyped /get), not { desks, locations }.
describe('DeskService', () => {
  let service: DeskService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DeskService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  it('get() normalizes the real PascalCase /get response to camelCase', () => {
    let result: unknown[] | undefined;
    service.get({ searchText: null, isActive: null }).subscribe((rows) => (result = rows));

    const req = httpMock.expectOne(apiUrl('master/desk/get'));
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, data: [{ DeskId: '1', DeskCode: 'D1', DeskType: 'MAIN', IsActive: true }] });

    expect(result).toEqual([{ deskId: '1', deskCode: 'D1', deskType: 'MAIN', isActive: true }]);
  });

  it('get() returns [] when data is missing/not an array', () => {
    let result: unknown[] | undefined;
    service.get({ searchText: null, isActive: null }).subscribe((rows) => (result = rows));

    httpMock.expectOne(apiUrl('master/desk/get')).flush({ success: true, data: null });

    expect(result).toEqual([]);
  });

  it('save() posts to master/desk/save-with-locations with the locations array', () => {
    service
      .save({ deskType: 'MAIN', deskCode: 'D1', deskName: 'Desk 1', cityId: 'c1', siteId: 's1', locations: [{ buildingId: 'b1', floorId: 'f1', wingId: 'w1' }] })
      .subscribe();

    const req = httpMock.expectOne(apiUrl('master/desk/save-with-locations'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.locations).toEqual([{ buildingId: 'b1', floorId: 'f1', wingId: 'w1' }]);
    req.flush({ success: true, data: null });
  });

  it('delete() posts the deskId to master/desk/delete', () => {
    service.delete({ deskId: 'd1' }).subscribe();

    const req = httpMock.expectOne(apiUrl('master/desk/delete'));
    expect(req.request.body).toEqual({ deskId: 'd1' });
    req.flush({ success: true, data: null });
  });

  it('locationOptions() normalizes the real PascalCase response and passes siteId/deskId through', () => {
    let result: unknown[] | undefined;
    service.locationOptions({ siteId: 's1', deskId: 'd1' }).subscribe((rows) => (result = rows));

    const req = httpMock.expectOne(apiUrl('master/desk/location-options/get'));
    expect(req.request.body).toEqual({ siteId: 's1', deskId: 'd1' });
    req.flush({
      success: true,
      data: [{ SiteId: 's1', BuildingId: 'b1', BuildingName: 'Tower A', FloorId: 'f1', FloorName: 'Floor 1', WingId: 'w1', WingName: 'Wing A', DeskLocationId: null, IsChecked: false, IsAvailable: true }],
    });

    expect(result).toEqual([
      { siteId: 's1', buildingId: 'b1', buildingName: 'Tower A', floorId: 'f1', floorName: 'Floor 1', wingId: 'w1', wingName: 'Wing A', deskLocationId: null, isChecked: false, isAvailable: true },
    ]);
  });

  it('history() normalizes the real PascalCase response to camelCase', () => {
    let result: unknown[] | undefined;
    service.history('d1').subscribe((rows) => (result = rows));

    const req = httpMock.expectOne(apiUrl('master/desk/history/get'));
    expect(req.request.body).toEqual({ deskId: 'd1' });
    req.flush({ success: true, data: [{ DeskHistoryId: 1, DeskId: 'd1', ActionType: 'CREATE', ActionBy: 'u1' }] });

    expect(result).toEqual([{ deskHistoryId: 1, deskId: 'd1', actionType: 'CREATE', actionBy: 'u1' }]);
  });
});
