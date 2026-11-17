import { TestBed } from '@angular/core/testing';
import { HttpEventType } from '@angular/common/http';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { UploadFilesUploadDialogComponent } from './uploadfiles-upload-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { UploadFileDefinitionRow } from './uploadfiles.model';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableUploadDialog = UploadFilesUploadDialogComponent & {
  form: FormGroup;
  selectedFile: { (): File | null; set: (f: File | null) => void };
  fileError: () => string | null;
  selectedDefinition: () => UploadFileDefinitionRow | null;
  submitProgress: () => number | null;
  onFileChange(event: Event): void;
};

const DEFINITIONS: UploadFileDefinitionRow[] = [
  { uploadDefinitionId: 'd1', uploadName: 'Country Vertical Data', contextParameterName: null, isActive: true },
  { uploadDefinitionId: 'd2', uploadName: 'Courier Zone Destinations', contextParameterName: null, isActive: true },
];

function fileChangeEvent(file: File): Event {
  const input = document.createElement('input');
  input.type = 'file';
  Object.defineProperty(input, 'files', { value: [file] });
  return { target: input } as unknown as Event;
}

// Covers the real reactivity bug caught and fixed this session (selecting
// a definition must actually update selectedDefinition() — a computed()
// reading FormControl.value directly would have cached its first read
// forever, same class of bug as useraudit-list.component.ts's own
// scopeLabel fix), file validation (.xlsx-only / 10MB limit), duplicate-
// submission prevention, and the real admin/uploads/submit multipart +
// progress-event flow.
describe('UploadFilesUploadDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent() {
    dialogRefCloseSpy = vi.fn();
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideAppIcons(), { provide: DialogRef, useValue: { close: dialogRefCloseSpy } }],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(UploadFilesUploadDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushDefinitions(defs: UploadFileDefinitionRow[] = DEFINITIONS) {
    httpMock.expectOne(apiUrl('admin/uploads/definitions/get')).flush({
      success: true,
      data: defs.map((d) => ({ UploadDefinitionId: d.uploadDefinitionId, UploadName: d.uploadName, ContextParameterName: d.contextParameterName, IsActive: d.isActive })),
    });
  }

  afterEach(() => httpMock.verify());

  it('selecting a definition actually updates selectedDefinition() (not a stale cached computed())', () => {
    const fixture = createComponent();
    flushDefinitions();
    const component = fixture.componentInstance as TestableUploadDialog;

    expect(component.selectedDefinition()).toBeNull();

    component.form.get('definitionId')!.setValue('d2');

    expect(component.selectedDefinition()?.uploadDefinitionId).toBe('d2');
    expect(component.selectedDefinition()?.uploadName).toBe('Courier Zone Destinations');
  });

  it('does not submit when no definition and no file are selected', () => {
    const fixture = createComponent();
    flushDefinitions();
    const component = fixture.componentInstance as TestableUploadDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('admin/uploads/submit'));
  });

  it('rejects a non-.xlsx file with a clear validation message', () => {
    const fixture = createComponent();
    flushDefinitions();
    const component = fixture.componentInstance as TestableUploadDialog;

    const file = new File(['data'], 'records.csv', { type: 'text/csv' });
    component.onFileChange(fileChangeEvent(file));

    expect(component.selectedFile()).toBeNull();
    expect(component.fileError()).toContain('.xlsx');
  });

  it('rejects a file over the 10 MB limit', () => {
    const fixture = createComponent();
    flushDefinitions();
    const component = fixture.componentInstance as TestableUploadDialog;

    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.xlsx');
    component.onFileChange(fileChangeEvent(big));

    expect(component.selectedFile()).toBeNull();
    expect(component.fileError()).toContain('10 MB');
  });

  it('accepts a valid .xlsx file under the size limit', () => {
    const fixture = createComponent();
    flushDefinitions();
    const component = fixture.componentInstance as TestableUploadDialog;

    const file = new File(['data'], 'voters.xlsx');
    component.onFileChange(fileChangeEvent(file));

    expect(component.selectedFile()?.name).toBe('voters.xlsx');
    expect(component.fileError()).toBeNull();
  });

  it('submits the real file to admin/uploads/submit, reports progress, and closes on success', () => {
    const fixture = createComponent();
    flushDefinitions();
    const component = fixture.componentInstance as TestableUploadDialog;

    component.form.get('definitionId')!.setValue('d1');
    const file = new File(['data'], 'voters.xlsx');
    component.onFileChange(fileChangeEvent(file));
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('admin/uploads/submit'));
    const body = req.request.body as FormData;
    expect(body.get('DefinitionId')).toBe('d1');
    expect((body.get('File') as File).name).toBe('voters.xlsx');

    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 } as never);
    expect(component.submitProgress()).toBe(50);

    req.flush({ success: true, data: null });
    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('prevents a duplicate submission while one is already in flight', () => {
    const fixture = createComponent();
    flushDefinitions();
    const component = fixture.componentInstance as TestableUploadDialog;

    component.form.get('definitionId')!.setValue('d1');
    component.onFileChange(fileChangeEvent(new File(['data'], 'voters.xlsx')));
    component.onSubmit();
    const req = httpMock.expectOne(apiUrl('admin/uploads/submit')); // still pending, not flushed yet

    component.onSubmit(); // second click while the first is still in flight
    httpMock.expectNone(apiUrl('admin/uploads/submit'));

    req.flush({ success: true, data: null });
  });
});
