import { Component, ElementRef, SecurityContext, computed, effect, forwardRef, input, signal, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';

let nextId = 0;

// http:/https:/mailto: only — rejects javascript:, data:, vbscript: etc.
// before a link is even applied (Angular's own sanitizer also strips an
// unsafe scheme later, but validating here gives the user an immediate,
// specific error instead of a silently-stripped href).
const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

type Tab = 'html' | 'preview';

// A real WYSIWYG HTML editor — not a textarea with toolbar buttons that do
// nothing. Built on the browser's native `contenteditable` + the (still
// universally supported in every evergreen browser, despite being
// formally "deprecated") `document.execCommand` — the only dependency-
// free primitive that actually performs rich-text formatting commands on
// a live selection. Deliberately NOT a 3rd-party editor (Quill/TipTap/
// CKEditor): this app has no rich-text dependency installed yet, hand-
// builds every other non-trivial form control itself (app-select,
// app-combobox, app-checkbox), and pulling in an editor library's own
// bundle + CSS theme would both blow the production bundle budget further
// and fight this app's own Skyline design system rather than match it.
//
// Same ControlValueAccessor contract as app-textarea, so it's a drop-in
// swap at any [formControlName] call site; the control's value is always
// a sanitized HTML string (see sanitizeHtml()'s own comment).
@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RichTextEditorComponent), multi: true }],
})
export class RichTextEditorComponent implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly required = input(false);
  readonly invalid = input(false);
  readonly errorText = input<string | null>(null);
  readonly placeholder = input<string>('Start typing…');

  protected readonly id = `app-rte-${nextId++}`;
  protected readonly tab = signal<Tab>('html');
  protected readonly disabled = signal(false);
  protected readonly hasFocus = signal(false);

  // The control's current value — always sanitized HTML (see
  // sanitizeHtml()). The live contenteditable DOM is only overwritten from
  // this signal while the editor doesn't have focus (writeValue, and the
  // very first render) — never on every keystroke, which would reset the
  // caret to position 0 on each input event.
  private readonly rawHtml = signal('');
  protected readonly previewHtml = computed(() => this.sanitizeHtml(this.rawHtml()));
  protected readonly isEmpty = computed(() => this.previewHtml().trim().length === 0);

  private readonly editorEl = viewChild<ElementRef<HTMLDivElement>>('editorEl');
  private readonly linkInputEl = viewChild<ElementRef<HTMLInputElement>>('linkInputEl');

  protected readonly activeStates = signal<Record<'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList', boolean>>({
    bold: false,
    italic: false,
    underline: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  });

  protected readonly linkPopoverOpen = signal(false);
  protected readonly linkUrl = signal('');
  protected readonly linkError = signal<string | null>(null);
  private savedRange: Range | null = null;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly sanitizer: DomSanitizer) {
    // Push external value changes into the live DOM only while the user
    // isn't actively editing — see rawHtml's own comment.
    effect(() => {
      const el = this.editorEl()?.nativeElement;
      const html = this.rawHtml();
      if (el && !this.hasFocus() && el.innerHTML !== html) el.innerHTML = html;
    });
  }

  // The one sanitization choke point for anything that ends up in either
  // the editable surface or the Preview tab — reuses Angular's own
  // DomSanitizer (already a framework dependency, so this needs no new
  // package) rather than hand-rolling an HTML allow-list: it strips
  // <script>/on*-attribute/unsafe-URL-scheme content while preserving the
  // standard safe formatting tags (b/strong/i/em/u/p/ul/ol/li/a/br/div/span)
  // this editor actually produces.
  private sanitizeHtml(html: string): string {
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }

  writeValue(value: unknown): void {
    const html = this.sanitizeHtml(value == null ? '' : String(value));
    this.rawHtml.set(html);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    const el = this.editorEl()?.nativeElement;
    if (el) el.contentEditable = isDisabled ? 'false' : 'true';
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  protected onEditorInput(): void {
    const el = this.editorEl()?.nativeElement;
    if (!el) return;
    const sanitized = this.sanitizeHtml(el.innerHTML);
    this.rawHtml.set(sanitized);
    this.onChange(sanitized);
    this.updateActiveStates();
  }

  protected onEditorFocus(): void {
    this.hasFocus.set(true);
  }

  protected onEditorBlur(): void {
    this.hasFocus.set(false);
    this.onTouched();
    // Re-sync the DOM to the sanitized value now that editing has paused
    // (cursor position no longer matters) — catches anything a prior
    // paste slipped past the live surface before this blur.
    const el = this.editorEl()?.nativeElement;
    if (el && el.innerHTML !== this.rawHtml()) el.innerHTML = this.rawHtml();
  }

  protected onEditorKeyup(): void {
    this.updateActiveStates();
  }

  protected onEditorMouseup(): void {
    this.updateActiveStates();
  }

  // Pasted content is the one realistic way raw <script>/event-handler
  // HTML could reach this editor — sanitize it BEFORE insertion rather
  // than letting the browser paste it unchanged and relying solely on the
  // next (input) sanitize pass (which only affects the emitted value, not
  // the already-rendered DOM in between).
  protected onEditorPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const html = event.clipboardData?.getData('text/html');
    const text = event.clipboardData?.getData('text/plain') ?? '';
    const safe = html ? this.sanitizeHtml(html) : this.escapeHtml(text);
    document.execCommand('insertHTML', false, safe);
    this.onEditorInput();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private updateActiveStates(): void {
    if (!this.hasFocus()) return;
    this.activeStates.set({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
    });
  }

  private focusEditor(): void {
    this.editorEl()?.nativeElement.focus();
  }

  private exec(command: string, value?: string): void {
    this.focusEditor();
    document.execCommand(command, false, value);
    this.onEditorInput();
  }

  protected toggleBold(): void {
    this.exec('bold');
  }

  protected toggleItalic(): void {
    this.exec('italic');
  }

  protected toggleUnderline(): void {
    this.exec('underline');
  }

  protected applyParagraph(): void {
    this.exec('formatBlock', '<p>');
  }

  protected toggleBulletList(): void {
    this.exec('insertUnorderedList');
  }

  protected toggleNumberedList(): void {
    this.exec('insertOrderedList');
  }

  protected insertLineBreak(): void {
    this.exec('insertHTML', '<br>');
  }

  // mousedown (not click) on every toolbar button is prevented from
  // stealing focus from the contenteditable surface — the standard
  // technique every hand-built rich text editor toolbar uses, since a
  // blur would collapse the user's text selection before the formatting
  // command ever runs.
  protected preventToolbarBlur(event: MouseEvent): void {
    event.preventDefault();
  }

  protected openLinkPopover(): void {
    const selection = document.getSelection();
    this.savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    this.linkUrl.set('');
    this.linkError.set(null);
    this.linkPopoverOpen.set(true);
    queueMicrotask(() => this.linkInputEl()?.nativeElement.focus());
  }

  protected closeLinkPopover(): void {
    this.linkPopoverOpen.set(false);
    this.savedRange = null;
  }

  protected confirmLink(): void {
    const raw = this.linkUrl().trim();
    if (!raw) {
      this.linkError.set('Enter a URL.');
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      this.linkError.set('Enter a valid, fully-qualified URL (e.g. https://example.com).');
      return;
    }
    if (!ALLOWED_LINK_PROTOCOLS.has(parsed.protocol)) {
      this.linkError.set('Only http, https and mailto links are allowed.');
      return;
    }

    this.focusEditor();
    const selection = document.getSelection();
    if (selection && this.savedRange) {
      selection.removeAllRanges();
      selection.addRange(this.savedRange);
    }
    // No text was selected — insert the URL itself as the link's own
    // visible text rather than silently doing nothing.
    if (!selection || selection.isCollapsed) {
      document.execCommand('insertHTML', false, `<a href="${parsed.toString()}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(parsed.toString())}</a>`);
    } else {
      document.execCommand('createLink', false, parsed.toString());
    }
    this.onEditorInput();
    this.closeLinkPopover();
  }
}
