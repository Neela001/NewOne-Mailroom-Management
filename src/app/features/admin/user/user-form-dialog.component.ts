import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { ApiService } from '../../../core/services/api.service';
import { MasterApiService } from '../../master/shared/master-api.service';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { SelectComponent } from '../../../shared/ui/form/select.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { CheckboxComponent } from '../../../shared/ui/form/checkbox.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { USER_TYPE_OPTIONS, UserRow, UserRoleRow, DeskOptionRow } from './user.model';

export interface UserFormDialogData {
  row: UserRow | null; // null for 'add'
  mode: 'add' | 'edit';
  initialTab?: 'account' | 'roles' | 'desks';
}

export type UserFormDialogResult = boolean;

type Tab = 'account' | 'roles' | 'desks';

// Password required on Add, optional on Edit (leave blank to keep the
// existing one — the real UserWithRolesRequest.password is nullable, and
// there's no separate "set password" flag to say "I didn't touch this").
// Minimum length 8 — from the user's own reference screenshot, not
// documented by the live Swagger spec (password has no minLength
// constraint there) — see this session's own investigation report.
function passwordValidators(isEdit: boolean) {
  return isEdit ? [Validators.minLength(8)] : [Validators.required, Validators.minLength(8)];
}

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (!password && !confirm) return null; // both blank on Edit = "don't change password"
  return password === confirm ? null : { mismatch: true };
}

