import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuService } from '../../core/services/menu.service';
import { StorageService } from '../../core/services/storage.service';
import { StorageKey } from '../../core/models/storage-key.enum';
import { LoginResponse } from '../../core/models/auth.model';
import { MenuTreeItemComponent } from '../../shared/components/menu-tree-item/menu-tree-item.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';

// The primary navigation — a permanent left sidebar on desktop, demoted to
// a hamburger-triggered overlay drawer below the tablet breakpoint (see
// shell.component.html's own comment). Structure/behavior is explicitly
// pinned by the user (accordion list, optional icon-only compact mode) —
// an earlier pass of this session replaced it with a collapsed icon-rail +
// flyout pattern; that was explicitly reverted per a later, overriding
// instruction ("DO NOT implement icon-rail navigation... keep the existing
// sidebar structure exactly as it is"). Only the brand mark (logo + name,
// see sidenav.component.html's own comment) and color tokens were updated
// after the revert — never the structure itself.
//
// `compact` is a plain @Input, not a signal this component owns and tries
// to report upward — ShellComponent is the single source of truth for it
// (reads localStorage once, passes the value down; see its own comment for
// the constructor-emit bug that used to cause a mismatch between this
// component's content and its container's width). This component only
// asks the parent to toggle; it never decides the value itself.
@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [RouterLink, MenuTreeItemComponent, IconComponent, ButtonComponent],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.scss',
})
export class SidenavComponent {
  @Input() compact = false;
  @Output() linkClicked = new EventEmitter<void>();
  @Output() toggleCompact = new EventEmitter<void>();

  protected readonly menuService = inject(MenuService);
  private readonly storage = inject(StorageService);

  protected readonly displayName = signal(this.storage.get<LoginResponse>(StorageKey.USER)?.userName ?? 'User');

  constructor() {
    this.menuService.initialize();
  }

  onLeafClicked(): void {
    this.linkClicked.emit();
  }

  retry(): void {
    location.reload();
  }
}
