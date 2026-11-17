import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { BuildingFormDialogComponent, BuildingFormDialogData } from './building-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { BuildingRow } from './building.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableBuildingFormDialog = BuildingFormDialogComponent & {
  form: FormGroup;
  siteOptions: () => SelectOption[];
  buildingTypeOptions: SelectOption[];
};

const SITE_ROWS = [
  { SiteId: 'site-chn', SiteCode: 'CHN01', SiteName: 'Chennai Corporate Site', IsActive: true },
  { SiteId: 'site-inactive', SiteCode: 'OLD01', SiteName: 'Deactivated Site', IsActive: false },
];

// Covers the Site-dropdown logic (active-only, combined "Name (Code)"
// label, preserving a saved-but-now-inactive Site during Edit), the
// Building Type free-text field (CONFIRMED LIVE — no backend enum/lookup
// exists, so it is never rendered as a fixed-option dropdown here), the
// trim-on-submit rule, required-field validation, and the Edit-mode
// "Update Building" submit behavior this task calls out as critical.
describe('BuildingFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: BuildingFormDialogData) {
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
    const fixture = TestBed.createComponent(BuildingFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushLookups(sites: Record<string, unknown>[] = SITE_ROWS) {
    httpMock.expectOne(apiUrl('master/site/get')).flush({ success: true, data: sites });
  }

  afterEach(() => httpMock.verify());

  it('offers exactly the two Building Type values CONFIRMED LIVE by the real backend validation error (COMMERCIAL, RESIDENTIAL)', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableBuildingFormDialog;

    expect(component.buildingTypeOptions.map((o) => o.value)).toEqual(['COMMERCIAL', 'RESIDENTIAL']);
  });

  it('only offers active sites', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableBuildingFormDialog;

    expect(component.siteOptions().map((o) => o.label)).toEqual(['Chennai Corporate Site (CHN01)']);
  });

  it('preserves a saved Site that is no longer active when editing', () => {
    const existingRow: BuildingRow = { buildingId: 'b1', siteId: 'site-inactive', buildingCode: 'BLD-A', buildingName: 'Old Tower', buildingType: 'COMMERCIAL', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableBuildingFormDialog;

    expect(component.siteOptions().map((o) => o.label)).toContain('Deactivated Site (OLD01)');
    expect(component.form.get('siteId')?.value).toBe('site-inactive');
  });

  it('does not submit when Site/Building Code/Building Name/Building Type are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableBuildingFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/building/add'));
  });

  it('trims leading/trailing spaces from Building Code, Building Name and Building Type on submit', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableBuildingFormDialog;

    component.form.patchValue({ siteId: 'site-chn', buildingCode: '  BLD-A  ', buildingName: '  Corporate Tower A  ', buildingType: '  COMMERCIAL  ' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/building/add'));
    expect(req.request.body.buildingCode).toBe('BLD-A');
    expect(req.request.body.buildingName).toBe('Corporate Tower A');
    expect(req.request.body.buildingType).toBe('COMMERCIAL');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits to master/building/add with buildingId null', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableBuildingFormDialog;

    component.form.patchValue({ siteId: 'site-chn', buildingCode: 'BLD-A', buildingName: 'Corporate Tower A', buildingType: 'COMMERCIAL' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/building/add'));
    expect(req.request.body.buildingId).toBeNull();
    expect(req.request.body.siteId).toBe('site-chn');
    req.flush({ success: true, data: null });
  });

  it('submits to master/building/edit with the existing buildingId and restores the saved relationship', () => {
    const existingRow: BuildingRow = { buildingId: 'b1', siteId: 'site-chn', buildingCode: 'BLD-A', buildingName: 'Corporate Tower A', buildingType: 'COMMERCIAL', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableBuildingFormDialog;

    expect(component.form.get('siteId')?.value).toBe('site-chn');
    expect(component.form.get('buildingCode')?.value).toBe('BLD-A');
    expect(component.form.get('buildingName')?.value).toBe('Corporate Tower A');
    expect(component.form.get('buildingType')?.value).toBe('COMMERCIAL');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/building/edit'));
    expect(req.request.body.buildingId).toBe('b1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('Remarks always starts blank, even when editing an existing row', () => {
    const existingRow: BuildingRow = { buildingId: 'b1', siteId: 'site-chn', buildingCode: 'BLD-A', buildingName: 'Corporate Tower A', buildingType: 'COMMERCIAL', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableBuildingFormDialog;

    expect(component.form.get('remarks')?.value).toBe('');
  });
});
