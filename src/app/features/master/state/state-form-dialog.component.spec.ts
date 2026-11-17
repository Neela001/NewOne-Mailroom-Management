import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { StateFormDialogComponent, StateFormDialogData } from './state-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { StateRow } from './state.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableStateFormDialog = StateFormDialogComponent & { form: FormGroup; countryOptions: () => SelectOption[] };

const COUNTRY_ROWS = [
  { CountryId: 'c-india', CountryCode: 'IN', CountryName: 'India', HasState: true, IsActive: true },
  { CountryId: 'c-no-state', CountryCode: 'ZZ', CountryName: 'No State Country', HasState: false, IsActive: true },
  { CountryId: 'c-inactive', CountryCode: 'XX', CountryName: 'Inactive Country', HasState: true, IsActive: false },
];

// Covers required-field validation (Country/State Name), the real
// master/state/add vs /edit split, and the Country dropdown's own
// filtering rule (this task's own Section 3: only active, State-enabled
// countries are selectable for a NEW record — a country with HasState:false
// or IsActive:false must not appear), plus the "preserve the existing
// relationship" rule for Edit (this task's own Section 5) via a saved
// country that's no longer itself eligible.
describe('StateFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: StateFormDialogData) {
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
    const fixture = TestBed.createComponent(StateFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushCountries(rows: Record<string, unknown>[] = COUNTRY_ROWS) {
    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: rows });
  }

  afterEach(() => httpMock.verify());

  it('only offers active, State-enabled countries for a new record', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushCountries();
    const component = fixture.componentInstance as TestableStateFormDialog;

    const labels = component.countryOptions().map((o) => o.label);
    expect(labels).toEqual(['India (IN)']);
  });

  it('does not submit when Country/State Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushCountries();
    const component = fixture.componentInstance as TestableStateFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/state/add'));
    expect(component.form.get('countryId')?.touched).toBe(true);
    expect(component.form.get('stateName')?.touched).toBe(true);
  });

  it('submits to master/state/add with no stateId when adding', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushCountries();
    const component = fixture.componentInstance as TestableStateFormDialog;

    component.form.patchValue({ countryId: 'c-india', stateCode: 'TN', stateName: 'Tamil Nadu' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/state/add'));
    expect(req.request.body.stateId).toBeNull();
    expect(req.request.body.countryId).toBe('c-india');
    expect(req.request.body.stateCode).toBe('TN');
    expect(req.request.body.stateName).toBe('Tamil Nadu');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits to master/state/edit with the existing stateId when editing', () => {
    const existingRow: StateRow = { stateId: 's1', countryId: 'c-india', stateCode: 'TN', stateName: 'Tamil Nadu', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushCountries();
    const component = fixture.componentInstance as TestableStateFormDialog;

    expect(component.form.get('countryId')?.value).toBe('c-india');
    expect(component.form.get('stateCode')?.value).toBe('TN');
    expect(component.form.get('stateName')?.value).toBe('Tamil Nadu');

    component.form.patchValue({ stateName: 'Tamil Nadu Updated' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/state/edit'));
    expect(req.request.body.stateId).toBe('s1');
    expect(req.request.body.stateName).toBe('Tamil Nadu Updated');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('preserves the saved country as a selectable option when editing, even if it is no longer State-enabled', () => {
    const existingRow: StateRow = { stateId: 's2', countryId: 'c-no-state', stateCode: '', stateName: 'Some State', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushCountries();
    const component = fixture.componentInstance as TestableStateFormDialog;

    const labels = component.countryOptions().map((o) => o.label);
    expect(labels).toContain('No State Country (ZZ)');
    expect(component.form.get('countryId')?.value).toBe('c-no-state');
  });
});
