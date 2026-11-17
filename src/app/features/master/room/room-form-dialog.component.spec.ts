import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { RoomFormDialogComponent, RoomFormDialogData } from './room-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { RoomRow } from './room.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableRoomFormDialog = RoomFormDialogComponent & {
  form: FormGroup;
  siteOptions: () => SelectOption[];
  buildingOptions: () => SelectOption[];
  floorOptions: () => SelectOption[];
  wingOptions: () => SelectOption[];
  flatOptions: () => SelectOption[];
  flatApplicable: () => boolean;
  flatLabel: () => string;
  helperText: () => string;
};

const SITE_ROWS = [{ SiteId: 'site-chn', SiteCode: 'CHN01', SiteName: 'Chennai Corporate Site', IsActive: true }];

const BUILDING_ROWS = [
  { BuildingId: 'bld-com', SiteId: 'site-chn', BuildingCode: 'BLD-A', BuildingName: 'Corporate Tower A', BuildingType: 'COMMERCIAL', IsActive: true },
  { BuildingId: 'bld-res', SiteId: 'site-chn', BuildingCode: 'BLD-R', BuildingName: 'Residential Tower', BuildingType: 'RESIDENTIAL', IsActive: true },
];

const FLOOR_ROWS = [
  { FloorId: 'flr-com', BuildingId: 'bld-com', FloorCode: '02', FloorName: 'Second Floor', IsActive: true },
  { FloorId: 'flr-res', BuildingId: 'bld-res', FloorCode: 'GRD', FloorName: 'Ground Floor', IsActive: true },
];

const WING_ROWS = [
  { WingId: 'wng-com', FloorId: 'flr-com', WingCode: 'W-A', WingName: 'Wing A', IsActive: true },
  { WingId: 'wng-res', FloorId: 'flr-res', WingCode: 'MAN', WingName: 'Main Wing', IsActive: true },
];

const FLAT_ROWS = [{ FlatId: 'flt-1', WingId: 'wng-res', FlatCode: 'UNIT-101', FlatName: 'Office Unit 101', IsActive: true }];

