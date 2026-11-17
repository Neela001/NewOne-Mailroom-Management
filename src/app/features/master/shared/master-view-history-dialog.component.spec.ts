import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MasterViewHistoryDialogComponent, MasterViewHistoryDialogData } from './master-view-history-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { MasterEntityConfig } from './master-entity-config.model';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

// Protected members are intentionally not part of the component's public
// API — see master-form-dialog.component.spec.ts's own TestableFormDialog
// comment for why this test-only view is the accepted pattern here rather
// than loosening the component's own encapsulation.
type TestableDialog = MasterViewHistoryDialogComponent & {
  viewItems: () => { label: string; value: string; isEmpty: boolean }[];
  viewLoading: () => boolean;
  historyRows: () => Record<string, unknown>[];
  historyLoading: () => boolean;
  tab: () => 'view' | 'history';
};

// Covers both tabs of the merged View+History dialog (replacing the
// previous separate MasterViewDialogComponent/MasterHistoryDialogComponent
// — see this file's own class comment): View Data's own real work a plain
// disabled form doesn't do (resolving a foreign-key id to its real label,
// formatting booleans as Yes/No, "Not set" for empty), and History Data's
// real audit trail fetch.
describe('MasterViewHistoryDialogComponent', () => {
  const CONFIG: MasterEntityConfig = {
    entityLabel: 'City',
    entityLabelPlural: 'Cities',
    apiBasePath: 'master/city',
    idField: 'cityId',
    columns: [{ key: 'cityName', label: 'Name' }],
    formFields: [
      { key: 'countryId', label: 'Country', type: 'select', required: true, optionsSource: { apiBasePath: 'master/country', valueField: 'countryId', labelField: 'countryName' } },
      { key: 'cityName', label: 'City Name', type: 'text', required: true },
      { key: 'remarks', label: 'Remarks', type: 'text' },
      { key: 'isActive', label: 'Active', type: 'boolean' },
    ],
    historyColumns: [{ key: 'cityName', label: 'Name' }],
    buildDeleteRequest: (row) => ({ cityId: row['cityId'] }),
    buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
    buildHistoryRequest: (row) => ({ cityId: row['cityId'] }),
  };

  let httpMock: HttpTestingController;

  function createComponent(data: MasterViewHistoryDialogData) {
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideAppIcons(), { provide: DIALOG_DATA, useValue: data }, { provide: DialogRef, useValue: { close: () => {} } }],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MasterViewHistoryDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  // Both tabs load concurrently on open (so switching tabs never shows a
  // stale/empty state) — every test flushes both real requests.
  function flushHistory(): void {
    httpMock.expectOne(apiUrl('master/city/history/get')).flush({ success: true, data: [] });
  }

  afterEach(() => httpMock.verify());

  it('resolves a foreign-key id to its real label instead of showing the raw id', () => {
    const fixture = createComponent({
      config: CONFIG,
      row: { cityId: '1', countryId: 'c1', cityName: 'Chennai', remarks: null, isActive: true },
    });
    const component = fixture.componentInstance as TestableDialog;

    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: [{ countryId: 'c1', countryName: 'India' }] });
    flushHistory();

    expect(component.viewLoading()).toBe(false);
    const countryItem = component.viewItems().find((i) => i.label === 'Country');
    expect(countryItem?.value).toBe('India');
    expect(countryItem?.isEmpty).toBe(false);
  });

  it('formats a boolean field as Yes/No', () => {
    const fixture = createComponent({
      config: CONFIG,
      row: { cityId: '1', countryId: 'c1', cityName: 'Chennai', remarks: null, isActive: true },
    });
    const component = fixture.componentInstance as TestableDialog;
    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: [{ countryId: 'c1', countryName: 'India' }] });
    flushHistory();

    const activeItem = component.viewItems().find((i) => i.label === 'Active');
    expect(activeItem?.value).toBe('Yes');
    expect(activeItem?.isEmpty).toBe(false);
  });

  it('shows "Not set" for an empty value rather than a blank', () => {
    const fixture = createComponent({
      config: CONFIG,
      row: { cityId: '1', countryId: 'c1', cityName: 'Chennai', remarks: null, isActive: false },
    });
    const component = fixture.componentInstance as TestableDialog;
    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: [{ countryId: 'c1', countryName: 'India' }] });
    flushHistory();

    const remarksItem = component.viewItems().find((i) => i.label === 'Remarks');
    expect(remarksItem?.value).toBe('Not set');
    expect(remarksItem?.isEmpty).toBe(true);
  });

  it('loads the real history audit trail and switches to the History Data tab', () => {
    const fixture = createComponent({
      config: CONFIG,
      row: { cityId: '1', countryId: 'c1', cityName: 'Chennai', remarks: null, isActive: true },
    });
    const component = fixture.componentInstance as TestableDialog;

    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: [{ countryId: 'c1', countryName: 'India' }] });
    httpMock
      .expectOne(apiUrl('master/city/history/get'))
      .flush({ success: true, data: [{ cityId: '1', cityName: 'Chennai', actionType: 'CREATE', actionBy: 'admin', actionDate: '2026-10-19' }] });

    expect(component.tab()).toBe('view');
    component.setTab('history');
    expect(component.tab()).toBe('history');
    expect(component.historyLoading()).toBe(false);
    expect(component.historyRows().length).toBe(1);
  });
});