// Dedicated — not MasterEntityConfig-driven — see user-list.component.ts's
// own comment for why: three tabs (Account/Roles/Desks), a combined
// User+Roles+Desks save (admin/user/save-with-roles, CONFIRMED real —
// matches AdminApiService.SaveUserWithRolesAsync(user, password, roleIds,
// remarks) in D:\NewOne's own reflected RoleRightsForm-adjacent types), and
// multi-select role/desk assignment the generic MasterFormField model has
// no shape for.
@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, ButtonComponent, InputComponent, SelectComponent, ComboboxComponent, CheckboxComponent, TextareaComponent],
  templateUrl: './user-form-dialog.component.html',
  styleUrl: './user-form-dialog.component.scss',
})
export class UserFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly api = inject(ApiService);
  protected readonly dialogRef = inject(DialogRef<UserFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly dialogTitle: string;
  protected readonly userTypeOptions = USER_TYPE_OPTIONS;
  protected readonly tab = signal<Tab>('account');
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form: FormGroup;

  protected readonly employeeOptions = signal<SelectOption[]>([]);
  protected readonly employeeOptionsLoading = signal(false);
  protected readonly vendorStaffOptions = signal<SelectOption[]>([]);
  protected readonly vendorStaffOptionsLoading = signal(false);
  protected readonly linkedPersonOptions = computed(() => (this.form.get('userType')?.value === 'VENDORSTAFF' ? this.vendorStaffOptions() : this.employeeOptions()));
  protected readonly linkedPersonLoading = computed(() => (this.form.get('userType')?.value === 'VENDORSTAFF' ? this.vendorStaffOptionsLoading() : this.employeeOptionsLoading()));

  protected readonly roleOptions = signal<{ roleId: string; roleName: string }[]>([]);
  protected readonly selectedRoleIds = signal<Set<string>>(new Set());
  protected readonly rolesLoading = signal(false);

  protected readonly deskOptions = signal<DeskOptionRow[]>([]);
  protected readonly selectedDeskIds = signal<Set<string>>(new Set());
  protected readonly defaultDeskId = signal<string>('');
  protected readonly desksLoading = signal(false);

  constructor(@Inject(DIALOG_DATA) public data: UserFormDialogData) {
    this.isEdit = data.mode === 'edit';
    this.dialogTitle = this.isEdit ? 'Edit User' : 'New User';
    this.tab.set(data.initialTab ?? 'account');

    const row = data.row;
    this.form = new FormGroup(
      {
        userType: new FormControl(row?.userType ?? 'EMPLOYEE', [Validators.required]),
        linkedPersonId: new FormControl(row?.employeeId ?? row?.vendorStaffId ?? '', [Validators.required]),
        userName: new FormControl(row?.userName ?? '', [Validators.required]),
        password: new FormControl('', passwordValidators(this.isEdit)),
        confirmPassword: new FormControl('', []),
        forcePasswordChange: new FormControl(row?.forcePasswordChange ?? false),
        remarks: new FormControl(''),
      },
      { validators: passwordsMatchValidator },
    );
  }

  ngOnInit(): void {
    this.employeeOptionsLoading.set(true);
    this.masterApi.get<Record<string, unknown>, Record<string, unknown>>('master/employee', { searchText: null, isActive: true }).subscribe((rows) => {
      this.employeeOptions.set(rows.map((r) => ({ label: String(r['fullName'] ?? ''), value: String(r['employeeId']) })));
      this.employeeOptionsLoading.set(false);
    });
    this.vendorStaffOptionsLoading.set(true);
    this.masterApi.get<Record<string, unknown>, Record<string, unknown>>('master/vendorstaff', { searchText: null, isActive: true }).subscribe((rows) => {
      this.vendorStaffOptions.set(rows.map((r) => ({ label: String(r['fullName'] ?? ''), value: String(r['vendorStaffId']) })));
      this.vendorStaffOptionsLoading.set(false);
    });

    this.rolesLoading.set(true);
    this.masterApi.get<Record<string, unknown>, UserRoleRow>('admin/role', { searchText: null, isActive: true }).subscribe((roles) => {
      this.roleOptions.set(roles.map((r) => ({ roleId: String((r as unknown as Record<string, unknown>)['roleId']), roleName: String((r as unknown as Record<string, unknown>)['roleName']) })));
      this.rolesLoading.set(false);
    });

    // Same untyped-but-really-PascalCase-at-runtime /get response shape as
    // every master/admin entity (CONFIRMED live — DeskId/DeskCode/DeskName/
    // etc.) — routed through MasterApiService.get() for its own
    // normalizeRowKeys() pass rather than a raw ApiService.post(), which
    // would otherwise leave every field undefined here (reproduced live:
    // blank desk labels and checkboxes that could never match by id).
    this.desksLoading.set(true);
    this.masterApi.get<Record<string, never>, DeskOptionRow>('admin/desk-user/options', {}).subscribe({
      next: (rows) => {
        this.deskOptions.set(rows);
        this.desksLoading.set(false);
      },
      error: () => this.desksLoading.set(false),
    });

    const userId = this.data.row?.userId;
    if (this.isEdit && userId) {
      // No documented userId filter on admin/userrole/get (CONFIRMED from
      // the live Swagger spec — UserroleGetRequest only has
      // userRoleId/searchText/isActive) — fetch the full set once and
      // filter client-side, the same pattern this session's own Role
      // Rights investigation already established for the same reason.
      this.masterApi.get<Record<string, unknown>, UserRoleRow>('admin/userrole', { searchText: null, isActive: true }).subscribe((rows) => {
        const mine = (rows as unknown as Record<string, unknown>[]).filter((r) => r['userId'] === userId);
        this.selectedRoleIds.set(new Set(mine.map((r) => String(r['roleId']))));
      });

      // admin/desk-user/get DOES document a real userId filter — same
      // normalization note as admin/desk-user/options/get above.
      this.masterApi.get<{ userId: string; isActive: null }, Record<string, unknown>>('admin/desk-user', { userId, isActive: null }).subscribe((rows) => {
        this.selectedDeskIds.set(new Set(rows.map((r) => String(r['deskId']))));
        const def = rows.find((r) => r['isDefault'] === true);
        if (def) this.defaultDeskId.set(String(def['deskId']));
      });
    }
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  toggleRole(roleId: string): void {
    this.selectedRoleIds.update((current) => {
      const next = new Set(current);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  }

  toggleDesk(deskId: string): void {
    this.selectedDeskIds.update((current) => {
      const next = new Set(current);
      if (next.has(deskId)) next.delete(deskId);
      else next.add(deskId);
      if (!next.has(this.defaultDeskId())) this.defaultDeskId.set(next.size ? [...next][0] : '');
      return next;
    });
  }

  setDefaultDesk(deskId: string): void {
    if (this.selectedDeskIds().has(deskId)) this.defaultDeskId.set(deskId);
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
      this.tab.set('account');
      return;
    }
    if (this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      userId: this.isEdit ? this.data.row!.userId : undefined,
      userType: raw.userType,
      employeeId: raw.userType === 'VENDORSTAFF' ? null : raw.linkedPersonId,
      vendorStaffId: raw.userType === 'VENDORSTAFF' ? raw.linkedPersonId : null,
      userName: raw.userName,
      password: raw.password || null,
      forcePasswordChange: raw.forcePasswordChange,
      remarks: raw.remarks || null,
      roleIds: [...this.selectedRoleIds()],
      deskIds: [...this.selectedDeskIds()],
      defaultDeskId: this.defaultDeskId() || null,
    };

    this.api.post<typeof payload, unknown>('admin/user/save-with-roles', payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this user.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this user.');
      },
    });
  }
}
