import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { UploadMasterFormDialogComponent, UploadMasterFormDialogData } from './uploadmaster-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { UploadDefinitionRow, UploadProcedureOption } from './uploadmaster.model';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableUploadMasterFormDialog = UploadMasterFormDialogComponent & {
  form: FormGroup;
  selectedProcedure: () => UploadProcedureOption | null;
};

const PROCEDURE_WITH_CONTEXT: UploadProcedureOption = { procedureSchema: 'dbo', procedureName: 'ImportVoters', xmlParameterName: 'VoterXml', contextParameterName: 'BatchId' };
const PROCEDURE_WITHOUT_CONTEXT: UploadProcedureOption = { procedureSchema: 'dbo', procedureName: 'ImportSites', xmlParameterName: 'SiteXml', contextParameterName: null };

// Covers required-field validation (Upload name/Procedure/at least one XML
// layout column/XML root+row names), the real admin/upload-master/add vs
// /edit split, and the "Procedure Dependency Logic" this task's own spec
// calls for: selecting a procedure from the real, backend-pre-filtered
// admin/upload-master/procedures/get list auto-populates AND LOCKS XML
// parameter/Context parameter/Context type — see uploadmaster-form-dialog.
// component.ts's own class-level comment for why these are never
// independently user-editable.
describe('UploadMasterFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: UploadMasterFormDialogData) {
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
    const fixture = TestBed.createComponent(UploadMasterFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushProcedures(procedures: UploadProcedureOption[] = [PROCEDURE_WITH_CONTEXT, PROCEDURE_WITHOUT_CONTEXT]) {
    httpMock.expectOne(apiUrl('admin/upload-master/procedures/get')).flush({
      success: true,
      data: procedures.map((p) => ({ ProcedureSchema: p.procedureSchema, ProcedureName: p.procedureName, XmlParameterName: p.xmlParameterName, ContextParameterName: p.contextParameterName })),
    });
  }

  afterEach(() => httpMock.verify());

  it('does not submit when required fields are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushProcedures();
    const component = fixture.componentInstance as TestableUploadMasterFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('admin/upload-master/add'));
    expect(component.form.get('uploadName')?.touched).toBe(true);
    expect(component.form.get('procedureKey')?.touched).toBe(true);
  });

  it('auto-populates and locks XML parameter/Context parameter/Context type when a procedure with a context is selected', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushProcedures();
    const component = fixture.componentInstance as TestableUploadMasterFormDialog;

    component.form.get('procedureKey')!.setValue('dbo|ImportVoters');

    expect(component.selectedProcedure()).toEqual(PROCEDURE_WITH_CONTEXT);
    expect(component.form.get('xmlParameterName')?.value).toBe('VoterXml');
    expect(component.form.get('contextParameterName')?.value).toBe('BatchId');
    expect(component.form.get('contextType')?.value).toBe('Guid');
    expect(component.form.get('xmlParameterName')?.disabled).toBe(true);
    expect(component.form.get('contextParameterName')?.disabled).toBe(true);
    expect(component.form.get('contextType')?.disabled).toBe(true);
  });

  it('leaves Context parameter/Context type blank for a procedure with no context parameter', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushProcedures();
    const component = fixture.componentInstance as TestableUploadMasterFormDialog;

    component.form.get('procedureKey')!.setValue('dbo|ImportSites');

    expect(component.form.get('xmlParameterName')?.value).toBe('SiteXml');
    expect(component.form.get('contextParameterName')?.value).toBe('');
    expect(component.form.get('contextType')?.value).toBe('');
  });

  it('does not submit when the XML layout has no columns', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushProcedures();
    const component = fixture.componentInstance as TestableUploadMasterFormDialog;

    component.form.patchValue({ uploadName: 'Voters Import', procedureKey: 'dbo|ImportVoters', xmlRootName: 'Root', xmlRowName: 'Row' });
    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('admin/upload-master/add'));
    expect(component.form.get('columnsCsv')?.touched).toBe(true);
  });

  it('submits to admin/upload-master/add with no uploadDefinitionId, the locked procedure fields, and the columns CSV when adding', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushProcedures();
    const component = fixture.componentInstance as TestableUploadMasterFormDialog;

    component.form.patchValue({ uploadName: 'Voters Import', procedureKey: 'dbo|ImportVoters', xmlRootName: 'Root', xmlRowName: 'Row', columnsCsv: 'VoterId,Name' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('admin/upload-master/add'));
    expect(req.request.body.uploadDefinitionId).toBeNull();
    expect(req.request.body.uploadName).toBe('Voters Import');
    expect(req.request.body.procedureSchema).toBe('dbo');
    expect(req.request.body.procedureName).toBe('ImportVoters');
    expect(req.request.body.xmlParameterName).toBe('VoterXml');
    expect(req.request.body.contextParameterName).toBe('BatchId');
    expect(req.request.body.columnsCsv).toBe('VoterId,Name');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits to admin/upload-master/edit with the existing uploadDefinitionId when editing', () => {
    const existingRow: UploadDefinitionRow = {
      uploadDefinitionId: 'u1',
      uploadName: 'Voters Import',
      procedureSchema: 'dbo',
      procedureName: 'ImportVoters',
      xmlParameterName: 'VoterXml',
      contextParameterName: 'BatchId',
      contextType: 'Guid',
      xmlRootName: 'Root',
      xmlRowName: 'Row',
      columnsCsv: 'VoterId,Name',
      isRetrySafe: true,
      isActive: true,
    };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushProcedures();
    const component = fixture.componentInstance as TestableUploadMasterFormDialog;

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('admin/upload-master/edit'));
    expect(req.request.body.uploadDefinitionId).toBe('u1');
    expect(req.request.body.columnsCsv).toBe('VoterId,Name');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });
});
