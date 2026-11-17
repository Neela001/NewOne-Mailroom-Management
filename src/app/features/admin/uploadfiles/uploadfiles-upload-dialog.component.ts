import { HttpEventType } from '@angular/common/http';
import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../../master/shared/confirm-dialog.component';
import { UploadFilesService } from './uploadfiles.service';
import { UploadContextOption, UploadFileDefinitionRow } from './uploadfiles.model';
import { extractApiErrorMessage } from '../../../core/utils/api-error.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

export type UploadFilesUploadDialogResult = boolean;

const MAX_EXCEL_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXCEL_EXT = ['.xlsx'];

// New Excel Upload popup — see uploadfiles.model.ts's own comment for the
// real admin/uploads/* endpoints this is built against. Submission posts
// the real file via admin/uploads/submit and reports real upload-progress
// events (ApiService.postMultipartWithProgress) rather than a fake
// simulated progress bar.
@Component({
  selector: 'app-uploadfiles-upload-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, ComboboxComponent, SelectComponent, IconComponent],
  templateUrl: './uploadfiles-upload-dialog.component.html',
  styleUrl: './uploadfiles-upload-dialog.component.scss',
})
export class UploadFilesUploadDialogComponent implements OnInit {
  private readonly uploadFilesService = inject(UploadFilesService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<UploadFilesUploadDialogResult>);

  protected readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly definitions = signal<UploadFileDefinitionRow[]>([]);
  protected readonly definitionsLoading = signal(true);
  protected readonly definitionsError = signal(false);
  protected readonly definitionOptions = computed<SelectOption[]>(() => this.definitions().map((d) => ({ label: d.uploadName ?? '(Unnamed)', value: d.uploadDefinitionId })));

  protected readonly form = new FormGroup({
    definitionId: new FormControl('', [Validators.required]),
    contextId: new FormControl(''),
  });

  // A plain signal set explicitly from valueChanges/loadDefinitions, NOT a
  // computed() reading form.get('definitionId')!.value directly — Angular's
  // computed() only re-runs when a SIGNAL it read changes, and a
  // FormControl's own .value is a plain mutable property, not a signal, so
  // a computed() reading it would cache its very first result (computed at
  // whatever the control's value happened to be at that first read) and
  // never recompute again on later user selections. Same class of bug
  // already documented and fixed in useraudit-list.component.ts's own
  // scopeLabel comment.
  protected readonly selectedDefinition = signal<UploadFileDefinitionRow | null>(null);

  // Only non-empty for the day a real Upload Master definition declares a
  // non-null contextParameterName — CONFIRMED LIVE neither of the 2 real
  // active definitions currently does, so this stays hidden in practice,
  // never hardcoded off.
  protected readonly contexts = signal<UploadContextOption[]>([]);
  protected readonly contextsLoading = signal(false);
  protected readonly contextOptions = computed<SelectOption[]>(() => this.contexts().map((c) => ({ label: c.label ?? c.contextId, value: c.contextId })));

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);

  protected readonly templateLoading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitProgress = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.form.get('definitionId')!.valueChanges.subscribe((id) => {
      this.applySelectedDefinition(id);
    });
  }

  private applySelectedDefinition(id: string | null): void {
    const def = this.definitions().find((d) => d.uploadDefinitionId === id) ?? null;
    this.selectedDefinition.set(def);
    this.contexts.set([]);
    this.form.get('contextId')!.setValue('', { emitEvent: false });
    if (def?.contextParameterName) {
      this.contextsLoading.set(true);
      this.uploadFilesService.contexts(def.uploadDefinitionId).subscribe({
        next: (rows) => {
          this.contextsLoading.set(false);
          this.contexts.set(rows);
        },
        error: () => this.contextsLoading.set(false),
      });
    }
  }

  ngOnInit(): void {
    this.loadDefinitions();
  }

  protected loadDefinitions(): void {
    this.definitionsLoading.set(true);
    this.definitionsError.set(false);
    const previousId = this.form.get('definitionId')!.value;
    this.uploadFilesService.definitions().subscribe({
      next: (rows) => {
        this.definitions.set(rows);
        this.definitionsLoading.set(false);
        // Preserve the selected upload only if it remains valid.
        const stillValid = previousId && rows.some((r) => r.uploadDefinitionId === previousId);
        if (!stillValid) {
          this.form.get('definitionId')!.setValue(''); // triggers applySelectedDefinition via valueChanges
        } else {
          this.applySelectedDefinition(previousId);
        }
      },
      error: () => {
        this.definitionsLoading.set(false);
        this.definitionsError.set(true);
      },
    });
  }

  protected getTemplate(): void {
    const def = this.selectedDefinition();
    if (!def || this.templateLoading()) return;
    this.templateLoading.set(true);
    this.uploadFilesService.downloadTemplate(def.uploadDefinitionId).subscribe({
      next: (blob) => {
        this.templateLoading.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // CONFIRMED LIVE: this exactly matches the server's own real
        // Content-Disposition filename for the one definition tested —
        // see uploadfiles.model.ts's own comment for why the real header
        // can't be read directly from the browser.
        a.download = `${def.uploadName ?? 'Upload'}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.templateLoading.set(false);
        this.errorMessage.set('Could not download the template for this upload.');
      },
    });
  }

  browseFile(): void {
    this.fileInput()?.nativeElement.click();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_EXCEL_EXT.includes(ext)) {
      this.fileError.set(`"${file.name}" isn't a supported file — only .xlsx is accepted.`);
      return;
    }
    if (file.size > MAX_EXCEL_BYTES) {
      this.fileError.set(`"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB) — the limit is 10 MB.`);
      return;
    }

    this.fileError.set(null);
    this.selectedFile.set(file);
  }

  clearFile(): void {
    this.selectedFile.set(null);
    this.fileError.set(null);
  }

  onReload(): void {
    this.loadDefinitions();
  }

  onCancelClick(): void {
    if (this.selectedFile() && !this.submitting()) {
      this.dialogService
        .open(ConfirmDialogComponent, {
          width: '420px',
          data: {
            title: 'Discard this upload?',
            message: 'You selected an Excel file that has not been submitted yet.',
          },
        })
        .afterClosed()
        .subscribe((confirmed) => {
          if (confirmed) this.dialogRef.close(false);
        });
      return;
    }
    this.dialogRef.close(false);
  }

  onSubmit(): void {
    if (this.submitting()) return; // prevent duplicate submissions

    this.form.markAllAsTouched();
    const def = this.selectedDefinition();
    if (!def) {
      this.errorMessage.set('Select an upload name first.');
      return;
    }
    const file = this.selectedFile();
    if (!file) {
      this.fileError.set('Select an Excel file to upload.');
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);
    this.submitProgress.set(0);

    const contextId = this.form.get('contextId')!.value || null;
    this.uploadFilesService.submit({ definitionId: def.uploadDefinitionId, contextId, requestId: crypto.randomUUID(), file }).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.submitProgress.set(Math.round((event.loaded / event.total) * 100));
        } else if (event.type === HttpEventType.Response) {
          this.submitting.set(false);
          this.submitProgress.set(null);
          if (event.body?.success) {
            this.dialogRef.close(true);
          } else {
            this.errorMessage.set(event.body?.message || 'Failed to submit this upload.');
          }
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.submitProgress.set(null);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while submitting this upload.');
      },
    });
  }
}
