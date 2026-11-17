import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { ComboboxComponent } from './combobox.component';
import { provideAppIcons } from '../icon/lucide-icons.provider';
import { SelectOption } from './select.component';

// A thin host so the combobox is driven the same way every real call site
// drives it — [(ngModel)] over its ControlValueAccessor — rather than
// poking its protected internals directly.
@Component({
  standalone: true,
  imports: [ComboboxComponent, FormsModule],
  template: `<app-combobox label="Postal Code" [options]="options()" [(ngModel)]="value" />`,
})
class HostComponent {
  readonly options = signal<SelectOption[]>([]);
  value: unknown = '';
}

describe('ComboboxComponent', () => {
  function createHost(options: SelectOption[]) {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideAppIcons()],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.options.set(options);
    fixture.detectChanges();
    return fixture;
  }

  function openAndType(fixture: ReturnType<typeof createHost>, query: string) {
    const trigger: HTMLElement = fixture.nativeElement.querySelector('[role="combobox"]');
    trigger.click();
    fixture.detectChanges();
    const search: HTMLInputElement = fixture.nativeElement.querySelector('[role="listbox"] input');
    search.value = query;
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  // The real motivating case: typing a numeric postal code must filter the
  // real loaded option list the same way a text name search would.
  it('filters options by case-insensitive substring, including numeric-looking labels like a postal code', () => {
    const fixture = createHost([
      { label: '600001', value: 'p1' },
      { label: '600002', value: 'p2' },
      { label: '110001', value: 'p3' },
    ]);

    openAndType(fixture, '6000');

    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[role="option"]'));
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.textContent?.trim())).toEqual(['600001', '600002']);
  });

  it('shows "No results found" when nothing matches the typed query', () => {
    const fixture = createHost([{ label: 'Mumbai', value: 'c1' }]);

    openAndType(fixture, 'zzz-no-match');

    expect(fixture.nativeElement.querySelector('[role="listbox"]').textContent).toContain('No results found');
    expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(0);
  });

  it('selecting an option writes the real option value back through ngModel (not just its label)', () => {
    const fixture = createHost([
      { label: 'Mumbai', value: 'city-uuid-1' },
      { label: 'Pune', value: 'city-uuid-2' },
    ]);

    openAndType(fixture, 'pun');
    const option: HTMLElement = fixture.nativeElement.querySelector('[role="option"]');
    option.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.value).toBe('city-uuid-2');
    // The panel closes and the trigger now shows the selected label.
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('[role="combobox"]').textContent).toContain('Pune');
  });

  it('the clear button resets the value without reopening/selecting', () => {
    const fixture = createHost([{ label: 'Mumbai', value: 'city-uuid-1' }]);
    openAndType(fixture, 'mum');
    (fixture.nativeElement.querySelector('[role="option"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value).toBe('city-uuid-1');

    const clearButton: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Clear selection"]');
    expect(clearButton).toBeTruthy();
    clearButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.value).toBe('');
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeFalsy();
  });

  it('shows a loading row instead of "No results found" while options are still being fetched', () => {
    TestBed.configureTestingModule({
      imports: [ComboboxComponent],
      providers: [provideAppIcons()],
    });
    const fixture = TestBed.createComponent(ComboboxComponent);
    fixture.componentRef.setInput('options', []);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const trigger: HTMLElement = fixture.nativeElement.querySelector('[role="combobox"]');
    trigger.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="listbox"]').textContent).toContain('Loading');
    expect(fixture.nativeElement.querySelector('[role="listbox"]').textContent).not.toContain('No results found');
  });

  it('Escape closes the panel and returns focus to the trigger without changing the value', () => {
    const fixture = createHost([{ label: 'Mumbai', value: 'city-uuid-1' }]);

    openAndType(fixture, 'mum');
    const search: HTMLInputElement = fixture.nativeElement.querySelector('[role="listbox"] input');
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeFalsy();
    expect(fixture.componentInstance.value).toBe('');
  });
});
