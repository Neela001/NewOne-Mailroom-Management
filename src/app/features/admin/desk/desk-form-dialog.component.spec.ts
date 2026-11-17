import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { DeskFormDialogComponent, DeskFormDialogData } from './desk-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { DeskRow } from './desk.model';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableDeskFormDialog = DeskFormDialogComponent & {
  form: FormGroup;
  parentDeskOptions: () => { label: string; value: string }[];
  selectedLocationCount: () => number;
  errorMessage: () => string | null;
  toggleLocation: (opt: { siteId: string; buildingId: string; buildingName?: string | null; floorId: string; floorName?: string | null; wingId: string; wingName?: string | null; deskLocationId: string | null; isChecked: boolean; isAvailable: boolean }) => void;
};

// Covers required-field validation, the mandatory-location-selection rule
// (server-enforced: DeskSaveWithLocationsRequest.locations has minItems 1
// — confirmed live, not assumed), the real master/desk/* endpoints (see
// desk.model.ts's own comment for why this isn't admin/desk/*), and that
// Building/Floor/Wing locations only load once a Site is selected.
describe('DeskFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: DeskFormDialogData) {
    dialogRefCloseSpy = vi.fn();
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppIcons(),
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: { close: dialogRefCloseSpy } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(DeskFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  // city/site/parent-desk/email-setting load on every open, regardless of
  // Add vs Edit — a location-options request additionally fires here only
  // when editing a row that already has a siteId (its own Edit-mode restore).
  function flushOptionRequests(editingSiteId?: string) {
    httpMock.expectOne(apiUrl('master/city/get')).flush({ success: true, data: [] });
    httpMock.expectOne(apiUrl('master/site/get')).flush({ success: true, data: [] });
    httpMock.expectOne(apiUrl('master/desk/get')).flush({ success: true, data: [] });
    httpMock.expectOne(apiUrl('master/email-setting/get')).flush({ success: true, data: [] });
    if (editingSiteId) {
      httpMock.expectOne(apiUrl('master/desk/location-options/get')).flush({ success: true, data: [] });
    }
  }

  afterEach(() => httpMock.verify());

  it('does not submit when a required field is empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptionRequests();
    const component = fixture.componentInstance as TestableDeskFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/desk/save-with-locations'));
    expect(component.form.get('deskCode')?.touched).toBe(true);
  });

  it('blocks submission with an inline error when no location is selected', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptionRequests();
    const component = fixture.componentInstance as TestableDeskFormDialog;

    component.form.patchValue({ deskCode: 'D1', deskName: 'Reception', cityId: 'c1' });
    component.form.get('siteId')!.setValue('s1'); // triggers the location-options load
    httpMock.expectOne(apiUrl('master/desk/location-options/get')).flush({ success: true, data: [] });

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/desk/save-with-locations'));
    expect(component.selectedLocationCount()).toBe(0);
    expect(component.errorMessage()).toContain('at least one');
  });

  it('does not load desk locations until a Site is selected', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptionRequests();
    httpMock.expectNone(apiUrl('master/desk/location-options/get'));

    const component = fixture.componentInstance as TestableDeskFormDialog;
    expect(component.selectedLocationCount()).toBe(0);
  });

  it('submits to master/desk/save-with-locations with the selected locations on Add', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptionRequests();
    const component = fixture.componentInstance as TestableDeskFormDialog;

    component.form.patchValue({ deskCode: 'D1', deskName: 'Reception', cityId: 'c1' });
    component.form.get('siteId')!.setValue('s1');
    httpMock.expectOne(apiUrl('master/desk/location-options/get')).flush({
      success: true,
      data: [{ SiteId: 's1', BuildingId: 'b1', BuildingName: 'Tower A', FloorId: 'f1', FloorName: 'Floor 1', WingId: 'w1', WingName: 'Wing A', DeskLocationId: null, IsChecked: false, IsAvailable: true }],
    });
    component.toggleLocation({ siteId: 's1', buildingId: 'b1', buildingName: 'Tower A', floorId: 'f1', floorName: 'Floor 1', wingId: 'w1', wingName: 'Wing A', deskLocationId: null, isChecked: false, isAvailable: true });

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/desk/save-with-locations'));
    expect(req.request.body.deskId).toBeNull();
    expect(req.request.body.locations).toEqual([{ buildingId: 'b1', floorId: 'f1', wingId: 'w1' }]);
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('restores the existing locations and sends the existing deskId when editing', () => {
    const existingRow: DeskRow = {
      deskId: 'd1', deskType: 'MAIN', deskCode: 'D1', deskName: 'Reception', cityId: 'c1', siteId: 's1', isActive: true,
    };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    httpMock.expectOne(apiUrl('master/city/get')).flush({ success: true, data: [] });
    httpMock.expectOne(apiUrl('master/site/get')).flush({ success: true, data: [] });
    httpMock.expectOne(apiUrl('master/desk/get')).flush({ success: true, data: [] });
    httpMock.expectOne(apiUrl('master/email-setting/get')).flush({ success: true, data: [] });
    const locReq = httpMock.expectOne(apiUrl('master/desk/location-options/get'));
    expect(locReq.request.body).toEqual({ siteId: 's1', deskId: 'd1' });
    locReq.flush({
      success: true,
      data: [{ SiteId: 's1', BuildingId: 'b1', BuildingName: 'Tower A', FloorId: 'f1', FloorName: 'Floor 1', WingId: 'w1', WingName: 'Wing A', DeskLocationId: 'dl1', IsChecked: true, IsAvailable: true }],
    });

    const component = fixture.componentInstance as TestableDeskFormDialog;
    expect(component.selectedLocationCount()).toBe(1);

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/desk/save-with-locations'));
    expect(req.request.body.deskId).toBe('d1');
    expect(req.request.body.locations).toEqual([{ buildingId: 'b1', floorId: 'f1', wingId: 'w1' }]);
    req.flush({ success: true, data: null });
  });

  it('excludes the desk being edited from its own MAIN parent-desk options', () => {
    const existingRow: DeskRow = {
      deskId: 'd1', deskType: 'SUB', deskCode: 'D1', deskName: 'Reception', cityId: 'c1', siteId: 's1', isActive: true,
    };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    httpMock.expectOne(apiUrl('master/city/get')).flush({ success: true, data: [] });
    httpMock.expectOne(apiUrl('master/site/get')).flush({ success: true, data: [] });
    const parentReq = httpMock.expectOne(apiUrl('master/desk/get'));
    expect(parentReq.request.body).toEqual({ deskType: 'MAIN', isActive: true });
    parentReq.flush({
      success: true,
      data: [
        { DeskId: 'd1', DeskCode: 'D1', DeskName: 'Reception' },
        { DeskId: 'd2', DeskCode: 'D2', DeskName: 'Lobby' },
      ],
    });
    httpMock.expectOne(apiUrl('master/email-setting/get')).flush({ success: true, data: [] });
    httpMock.expectOne(apiUrl('master/desk/location-options/get')).flush({ success: true, data: [] });

    const component = fixture.componentInstance as TestableDeskFormDialog;
    expect(component.parentDeskOptions()).toEqual([{ label: 'D2 - Lobby', value: 'd2' }]);
  });
});
