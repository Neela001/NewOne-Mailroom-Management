import { handleFormEnterKey } from './form-keyboard.util';

function buildForm(html: string): HTMLFormElement {
  const form = document.createElement('form');
  form.innerHTML = html;
  document.body.appendChild(form);
  return form;
}

function pressEnter(form: HTMLFormElement, target: HTMLElement): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: target });
  Object.defineProperty(event, 'currentTarget', { value: form });
  handleFormEnterKey(event);
  return event;
}

describe('handleFormEnterKey', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('moves focus to the next text input and prevents the native submit', () => {
    const form = buildForm(`
      <input type="text" id="a" />
      <input type="text" id="b" />
    `);
    const a = form.querySelector<HTMLInputElement>('#a')!;
    const b = form.querySelector<HTMLInputElement>('#b')!;
    a.focus();

    const event = pressEnter(form, a);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(b);
  });

  it('advances from a text input to a select element', () => {
    const form = buildForm(`
      <input type="text" id="a" />
      <select id="sel"></select>
    `);
    const a = form.querySelector<HTMLInputElement>('#a')!;
    const sel = form.querySelector<HTMLElement>('#sel')!;
    a.focus();

    pressEnter(form, a);

    expect(document.activeElement).toBe(sel);
  });

  it('does nothing (no preventDefault) when Enter is pressed on a checkbox', () => {
    const form = buildForm(`<input type="checkbox" id="cb" />`);
    const cb = form.querySelector<HTMLInputElement>('#cb')!;
    cb.focus();

    const event = pressEnter(form, cb);

    expect(event.defaultPrevented).toBe(false);
  });

  it('does nothing when Enter is pressed on a non-input element (e.g. a select itself)', () => {
    const form = buildForm(`<select id="sel"></select>`);
    const sel = form.querySelector<HTMLElement>('#sel')!;
    sel.focus();

    const event = pressEnter(form, sel);

    expect(event.defaultPrevented).toBe(false);
  });

  it('prevents the native submit but does not throw when the current field is last', () => {
    const form = buildForm(`<input type="text" id="only" />`);
    const only = form.querySelector<HTMLInputElement>('#only')!;
    only.focus();

    const event = pressEnter(form, only);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(only);
  });

  it('skips disabled fields when advancing', () => {
    const form = buildForm(`
      <input type="text" id="a" />
      <input type="text" id="b" disabled />
      <input type="text" id="c" />
    `);
    const a = form.querySelector<HTMLInputElement>('#a')!;
    const c = form.querySelector<HTMLInputElement>('#c')!;
    a.focus();

    pressEnter(form, a);

    expect(document.activeElement).toBe(c);
  });
});
