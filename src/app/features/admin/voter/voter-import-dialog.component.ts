import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../../master/shared/confirm-dialog.component';
import { VoterService } from './voter.service';
import { VoterBatchRow } from './voter.model';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';
import { CheckboxComponent } from '../../../shared/ui/form/checkbox.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

type RowStatus = 'unprocessed' | 'valid' | 'invalid' | 'saved';
type ResultFilter = 'all' | 'valid' | 'invalid' | 'saved' | 'unprocessed';

interface ImportRow {
  clientRowId: string;
  checked: boolean;
  wardNo: string;
  boothNo: string;
  serialNumber: string;
  voterId: string;
  name: string;
  relationType: string;
  relativeName: string;
  houseNumber: string;
  age: string;
  gender: string;
  status: RowStatus;
  errors: string[];
  saveMessage: string | null;
}

const RESULT_FILTER_OPTIONS: SelectOption[] = [
  { label: 'All results', value: 'all' },
  { label: 'Valid results', value: 'valid' },
  { label: 'Invalid results', value: 'invalid' },
  { label: 'Saved results', value: 'saved' },
  { label: 'Unprocessed results', value: 'unprocessed' },
];

// Maps the many real header spellings a hand-entered Excel sheet might use
// onto this app's own canonical VoterBatchRow field names — not a guess at
// a documented contract (none exists; the backend's own import-batch
// endpoint takes already-structured JSON rows, see voter.model.ts's own
// comment), just tolerant parsing of whatever columns a real voter-roll
// spreadsheet is likely to use.
const HEADER_ALIASES: Record<string, keyof Omit<ImportRow, 'clientRowId' | 'checked' | 'status' | 'errors' | 'saveMessage'>> = {
  ward: 'wardNo',
  wardno: 'wardNo',
  'wardno.': 'wardNo',
  booth: 'boothNo',
  boothno: 'boothNo',
  'boothno.': 'boothNo',
  sno: 'serialNumber',
  's.no': 'serialNumber',
  's.no.': 'serialNumber',
  serialno: 'serialNumber',
  serialnumber: 'serialNumber',
  voterid: 'voterId',
  'voter id': 'voterId',
  name: 'name',
  relation: 'relationType',
  relationtype: 'relationType',
  relativename: 'relativeName',
  'relative name': 'relativeName',
  houseno: 'houseNumber',
  'house no': 'houseNumber',
  'house no.': 'houseNumber',
  housenumber: 'houseNumber',
  age: 'age',
  gender: 'gender',
  sex: 'gender',
};

const MAX_EXCEL_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_EXCEL_EXT = ['.xlsx', '.xls', '.csv'];
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// The Import Voters workflow — see voter.model.ts's own comment for the
// full live-confirmed evidence this is built against. The one real import
// mechanism (master/voter-record/import-batch) is a plain JSON array of
// already-structured rows — there is NO OCR/image/PDF extraction endpoint
// anywhere in the API (confirmed live: the generic admin/uploads/* pipeline
// has exactly 2 configured UploadDefinitions, both an Excel-row -> XML ->
// stored-procedure pipeline for Country/Courier master data, with no Voter
// definition and no OCR/image/mime-type concept at all). This component
// therefore implements:
//   - Import Excel: REAL — parses a .xlsx/.xls/.csv file client-side (the
//     xlsx/SheetJS library) into editable rows, which the user corrects
//     and saves via the real import-batch endpoint.
//   - Browse image / PDF: REAL but LIMITED to what's actually achievable
//     without a backend — local file selection + an in-browser preview
//     (object URL), nothing more.
//   - Extract data / OCR settings / Show text: deliberately NOT
//     implemented beyond a clear, static explanation of the missing
//     capability — there is no OCR endpoint to call, so these controls
//     stay visible (matching the Windows reference's own layout) but
//     disabled, per this task's own explicit "do not invent OCR... report
//     missing API functionality clearly" instruction.
@Component({
  selector: 'app-voter-import-dialog',
  standalone: true,
  imports: [FormsModule, ButtonComponent, InputComponent, SelectComponent, CheckboxComponent, IconComponent],
  templateUrl: './voter-import-dialog.component.html',
  styleUrl: './voter-import-dialog.component.scss',
})
export class VoterImportDialogComponent {
  private readonly voterService = inject(VoterService);
  private readonly dialog = inject(DialogService);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly dialogRef = inject(DialogRef<boolean>);

