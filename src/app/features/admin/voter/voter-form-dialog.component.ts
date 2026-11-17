import { Component, Inject, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { VoterService } from './voter.service';
import { VoterRow } from './voter.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';

export interface VoterFormDialogData {
  row: VoterRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type VoterFormDialogResult = boolean;

// Real values seen live against 702 existing rows (see voter.model.ts's
// own comment) — no documented fixed enum exists server-side, so this is a
// convenience starting list, not an exhaustive constraint; the field
// itself stays free text (a user can type a value not in this list — e.g.
// a genuinely new relation — without being blocked).
const RELATION_TYPE_SUGGESTIONS: SelectOption[] = [
  { label: '(Not specified)', value: '' },
  { label: 'Husband', value: 'Husband' },
  { label: 'Father', value: 'Father' },
  { label: 'Mother', value: 'Mother' },
  { label: 'Other', value: 'Other' },
  { label: 'Unclear', value: 'Unclear' },
];

const GENDER_OPTIONS: SelectOption[] = [
  { label: '(Not specified)', value: '' },
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];

// Voter's own Add/Edit dialog — not MasterFormDialogComponent-driven, see
// voter-list.component.ts's own comment for why. Field order matches the
// Windows reference exactly: Ward no./Booth no., Serial number/Voter ID,
// Name/Relation type, Relative name/House number, Age/Gender, Remarks.
@Component({
  selector: 'app-voter-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent, TextareaComponent],
  templateUrl: './voter-form-dialog.component.html',
  styleUrl: './voter-form-dialog.component.scss',
})
export class VoterFormDialogComponent {
  private readonly voterService = inject(VoterService);
  protected readonly dialogRef = inject(DialogRef<VoterFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly dialogTitle: string;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly relationTypeOptions = RELATION_TYPE_SUGGESTIONS;
  protected readonly genderOptions = GENDER_OPTIONS;

  protected readonly form: FormGroup;

  constructor(@Inject(DIALOG_DATA) public data: VoterFormDialogData) {
    this.isEdit = data.mode === 'edit';
    this.dialogTitle = this.isEdit ? 'Edit Voter' : 'Add Voter';
    const row = data.row;

    this.form = new FormGroup({
      voterRecordId: new FormControl(row?.voterRecordId ?? null),
      wardNo: new FormControl(row?.wardNo ?? '', [Validators.required, Validators.maxLength(20)]),
      boothNo: new FormControl(row?.boothNo ?? '', [Validators.required, Validators.maxLength(20)]),
      serialNumber: new FormControl(row?.serialNumber ?? null, [Validators.required, Validators.min(1)]),
      voterId: new FormControl(row?.voterId ?? '', [Validators.required, Validators.maxLength(30)]),
      name: new FormControl(row?.name ?? '', [Validators.required, Validators.maxLength(200)]),
      relationType: new FormControl(row?.relationType ?? ''),
      relativeName: new FormControl(row?.relativeName ?? '', [Validators.maxLength(200)]),
      houseNumber: new FormControl(row?.houseNumber ?? '', [Validators.maxLength(50)]),
      age: new FormControl(row?.age ?? null, [Validators.min(0), Validators.max(150)]),
      gender: new FormControl(row?.gender ?? ''),
      remarks: new FormControl('', [Validators.maxLength(500)]),
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onEnterKey(event: Event): void {
    handleFormEnterKey(event as KeyboardEvent);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const payload = {
      voterRecordId: this.isEdit ? value.voterRecordId : null,
      wardNo: value.wardNo,
      boothNo: value.boothNo,
      serialNumber: value.serialNumber,
      voterId: value.voterId,
      name: value.name,
      relationType: value.relationType || null,
      relativeName: value.relativeName || null,
      houseNumber: value.houseNumber || null,
      age: value.age === '' || value.age === null ? null : Number(value.age),
      gender: value.gender || null,
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.voterService.edit(payload) : this.voterService.add(payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this voter.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this voter.');
      },
    });
  }
}
