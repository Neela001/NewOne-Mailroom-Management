import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MasterListComponent } from './master-list.component';
import { MenuService } from '../../../core/services/menu.service';
import { ConfigService } from '../../../core/services/config.service';
import { MasterEntityConfig } from './master-entity-config.model';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

// Covers the permission-handling fix: rights are read REACTIVELY from
// MenuService (a signal-driven effect), not a one-time ngOnInit snapshot,
// because this component can mount before MenuService's own
// admin/user-rights/me fetch resolves (see master-list.component.ts's own
// constructor comment for the race this fixes) — and a subMenu the user
// has no rights row for at all now fails closed (canView: false) instead
// of defaulting to visible.
@Component({ selector: 'app-test-blank', standalone: true, template: '' })
class BlankTestComponent {}

describe('MasterListComponent', () => {
  const FAKE_CONFIG: MasterEntityConfig = {
    entityLabel: 'Widget',
    entityLabelPlural: 'Widgets',
    apiBasePath: 'master/widget',
    idField: 'widgetId',
    columns: [{ key: 'widgetName', label: 'Name' }],
    formFields: [{ key: 'widgetName', label: 'Name', type: 'text', required: true }],
    historyColumns: [{ key: 'widgetName', label: 'Name' }],
    buildDeleteRequest: (row) => ({ widgetId: row['widgetId'] }),
    buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
    buildHistoryRequest: (row) => ({ widgetId: row['widgetId'] }),
  };

  let httpMock: HttpTestingController;
  let menuService: MenuService;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideAppIcons(),
        provideHttpClient(),
        provideHttpClientTesting(),
        // A catch-all route so navigateByUrl() in the first test below can
        // actually recognize '/app/master/widget' -- only used to make
        // Router.url reflect a real navigation; its component is never
        // rendered (MasterListComponent is created directly, not routed to).
        provideRouter([{ path: '**', component: BlankTestComponent }]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { config: FAKE_CONFIG } } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    menuService = TestBed.inject(MenuService);
  }

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  afterEach(() => httpMock.verify());

  it('shows Add/Edit/Delete only per the real per-screen rights, and loads the list, once rights resolve', async () => {
    setup();
    // Real backend menuUrl values have no /app prefix (see menu.service.ts's
    // own routerLink comment) -- MenuService adds it, so the route actually
    // navigated to must include it for findRightsForRoute() to match.
    await TestBed.inject(Router).navigateByUrl('/app/master/widget');
    menuService.initialize();
    httpMock.expectOne(apiUrl('admin/user-rights/me')).flush({
      success: true,
      data: [
        {
          userId: 'u1', userName: 'bob', userType: 'Employee', softwareId: null, softwareCode: null, softwareName: null,
          mainMenuId: 'm1', mainMenuCode: 'M', mainMenuName: 'M', mainMenuOrder: 1,
          verticalMenuId: 'v1', verticalMenuCode: 'V', verticalMenuName: 'V', verticalMenuOrder: 1,
          subMenuId: 's1', subMenuCode: 'WIDGET', subMenuName: 'Widget', menuUrl: '/master/widget', formName: null, iconName: null, subMenuOrder: 1,
          isCommon: false, canView: true, canAdd: true, canEdit: false, canDelete: true,
        },
      ],
    });

    const fixture = TestBed.createComponent(MasterListComponent);
    fixture.detectChanges();

    // Rights resolved canView: true -> the component's own effect fires loadList().
    httpMock.expectOne(apiUrl('master/widget/get')).flush({ success: true, data: [] });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.header-add-button')).toBeTruthy();
    expect(el.querySelector('.access-denied-row')).toBeFalsy();
  });

  it('fetches the full set (isActive: null) and shows only active rows in the table', async () => {
    setup();
    await TestBed.inject(Router).navigateByUrl('/app/master/widget');
    menuService.initialize();
    httpMock.expectOne(apiUrl('admin/user-rights/me')).flush({
      success: true,
      data: [
        {
          userId: 'u1', userName: 'bob', userType: 'Employee', softwareId: null, softwareCode: null, softwareName: null,
          mainMenuId: 'm1', mainMenuCode: 'M', mainMenuName: 'M', mainMenuOrder: 1,
          verticalMenuId: 'v1', verticalMenuCode: 'V', verticalMenuName: 'V', verticalMenuOrder: 1,
          subMenuId: 's1', subMenuCode: 'WIDGET', subMenuName: 'Widget', menuUrl: '/master/widget', formName: null, iconName: null, subMenuOrder: 1,
          isCommon: false, canView: true, canAdd: true, canEdit: false, canDelete: true,
        },
      ],
    });

    const fixture = TestBed.createComponent(MasterListComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne(apiUrl('master/widget/get'));
    expect(req.request.body.isActive).toBeNull(); // fetches the FULL set, not isActive: true
    req.flush({
      success: true,
      data: [
        { widgetId: '1', widgetName: 'A', isActive: true },
        { widgetId: '2', widgetName: 'B', isActive: false },
        { widgetId: '3', widgetName: 'C', isActive: true },
      ],
    });
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as { rows: () => unknown[] };
    expect(component.rows().length).toBe(2); // the inactive row is excluded from the visible table
  });

  it('fails closed: a user with no rights row at all for this route never sees the data or gets an API call', () => {
    setup();
    menuService.initialize();
    httpMock.expectOne(apiUrl('admin/user-rights/me')).flush({ success: true, data: [] });

    const fixture = TestBed.createComponent(MasterListComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.access-denied-row')).toBeTruthy();
    expect(el.querySelector('.add-button')).toBeFalsy();
    httpMock.expectNone(apiUrl('master/widget/get'));
  });
});
