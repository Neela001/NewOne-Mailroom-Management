import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MasterFormDialogComponent, MasterFormDialogData } from './master-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { MasterEntityConfig } from './master-entity-config.model';
import { FormGroup } from '@angular/forms';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

// Protected members are intentionally not part of MasterFormDialogComponent's
// public API — this test-only view exposes just the ones these specs assert
// on, the same accepted pattern Angular component tests use rather than
// loosening the component's own encapsulation for production code.
type TestableFormDialog = MasterFormDialogComponent & {
  form: FormGroup;
  dynamicOptions: () => Record<string, { label: string; value: unknown }[]>;
};

// Covers (a) required-field validation and (b) cascading dropdowns driven
// by optionsSource.filterParams — the real part of task 2's cascading-
// dropdown work (see master-entity-config.model.ts's own comment for why
// only entities with a documented parent-id filter get this, e.g.
// VerticalMenu.mainMenuId filtered by softwareId).
describe('MasterFormDialogComponent', () => {
  const CASCADING_CONFIG: MasterEntityConfig = {
    entityLabel: 'City',
    entityLabelPlural: 'Cities',
    apiBasePath: 'master/city',
    idField: 'cityId',
    columns: [{ key: 'cityName', label: 'Name' }],
    formFields: [
      { key: 'countryId', label: 'Country', type: 'select', required: true, optionsSource: { apiBasePath: 'master/country', valueField: 'countryId', labelField: 'countryName' } },
      {
        key: 'stateId',
        label: 'State',
        type: 'select',
        optionsSource: { apiBasePath: 'master/state', valueField: 'stateId', labelField: 'stateName', filterParams: { countryId: 'countryId' } },
      },
      { key: 'cityName', label: 'City Name', type: 'text', required: true },
    ],
    historyColumns: [{ key: 'cityName', label: 'Name' }],
    buildDeleteRequest: (row) => ({ cityId: row['cityId'] }),
    buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
    buildHistoryRequest: (row) => ({ cityId: row['cityId'] }),
  };

  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function createComponent(data: MasterFormDialogData) {
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
    const fixture = TestBed.createComponent(MasterFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  afterEach(() => httpMock.verify());

  it('does not call add() and marks controls touched when a required field is empty', () => {
    const fixture = createComponent({ config: CASCADING_CONFIG, row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableFormDialog;

    // Country (no filterParams) loads immediately on init.
    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: [] });
    // State has filterParams and countryId is still '', so no request yet.
    httpMock.expectNone(apiUrl('master/state/get'));

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    expect(component.form.get('cityName')?.touched).toBe(true);
  });

  it('does not load the dependent dropdown until its driving field has a value', () => {
    createComponent({ config: CASCADING_CONFIG, row: null, mode: 'add' });
    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: [{ countryId: 'c1', countryName: 'India' }] });
    httpMock.expectNone(apiUrl('master/state/get'));
  });

  it('reloads the dependent dropdown, filtered by the driver, once the driver gets a value', () => {
    const fixture = createComponent({ config: CASCADING_CONFIG, row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableFormDialog;
    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: [{ countryId: 'c1', countryName: 'India' }] });

    component.form.get('countryId')?.setValue('c1');
    fixture.detectChanges();

    const req = httpMock.expectOne(apiUrl('master/state/get'));
    expect(req.request.body.countryId).toBe('c1');
    req.flush({ success: true, data: [{ stateId: 's1', stateName: 'Maharashtra' }] });

    expect(component.dynamicOptions()['stateId']).toEqual([{ label: 'Maharashtra', value: 's1' }]);
  });

  it('clears a now-invalid dependent value when the driver changes to a parent that no longer includes it', () => {
    const fixture = createComponent({ config: CASCADING_CONFIG, row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableFormDialog;
    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: [{ countryId: 'c1', countryName: 'India' }] });

    component.form.get('countryId')?.setValue('c1');
    fixture.detectChanges();
    httpMock.expectOne(apiUrl('master/state/get')).flush({ success: true, data: [{ stateId: 's1', stateName: 'Maharashtra' }] });
    component.form.get('stateId')?.setValue('s1');

    component.form.get('countryId')?.setValue('c2');
    fixture.detectChanges();
    httpMock.expectOne(apiUrl('master/state/get')).flush({ success: true, data: [{ stateId: 's2', stateName: 'Gujarat' }] });

    expect(component.form.get('stateId')?.value).toBe('');
  });
});