// Covers the Site -> Building -> Floor -> Wing required 4-level chain and
// — the single most important business rule in this brief — that Flat is
// only ever applicable (enabled, options loaded) when the selected
// Building's own real buildingType is RESIDENTIAL, never for COMMERCIAL,
// matching the real CONFIRMED-LIVE backend behavior this session's own
// investigation found (a Commercial Room saves successfully with no Flat
// at all). Also covers Room Code always being disabled/read-only and
// never sent on Add, and that Room Number preserves its own string
// formatting exactly.
describe('RoomFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: RoomFormDialogData) {
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
    const fixture = TestBed.createComponent(RoomFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushLookups(
    sites: Record<string, unknown>[] = SITE_ROWS,
    buildings: Record<string, unknown>[] = BUILDING_ROWS,
    floors: Record<string, unknown>[] = FLOOR_ROWS,
    wings: Record<string, unknown>[] = WING_ROWS,
    flats: Record<string, unknown>[] = FLAT_ROWS,
  ) {
    httpMock.expectOne(apiUrl('master/site/get')).flush({ success: true, data: sites });
    httpMock.expectOne(apiUrl('master/building/get')).flush({ success: true, data: buildings });
    httpMock.expectOne(apiUrl('master/floor/get')).flush({ success: true, data: floors });
    httpMock.expectOne(apiUrl('master/wing/get')).flush({ success: true, data: wings });
    httpMock.expectOne(apiUrl('master/flat/get')).flush({ success: true, data: flats });
  }

  afterEach(() => httpMock.verify());

  it('offers both COMMERCIAL and RESIDENTIAL buildings', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableRoomFormDialog;

    component.form.get('siteId')!.setValue('site-chn');

    expect(component.buildingOptions().map((o) => o.label)).toEqual(['Corporate Tower A (BLD-A) — COMMERCIAL', 'Residential Tower (BLD-R) — RESIDENTIAL']);
  });

  it('disables and relabels Flat "Flat (not applicable)" for a COMMERCIAL building, even once a Wing is chosen', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableRoomFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.get('buildingId')!.setValue('bld-com');
    component.form.get('floorId')!.setValue('flr-com');
    component.form.get('wingId')!.setValue('wng-com');

    expect(component.flatApplicable()).toBe(false);
    expect(component.flatLabel()).toBe('Flat (not applicable)');
    expect(component.form.get('flatId')?.disabled).toBe(true);
    expect(component.flatOptions()).toEqual([]);
  });

  it('enables Flat with a normal label and loads options for a RESIDENTIAL building once a Wing is chosen', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableRoomFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.get('buildingId')!.setValue('bld-res');
    component.form.get('floorId')!.setValue('flr-res');
    component.form.get('wingId')!.setValue('wng-res');

    expect(component.flatApplicable()).toBe(true);
    expect(component.flatLabel()).toBe('Flat');
    expect(component.form.get('flatId')?.disabled).toBe(false);
    expect(component.flatOptions().map((o) => o.label)).toEqual(['Office Unit 101 (UNIT-101)']);
  });

  it('progresses the dynamic helper text down the full chain', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableRoomFormDialog;

    expect(component.helperText()).toBe('Select Site.');
    component.form.get('siteId')!.setValue('site-chn');
    expect(component.helperText()).toBe('Select Building.');
    component.form.get('buildingId')!.setValue('bld-res');
    expect(component.helperText()).toBe('Select Floor.');
    component.form.get('floorId')!.setValue('flr-res');
    expect(component.helperText()).toBe('Select Wing.');
    component.form.get('wingId')!.setValue('wng-res');
    expect(component.helperText()).toBe('Flat is optional. Enter Room Name to continue.');
  });

  it('clears Building, Floor, Wing AND Flat when the Site changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableRoomFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.get('buildingId')!.setValue('bld-res');
    component.form.get('floorId')!.setValue('flr-res');
    component.form.get('wingId')!.setValue('wng-res');
    component.form.get('flatId')!.setValue('flt-1');

    component.form.get('siteId')!.setValue('');
    expect(component.form.get('buildingId')?.value).toBe('');
    expect(component.form.get('floorId')?.value).toBe('');
    expect(component.form.get('wingId')?.value).toBe('');
    expect(component.form.get('flatId')?.value).toBe('');
    expect(component.form.get('flatId')?.disabled).toBe(true);
  });

  it('clears only Flat (not Site/Building/Floor) when the Wing changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableRoomFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.get('buildingId')!.setValue('bld-res');
    component.form.get('floorId')!.setValue('flr-res');
    component.form.get('wingId')!.setValue('wng-res');
    component.form.get('flatId')!.setValue('flt-1');

    component.form.get('wingId')!.setValue('wng-res');
    expect(component.form.get('flatId')?.value).toBe('');
    expect(component.form.get('floorId')?.value).toBe('flr-res');
  });

  it('keeps Room Code disabled in Add mode', () => {
    const addFixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    expect((addFixture.componentInstance as TestableRoomFormDialog).form.get('roomCode')?.disabled).toBe(true);
  });

  it('keeps Room Code disabled in Edit mode and restores its saved value', () => {
    const existingRow: RoomRow = { roomId: 'r1', siteId: 'site-chn', buildingId: 'bld-com', floorId: 'flr-com', wingId: 'wng-com', roomCode: 'R-000002', roomName: 'Meeting Room', isActive: true };
    const editFixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const editComponent = editFixture.componentInstance as TestableRoomFormDialog;
    expect(editComponent.form.get('roomCode')?.disabled).toBe(true);
    expect(editComponent.form.get('roomCode')?.value).toBe('R-000002');
  });

  it('does not submit when Site/Building/Floor/Wing/Room Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableRoomFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/room/add'));
  });

  it('saves a Commercial Room with no Flat and roomCode left null (backend generates it)', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableRoomFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.get('buildingId')!.setValue('bld-com');
    component.form.get('floorId')!.setValue('flr-com');
    component.form.get('wingId')!.setValue('wng-com');
    component.form.patchValue({ roomName: 'Meeting Room' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/room/add'));
    expect(req.request.body.flatId).toBeNull();
    expect(req.request.body.roomCode).toBeNull();
    expect(req.request.body.roomName).toBe('Meeting Room');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('preserves Room Number exactly as typed (never coerced to a number)', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableRoomFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.get('buildingId')!.setValue('bld-res');
    component.form.get('floorId')!.setValue('flr-res');
    component.form.get('wingId')!.setValue('wng-res');
    component.form.patchValue({ roomName: 'Unit Room', roomNumber: '101-A' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/room/add'));
    expect(req.request.body.roomNumber).toBe('101-A');
    req.flush({ success: true, data: null });
  });

  it('submits to master/room/edit with the existing roomId, echoing back the unchanged roomCode', () => {
    const existingRow: RoomRow = { roomId: 'r1', siteId: 'site-chn', buildingId: 'bld-res', floorId: 'flr-res', wingId: 'wng-res', flatId: 'flt-1', roomCode: 'R-000002', roomName: 'Meeting Room', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableRoomFormDialog;

    expect(component.form.get('siteId')?.value).toBe('site-chn');
    expect(component.form.get('buildingId')?.value).toBe('bld-res');
    expect(component.form.get('flatId')?.value).toBe('flt-1');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/room/edit'));
    expect(req.request.body.roomId).toBe('r1');
    expect(req.request.body.roomCode).toBe('R-000002');
    expect(req.request.body.flatId).toBe('flt-1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });
});