  protected readonly excelFileInput = viewChild<ElementRef<HTMLInputElement>>('excelFileInput');
  protected readonly imageFileInput = viewChild<ElementRef<HTMLInputElement>>('imageFileInput');

  protected readonly topWardNo = signal('');
  protected readonly topBoothNo = signal('');

  protected readonly rows = signal<ImportRow[]>([]);
  protected readonly resultFilter = signal<ResultFilter>('all');
  protected readonly filteredRows = computed(() => {
    const filter = this.resultFilter();
    const all = this.rows();
    if (filter === 'all') return all;
    return all.filter((r) => r.status === filter);
  });

  protected readonly selectedImageName = signal<string | null>(null);
  protected readonly selectedImageUrl = signal<string | null>(null);
  protected readonly selectedImageIsPdf = signal(false);
  // <iframe src> is a RESOURCE_URL security context (unlike <img src>,
  // which Angular's sanitizer lets a blob: URL through for) — bypassing
  // trust is safe ONLY because this URL is one this same code just
  // created from a file the user picked via the native file input, never
  // arbitrary/external input.
  protected readonly selectedPdfUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.selectedImageUrl();
    return url && this.selectedImageIsPdf() ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  protected readonly parseError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveProgressMessage = signal<string | null>(null);
  protected readonly lastSaveSummary = signal<string | null>(null);

  private saveSubscription: Subscription | null = null;
  private hasUnsavedWork = false;

  protected readonly checkedCount = computed(() => this.rows().filter((r) => r.checked).length);
  protected readonly validCheckedCount = computed(() => this.rows().filter((r) => r.checked && r.status === 'valid').length);

  onExcelFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file name later
    if (!file) return;

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_EXCEL_EXT.includes(ext)) {
      this.parseError.set(`"${file.name}" isn't a supported Excel/CSV file — use .xlsx, .xls or .csv.`);
      return;
    }
    if (file.size > MAX_EXCEL_BYTES) {
      this.parseError.set(`"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB) — the limit is 10 MB.`);
      return;
    }

    this.parseError.set(null);
    // .csv is plain text with no internal encoding declaration of its own
    // (unlike .xlsx/.xls, whose real binary/XML structure already
    // declares UTF-8 and SheetJS decodes correctly from a raw
    // ArrayBuffer) — reading a .csv as raw bytes via SheetJS's own
    // type:'array' path falls back to a non-UTF-8 codepage unless the
    // file happens to start with a BOM, corrupting any Tamil text into
    // mojibake (confirmed live). file.text() always decodes as UTF-8 per
    // the File API spec regardless of BOM, so .csv is read as a string
    // and handed to SheetJS as type:'string' instead — this is what
    // actually preserves Tamil names correctly.
    const readFile = ext === '.csv' ? file.text() : file.arrayBuffer();
    readFile
      .then(async (data) => {
        const XLSX = await import('xlsx');
        const workbook = typeof data === 'string' ? XLSX.read(data, { type: 'string' }) : XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          this.parseError.set('This file has no sheets to import.');
          return;
        }
        const sheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        this.importParsedRows(rawRows);
      })
      .catch(() => {
        this.parseError.set(`Couldn't read "${file.name}" — the file may be corrupted or in an unsupported format.`);
      });
  }

  private importParsedRows(rawRows: Record<string, unknown>[]): void {
    if (rawRows.length === 0) {
      this.parseError.set('No rows were found in this file.');
      return;
    }

    const newRows: ImportRow[] = rawRows.map((raw) => {
      const mapped: Partial<Record<keyof ImportRow, string>> = {};
      for (const [header, value] of Object.entries(raw)) {
        const key = HEADER_ALIASES[header.trim().toLowerCase()];
        if (key) mapped[key] = String(value ?? '').trim();
      }
      return this.buildRow(mapped);
    });

    this.rows.update((existing) => [...existing, ...this.revalidateAll(newRows)]);
    this.hasUnsavedWork = true;
    this.lastSaveSummary.set(null);
  }

  private buildRow(partial: Partial<Record<keyof ImportRow, string>>): ImportRow {
    return {
      clientRowId: crypto.randomUUID(),
      checked: true,
      wardNo: partial.wardNo ?? '',
      boothNo: partial.boothNo ?? '',
      serialNumber: partial.serialNumber ?? '',
      voterId: partial.voterId ?? '',
      name: partial.name ?? '',
      relationType: partial.relationType ?? '',
      relativeName: partial.relativeName ?? '',
      houseNumber: partial.houseNumber ?? '',
      age: partial.age ?? '',
      gender: partial.gender ?? '',
      status: 'unprocessed',
      errors: [],
      saveMessage: null,
    };
  }

  onImageFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      this.parseError.set(`"${file.name}" isn't a supported image/PDF type — use JPEG, PNG, WEBP or PDF.`);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.parseError.set(`"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB) — the limit is 15 MB.`);
      return;
    }

    this.parseError.set(null);
    const prior = this.selectedImageUrl();
    if (prior) URL.revokeObjectURL(prior);
    this.selectedImageName.set(file.name);
    this.selectedImageUrl.set(URL.createObjectURL(file));
    this.selectedImageIsPdf.set(file.type === 'application/pdf');
  }

  triggerExcelPicker(): void {
    this.excelFileInput()?.nativeElement.click();
  }

  triggerImagePicker(): void {
    this.imageFileInput()?.nativeElement.click();
  }

  // Only backfills a BLANK cell on each row — never overwrites a value the
  // row already has (from the spreadsheet or a manual edit), per this
  // task's own "Do not overwrite existing values incorrectly".
  applyWardBooth(): void {
    const ward = this.topWardNo().trim();
    const booth = this.topBoothNo().trim();
    if (!ward && !booth) {
      this.parseError.set('Enter a Ward and/or Booth number before applying.');
      return;
    }
    this.parseError.set(null);
    this.rows.update((rows) =>
      this.revalidateAll(
        rows.map((r) => ({
          ...r,
          wardNo: r.wardNo || ward,
          boothNo: r.boothNo || booth,
        })),
      ),
    );
  }

  updateCell(clientRowId: string, field: keyof ImportRow, value: string): void {
    this.rows.update((rows) => this.revalidateAll(rows.map((r) => (r.clientRowId === clientRowId ? { ...r, [field]: value } : r))));
    this.hasUnsavedWork = true;
  }

  toggleRowChecked(clientRowId: string): void {
    this.rows.update((rows) => rows.map((r) => (r.clientRowId === clientRowId ? { ...r, checked: !r.checked } : r)));
  }

  removeRow(clientRowId: string): void {
    this.rows.update((rows) => rows.filter((r) => r.clientRowId !== clientRowId));
  }

  refreshView(): void {
    // Re-validates every row from its own current (possibly hand-edited)
    // values without discarding any edit — "refresh" here means
    // re-checking validity/duplicates, not re-reading the source file.
    this.rows.update((rows) => this.revalidateAll(rows));
  }

  private revalidateAll(rows: ImportRow[]): ImportRow[] {
    const voterIdCounts = new Map<string, number>();
    for (const r of rows) {
      const id = r.voterId.trim().toLowerCase();
      if (id) voterIdCounts.set(id, (voterIdCounts.get(id) ?? 0) + 1);
    }

    return rows.map((r) => {
      if (r.status === 'saved') return r; // already saved — leave as-is

      const errors: string[] = [];
      if (!r.voterId.trim()) errors.push('Voter ID is required.');
      if (!r.serialNumber.trim()) errors.push('Serial number is required.');
      else if (!/^\d+$/.test(r.serialNumber.trim()) || Number(r.serialNumber) < 1) errors.push('Serial number must be a positive whole number.');
      if (!r.name.trim()) errors.push('Name is required.');
      if (!r.wardNo.trim()) errors.push('Ward no. is required.');
      if (!r.boothNo.trim()) errors.push('Booth no. is required.');
      if (r.age.trim() && (!/^\d+$/.test(r.age.trim()) || Number(r.age) > 150)) errors.push('Age must be a number from 0 to 150.');
      const idKey = r.voterId.trim().toLowerCase();
      if (idKey && (voterIdCounts.get(idKey) ?? 0) > 1) errors.push('Duplicate Voter ID within this import batch.');

      return { ...r, errors, status: errors.length === 0 ? 'valid' : 'invalid', saveMessage: errors.length === 0 ? r.saveMessage : null };
    });
  }

  saveData(): void {
    const toSave = this.rows().filter((r) => r.checked && r.status === 'valid');
    if (toSave.length === 0) {
      this.parseError.set('Select at least one valid row to save.');
      return;
    }

    this.parseError.set(null);
    this.saving.set(true);
    this.saveProgressMessage.set(`Saving ${toSave.length} voter${toSave.length === 1 ? '' : 's'}…`);
    this.lastSaveSummary.set(null);

    const batch: VoterBatchRow[] = toSave.map((r) => ({
      clientRowId: r.clientRowId,
      wardNo: r.wardNo || null,
      boothNo: r.boothNo || null,
      serialNumber: Number(r.serialNumber),
      voterId: r.voterId,
      name: r.name,
      relationType: r.relationType || null,
      relativeName: r.relativeName || null,
      houseNumber: r.houseNumber || null,
      age: r.age ? Number(r.age) : null,
      gender: r.gender || null,
    }));

    this.saveSubscription = this.voterService.importBatch(batch).subscribe({
      next: (results) => {
        this.saving.set(false);
        this.saveProgressMessage.set(null);
        const resultByRowId = new Map(results.map((res) => [res.clientRowId, res]));

        let savedCount = 0;
        let failedCount = 0;
        this.rows.update((rows) =>
          rows.map((r) => {
            const result = resultByRowId.get(r.clientRowId);
            if (!result) return r;
            if (result.success) {
              savedCount++;
              return { ...r, status: 'saved' as RowStatus, checked: false, saveMessage: result.message ?? 'Saved.' };
            }
            failedCount++;
            return { ...r, status: 'invalid' as RowStatus, saveMessage: result.message ?? 'Save failed.' };
          }),
        );

        this.lastSaveSummary.set(`${savedCount} saved, ${failedCount} failed.`);
        this.hasUnsavedWork = failedCount > 0 || this.rows().some((r) => r.status !== 'saved');
      },
      error: () => {
        this.saving.set(false);
        this.saveProgressMessage.set(null);
        this.lastSaveSummary.set('Something went wrong while saving — no rows were confirmed saved.');
      },
    });
  }

  stopImport(): void {
    if (!this.saveSubscription || this.saveSubscription.closed) return;
    this.saveSubscription.unsubscribe();
    this.saveSubscription = null;
    this.saving.set(false);
    this.saveProgressMessage.set(null);
    // Honest about what "Stop" actually guarantees here — there is no
    // cancellation-token/job-status API to confirm the server itself
    // stopped (see this component's own class-level comment), only that
    // this screen gave up waiting for the response.
    this.lastSaveSummary.set('Import cancelled from this screen — the server may already have processed some rows before this took effect. Use Refresh view, then Search in Voter Master, to check.');
  }

  onClose(): void {
    const hasSavedAny = this.rows().some((r) => r.status === 'saved');
    const hasRemainingWork = this.rows().some((r) => r.status !== 'saved');
    if (this.rows().length > 0 && hasRemainingWork) {
      this.dialog
        .open(ConfirmDialogComponent, {
          width: '420px',
          data: {
            title: 'Discard unsaved imported data?',
            message: 'Rows that have not been saved yet will be lost if you close this window now.',
          },
        })
        .afterClosed()
        .subscribe((confirmed) => {
          if (confirmed) this.dialogRef.close(hasSavedAny);
        });
      return;
    }
    this.dialogRef.close(hasSavedAny);
  }

  protected readonly resultFilterOptions = RESULT_FILTER_OPTIONS;
}
