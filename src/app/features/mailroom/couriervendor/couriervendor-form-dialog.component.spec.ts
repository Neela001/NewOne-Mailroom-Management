import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { CourierVendorFormDialogComponent, CourierVendorFormDialogData } from './couriervendor-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { CourierVendorDeskAssignmentRow, CourierVendorDeskOptionRow, CourierVendorRow } from './couriervendor.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableCourierVendorFormDialog = CourierVendorFormDialogComponent & {
  form: FormGroup;
  modeOptions: () => SelectOption[];
  availableDeskRows: () => CourierVendorDeskOptionRow[];
  assignedDesks: () => CourierVendorDeskAssignmentRow[];
  contacts: () => { courierVendorContactId: string | null; deskId: string; deskCode?: string | null; deskName?: string | null; contactPerson?: string | null; contactNo?: string | null; emailId?: string | null }[];
  contactDeskOptions: () => SelectOption[];
  newContactDeskId: { (): string; set: (v: string) => void };
  newContactPerson: { (): string; set: (v: string) => void };
  newContactNo: { (): string; set: (v: string) => void };
  newContactEmail: { (): string; set: (v: string) => void };
  selectedAvailableDeskId: { (): string | null; set: (v: string | null) => void };
  selectedAssignedDeskId: { (): string | null; set: (v: string | null) => void };
  selectedContactIndex: { (): number | null; set: (v: number | null) => void };
  addDesk: (row?: CourierVendorDeskOptionRow) => void;
  selectAvailableDesk: (row: CourierVendorDeskOptionRow) => void;
  selectAssignedDesk: (row: CourierVendorDeskAssignmentRow) => void;
  removeDesk: () => void;
  addContact: () => void;
  selectContact: (i: number) => void;
  removeContact: () => void;
  errorMessage: () => string | null;
  onSubmit: () => void;
};

const OPTIONS_RESPONSE = {
  modes: [
    { CourierModeId: 'mode-1', ModeCode: 'CR', ModeName: 'Courier', IsActive: true },
    { CourierModeId: 'mode-2', ModeCode: 'IB', ModeName: 'Inter Branch', IsActive: false },
  ],
  desks: [
    { DeskId: 'desk-1', DeskCode: '0212', DeskName: 'Tirunelveli', SiteName: 'Sivanthi Nagar', CityName: 'Tirunelveli', IsActive: true },
    { DeskId: 'desk-2', DeskCode: '2121', DeskName: 'Sivanthi Nagar', SiteName: 'Sivanthi Nagar', CityName: 'Tirunelveli', IsActive: true },
    { DeskId: 'desk-3', DeskCode: 'TESTD1', DeskName: 'Test Desk One', SiteName: 'Sivanthi Nagar', CityName: 'Tirunelveli', IsActive: false },
  ],
};

