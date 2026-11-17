import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { VoterFormDialogComponent, VoterFormDialogData } from './voter-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { VoterRow } from './voter.model';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableVoterFormDialog = VoterFormDialogComponent & { form: FormGroup };

// Covers required-field validation (Ward/Booth/Serial number/Voter ID/Name
// — the Windows reference's own exact required set, stricter client-side
// than the real VoterRecordRequest schema, which marks everything
// nullable — see voter-form-dialog.component.ts's own comment) and the
// real master/voter-record/add vs /edit split.
describe('VoterFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: VoterFormDialogData) {
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
    const fixture = TestBed.createComponent(VoterFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('does not submit when required fields are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableVoterFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/voter-record/add'));
    expect(component.form.get('voterId')?.touched).toBe(true);
    expect(component.form.get('name')?.touched).toBe(true);
  });

  it('submits to master/voter-record/add with no voterRecordId when adding', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableVoterFormDialog;

    component.form.patchValue({ wardNo: '1', boothNo: '2', serialNumber: 5, voterId: 'V1', name: 'குருமாரி' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/voter-record/add'));
    expect(req.request.body.voterRecordId).toBeNull();
    expect(req.request.body.name).toBe('குருமாரி');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits to master/voter-record/edit with the existing voterRecordId when editing', () => {
    const existingRow: VoterRow = { voterRecordId: 'v1', wardNo: '1', boothNo: '2', serialNumber: 5, voterId: 'V1', name: 'Test', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    const component = fixture.componentInstance as TestableVoterFormDialog;

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/voter-record/edit'));
    expect(req.request.body.voterRecordId).toBe('v1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });
});
