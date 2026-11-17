const ADVANCEABLE_INPUT_TYPES = new Set(['text', 'number', 'password', 'date', 'email', 'tel', 'search']);

// Pressing Enter inside an ordinary single-line <input> would otherwise
// submit the enclosing form natively (standard HTML "implicit submission"
// behavior) — intercepted here to move focus to the next field instead,
// the same "Enter advances to the next cell" pattern fast, spreadsheet-
// style data entry uses. Deliberately narrow in what it touches: only
// plain text-like <input> types. A <textarea> needs its own real newlines,
// a <select>'s own Enter commits its currently-highlighted option, and a
// checkbox's own toggle key is Space, not Enter — none of those are native
// <input> elements with one of the types below, so they fall through
// untouched and keep their normal keyboard behavior exactly as the
// browser already implements it.
export function handleFormEnterKey(event: KeyboardEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!ADVANCEABLE_INPUT_TYPES.has(target.type)) return;

  // Always prevent the native submit for these input types, even if there
  // turns out to be no next field to advance to (e.g. the last field in
  // the form) — the user pressing Enter mid-entry should never submit an
  // incomplete form by accident; reaching Save is a deliberate, separate
  // action (click, or Tab to it and press Enter/Space there).
  event.preventDefault();

  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;

  // `:not([disabled])` is the only filter — this app's own Add/Edit dialog
  // forms never conditionally hide an individual field at runtime once
  // rendered (every field in a given entity's config always shows), so a
  // layout-based "is it actually visible" check isn't needed here, and
  // avoiding one keeps this testable without a real browser layout engine.
  const candidates = Array.from(form.querySelectorAll<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));

  const index = candidates.indexOf(target);
  if (index >= 0 && index < candidates.length - 1) {
    candidates[index + 1].focus();
  }
}