describe('CourierVendorFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: CourierVendorFormDialogData) {
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
    const fixture = TestBed.createComponent(CourierVendorFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushOptions(options: Record<string, unknown> = OPTIONS_RESPONSE) {
    httpMock.expectOne(apiUrl('master/couriervendor/options/get')).flush({ success: true, data: options });
  }

  afterEach(() => httpMock.verify());

  it('only offers active Courier Modes and active Desks', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierVendorFormDialog;

    expect(component.modeOptions().map((o) => o.value)).toEqual(['mode-1']);
    expect(component.availableDeskRows().map((d) => d.deskId)).toEqual(['desk-1', 'desk-2']);
  });

  it('does not submit when Courier Mode/Vendor Type/Vendor Code/Vendor Name/Service Type are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierVendorFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/couriervendor/save-with-contacts'));
  });

  it('adds a selected Available Desk to Assigned Desks without duplicating it', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierVendorFormDialog;

    const [deskRow] = component.availableDeskRows();
    component.selectAvailableDesk(deskRow);
    component.addDesk();
    expect(component.assignedDesks().length).toBe(1);
    expect(component.availableDeskRows().map((d) => d.deskId)).not.toContain('desk-1');

    component.addDesk(deskRow);
    expect(component.assignedDesks().length).toBe(1);
  });

  it('removes a selected Assigned Desk', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierVendorFormDialog;

    component.addDesk(component.availableDeskRows()[0]);
    component.selectAssignedDesk(component.assignedDesks()[0]);
    component.removeDesk();
    expect(component.assignedDesks().length).toBe(0);
  });

  it('only offers the vendor\'s own assigned Desks as Contact Desk options, and requires a Desk to add a Contact', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierVendorFormDialog;

    expect(component.contactDeskOptions()).toEqual([]);
    component.addDesk(component.availableDeskRows()[0]);
    expect(component.contactDeskOptions().map((o) => o.value)).toEqual(['desk-1']);

    component.newContactPerson.set('Sivaperumal');
    component.addContact();
    expect(component.contacts().length).toBe(0); // no Desk selected yet

    component.newContactDeskId.set('desk-1');
    component.addContact();
    expect(component.contacts().length).toBe(1);
    expect(component.contacts()[0].deskId).toBe('desk-1');
  });

  it('removing a Desk also removes any Contact assigned to it', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierVendorFormDialog;

    component.addDesk(component.availableDeskRows()[0]); // desk-1
    component.newContactDeskId.set('desk-1');
    component.newContactPerson.set('Sivaperumal');
    component.addContact();
    expect(component.contacts().length).toBe(1);

    component.selectAssignedDesk(component.assignedDesks()[0]);
    component.removeDesk();
    expect(component.contacts().length).toBe(0);
  });

  it('removes a selected Contact', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierVendorFormDialog;

    component.addDesk(component.availableDeskRows()[0]);
    component.newContactDeskId.set('desk-1');
    component.newContactPerson.set('Sivaperumal');
    component.addContact();
    component.selectContact(0);
    component.removeContact();
    expect(component.contacts().length).toBe(0);
  });

  it('submits the full deskIds/contacts/deletedContactIds payload shape to save-with-contacts', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierVendorFormDialog;

    component.form.patchValue({ courierModeId: 'mode-1', vendorType: 'BOTH', vendorCode: 'ZV-01', vendorName: 'ZZ Test Vendor', serviceType: 'DOMESTIC' });
    component.addDesk(component.availableDeskRows()[0]);
    component.newContactDeskId.set('desk-1');
    component.newContactPerson.set('Sivaperumal');
    component.newContactNo.set('9000000000');
    component.addContact();

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/couriervendor/save-with-contacts'));
    expect(req.request.body.vendor.courierVendorId).toBeNull();
    expect(req.request.body.vendor.courierModeId).toBe('mode-1');
    expect(req.request.body.vendor.vendorCode).toBe('ZV-01');
    expect(req.request.body.deskIds).toEqual(['desk-1']);
    expect(req.request.body.contacts).toEqual([{ courierVendorContactId: null, deskId: 'desk-1', contactPerson: 'Sivaperumal', contactNo: '9000000000', emailId: null }]);
    expect(req.request.body.deletedContactIds).toEqual([]);
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('restores the saved vendor, its assigned Desks and Contacts on Edit', () => {
    const existingRow: CourierVendorRow = { courierVendorId: 'cv1', courierModeId: 'mode-1', vendorCode: 'BD', vendorName: 'BlueDart', vendorType: 'BOTH', serviceType: 'DOMESTIC', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushOptions();
    httpMock.expectOne(apiUrl('master/couriervendor/desk/get')).flush({ success: true, data: [{ CourierVendorDeskId: 'cvd-1', CourierVendorId: 'cv1', DeskId: 'desk-1', DeskCode: '0212', DeskName: 'Tirunelveli', SiteName: 'Sivanthi Nagar', CityName: 'Tirunelveli', IsActive: true }] });
    httpMock
      .expectOne(apiUrl('master/couriervendor/contact/get'))
      .flush({ success: true, data: [{ CourierVendorContactId: 'cvc-1', CourierVendorId: 'cv1', DeskId: 'desk-1', DeskCode: '0212', DeskName: 'Tirunelveli', ContactPerson: 'Sivaperumal', ContactNo: '9943186999', EmailId: 'sivaperumal.k@hotmail.com', IsActive: true }] });
    const component = fixture.componentInstance as TestableCourierVendorFormDialog;

    expect(component.form.get('vendorCode')?.value).toBe('BD');
    expect(component.assignedDesks().map((d) => d.deskId)).toEqual(['desk-1']);
    expect(component.contacts().map((c) => c.contactPerson)).toEqual(['Sivaperumal']);

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/couriervendor/save-with-contacts'));
    expect(req.request.body.vendor.courierVendorId).toBe('cv1');
    expect(req.request.body.deskIds).toEqual(['desk-1']);
    expect(req.request.body.contacts[0].courierVendorContactId).toBe('cvc-1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('tracks a removed existing Contact in deletedContactIds, not as a full-replace', () => {
    const existingRow: CourierVendorRow = { courierVendorId: 'cv1', courierModeId: 'mode-1', vendorCode: 'BD', vendorName: 'BlueDart', vendorType: 'BOTH', serviceType: 'DOMESTIC', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushOptions();
    httpMock.expectOne(apiUrl('master/couriervendor/desk/get')).flush({ success: true, data: [{ CourierVendorDeskId: 'cvd-1', CourierVendorId: 'cv1', DeskId: 'desk-1', DeskCode: '0212', DeskName: 'Tirunelveli', IsActive: true }] });
    httpMock
      .expectOne(apiUrl('master/couriervendor/contact/get'))
      .flush({ success: true, data: [{ CourierVendorContactId: 'cvc-1', CourierVendorId: 'cv1', DeskId: 'desk-1', ContactPerson: 'Sivaperumal', IsActive: true }] });
    const component = fixture.componentInstance as TestableCourierVendorFormDialog;

    component.selectContact(0);
    component.removeContact();
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/couriervendor/save-with-contacts'));
    expect(req.request.body.contacts).toEqual([]);
    expect(req.request.body.deletedContactIds).toEqual(['cvc-1']);
    req.flush({ success: true, data: null });
  });

  it('surfaces the real backend rejection message', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierVendorFormDialog;

    component.form.patchValue({ courierModeId: 'mode-1', vendorType: 'BOTH', vendorCode: 'ZV-01', vendorName: 'ZZ Test Vendor', serviceType: 'DOMESTIC' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/couriervendor/save-with-contacts'));
    req.flush({ success: false, message: 'Duplicate vendor code already exists.', data: null });

    expect(component.errorMessage()).toBe('Duplicate vendor code already exists.');
    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
  });

  it('Remarks always starts blank, even when editing an existing row', () => {
    const existingRow: CourierVendorRow = { courierVendorId: 'cv1', courierModeId: 'mode-1', vendorCode: 'BD', vendorName: 'BlueDart', vendorType: 'BOTH', serviceType: 'DOMESTIC', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushOptions();
    httpMock.expectOne(apiUrl('master/couriervendor/desk/get')).flush({ success: true, data: [] });
    httpMock.expectOne(apiUrl('master/couriervendor/contact/get')).flush({ success: true, data: [] });
    const component = fixture.componentInstance as TestableCourierVendorFormDialog;

    expect(component.form.get('remarks')?.value).toBe('');
  });
});
