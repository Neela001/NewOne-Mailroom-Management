import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuTreeNode } from '../../../core/models/menu.model';
import { MenuService } from '../../../core/services/menu.service';
import { IconComponent } from '../../ui/icon/icon.component';
import { NewOneIconComponent } from '../../ui/icon/newone-icon.component';

// Recursive accordion renderer for MenuService's tree. Every depth
// (including depth 0 — the top-level MainMenu heading) is an equally
// toggleable branch, one open at a time app-wide (MenuService's single
// `expandedKey`, ancestor-prefixed so an open descendant keeps every
// ancestor visually "open" too).
//
// A leaf with `implemented === false` (see menu.model.ts's own comment —
// a real backend menu entry with no matching route in this build yet)
// renders as a disabled row with a "Soon" badge instead of a normal link,
// so it's never a dead click that silently bounces to /login.
@Component({
  selector: 'app-menu-tree-item',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent, NewOneIconComponent, MenuTreeItemComponent],
  templateUrl: './menu-tree-item.component.html',
  styleUrl: './menu-tree-item.component.scss',
})
export class MenuTreeItemComponent {
  @Input({ required: true }) item!: MenuTreeNode;
  @Input() depth = 0;
  // Icon-only compact mode — labels hide, a tooltip shows the full label on
  // hover/focus instead. Passed down to every descendant so the whole tree
  // renders consistently, not just the top level.
  @Input() compact = false;
  @Output() leafClicked = new EventEmitter<void>();

  protected readonly menuService = inject(MenuService);

  protected get isLeaf(): boolean {
    return !this.item.items || this.item.items.length === 0;
  }

  protected get isTopLevel(): boolean {
    return this.depth === 0;
  }

  protected get isExpanded(): boolean {
    return this.menuService.isBranchExpanded(this.item.key);
  }

  // Depth-based indentation, computed here in TypeScript rather than via a
  // Tailwind arbitrary-value class containing calc()/var() — CONFIRMED
  // LIVE that Tailwind v4's own arbitrary-value scanner does not reliably
  // generate a rule for a class that complex (nested parens + a custom
  // property inside calc()), so the class name showed up correctly in the
  // DOM but matched no CSS rule at all, silently computing to 0. A plain
  // [style.paddingLeft.rem] binding sidesteps that limitation entirely —
  // this is a genuinely dynamic, per-instance value, which inline styles
  // handle more reliably here than a generated utility class. Collapses
  // to 0 in compact mode, where rows are centered, not indented.
  protected get branchIndentRem(): number {
    return this.compact ? 0 : (this.depth - 1) * 1 + 0.75;
  }

  protected get leafIndentRem(): number {
    return this.compact ? 0 : (this.depth - 1) * 1 + 0.75 + 1.6;
  }

  // A real SVG size (the Lucide icon's own [size] input), not a Tailwind
  // CSS override class — the top-level group heading's icon is rendered
  // smaller than every other branch/leaf icon when expanded (see the
  // template's own [class.!text-navy-400]/[class.!text-brand-400] pair for
  // the color half of that same top-level treatment).
  protected get branchIconSize(): number {
    return this.isTopLevel && !this.compact ? 16 : 19;
  }

  onBranchToggle(): void {
    this.menuService.toggleBranch(this.item.key);
  }

  onLeafClick(): void {
    this.leafClicked.emit();
  }

  onChildLeafClicked(): void {
    this.leafClicked.emit();
  }
}
