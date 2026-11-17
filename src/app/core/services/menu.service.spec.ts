import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { MenuService } from './menu.service';
import { ConfigService } from './config.service';
import { LoginUserRightRow } from '../models/menu.model';

// Covers the real, non-generated permission logic in this service: rows
// with canView === false are dropped from the tree entirely (NEW vs. the
// reference project, which only checked menu presence — see
// transformRows()'s own comment), and findRightsForRoute() is what gates
// every MasterListComponent's own Add/Edit/Delete/History buttons.
describe('MenuService', () => {
  let service: MenuService;
  let httpMock: HttpTestingController;

  function row(overrides: Partial<LoginUserRightRow>): LoginUserRightRow {
    return {
      userId: 'u1',
      userName: 'bob',
      userType: 'Employee',
      softwareId: null,
      softwareCode: null,
      softwareName: null,
      mainMenuId: 'm1',
      mainMenuCode: 'MASTER',
      mainMenuName: 'Master',
      mainMenuOrder: 1,
      verticalMenuId: 'v1',
      verticalMenuCode: 'LOC',
      verticalMenuName: 'Location',
      verticalMenuOrder: 1,
      subMenuId: 's1',
      subMenuCode: 'COUNTRY',
      subMenuName: 'Country',
      menuUrl: '/master/country', // raw backend shape, no /app prefix (see menu.service.ts's own routerLink comment)
      formName: null,
      iconName: 'flag',
      subMenuOrder: 1,
      isCommon: false,
      canView: true,
      canAdd: true,
      canEdit: false,
      canDelete: false,
      ...overrides,
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(MenuService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  it('builds a Main -> Vertical -> Sub tree and exposes rights on the leaf', () => {
    service.initialize();
    httpMock.expectOne(apiUrl('admin/user-rights/me')).flush({ success: true, data: [row({})] });

    const tree = service.menuTree();
    expect(tree.length).toBe(1);
    expect(tree[0].label).toBe('Master');
    expect(tree[0].items?.[0].label).toBe('Location');
    const leaf = tree[0].items?.[0].items?.[0];
    expect(leaf?.label).toBe('Country');
    expect(leaf?.rights).toEqual({ canView: true, canAdd: true, canEdit: false, canDelete: false });
  });

  it('drops a subMenu row entirely when canView is false (real permission gate, not just presence)', () => {
    service.initialize();
    httpMock.expectOne(apiUrl('admin/user-rights/me')).flush({
      success: true,
      data: [row({ canView: false })],
    });

    expect(service.menuTree()).toEqual([]);
  });

  it('findRightsForRoute() returns null for a route the user has no rights row for', () => {
    service.initialize();
    httpMock.expectOne(apiUrl('admin/user-rights/me')).flush({ success: true, data: [row({})] });

    expect(service.findRightsForRoute('/app/master/country')).toEqual({ canView: true, canAdd: true, canEdit: false, canDelete: false });
    expect(service.findRightsForRoute('/app/master/vendor')).toBeNull();
  });

  it('prefixes the real backend\'s raw menuUrl ("/master/country") with /app to match this app\'s actual route (live-confirmed, see transformRows()\'s own comment)', () => {
    service.initialize();
    httpMock.expectOne(apiUrl('admin/user-rights/me')).flush({ success: true, data: [row({ menuUrl: '/master/country' })] });

    const leaf = service.menuTree()[0]?.items?.[0]?.items?.[0];
    expect(leaf?.routerLink).toBe('/app/master/country');
  });

  it('findBreadcrumbTrail() returns the ancestor path (Main, Vertical) excluding the leaf — the leaf is already the page\'s own title', () => {
    service.initialize();
    httpMock.expectOne(apiUrl('admin/user-rights/me')).flush({ success: true, data: [row({})] });

    expect(service.findBreadcrumbTrail('/app/master/country')).toEqual([{ label: 'Master' }, { label: 'Location' }]);
  });

  it('findBreadcrumbTrail() returns [] for a route with no matching leaf', () => {
    service.initialize();
    httpMock.expectOne(apiUrl('admin/user-rights/me')).flush({ success: true, data: [row({})] });

    expect(service.findBreadcrumbTrail('/app/home')).toEqual([]);
  });

  it('findBreadcrumbTrail() collapses an immediately-repeated label rather than showing a real duplicate', () => {
    service.initialize();
    httpMock.expectOne(apiUrl('admin/user-rights/me')).flush({
      success: true,
      data: [row({ mainMenuName: 'Masters', verticalMenuName: 'Masters' })],
    });

    expect(service.findBreadcrumbTrail('/app/master/country')).toEqual([{ label: 'Masters' }]);
  });

  it('assigns a meaningful icon per real mainMenu/verticalMenu name instead of a single generic folder/label icon for every group', () => {
    service.initialize();
    httpMock.expectOne(apiUrl('admin/user-rights/me')).flush({
      success: true,
      data: [
        row({ mainMenuId: 'm1', mainMenuName: 'Admin', verticalMenuId: 'v1', verticalMenuName: 'Country' }),
        row({ mainMenuId: 'm2', mainMenuName: 'Some Future Group', verticalMenuId: 'v2', verticalMenuName: 'Unmapped Section', subMenuId: 's2' }),
      ],
    });

    const tree = service.menuTree();
    const admin = tree.find((m) => m.label === 'Admin')!;
    expect(admin.icon).toBe('admin_panel_settings');
    expect(admin.items?.[0]?.label).toBe('Country');
    expect(admin.items?.[0]?.icon).toBe('public');

    // An unrecognized real name still gets a distinct, non-crashing
    // fallback icon rather than the old single generic 'folder' everywhere.
    const unmapped = tree.find((m) => m.label === 'Some Future Group')!;
    expect(unmapped.icon).toBe('folder_open');
  });

  it('implemented is true for a real menuUrl this app has a registered route for, false for one it doesn\'t', () => {
    service.initialize();
    httpMock.expectOne(apiUrl('admin/user-rights/me')).flush({
      success: true,
      data: [
        row({ subMenuId: 's1', subMenuName: 'Country', menuUrl: '/master/country' }),
        row({ subMenuId: 's2', subMenuName: 'Mode', menuUrl: '/mailroom/master/mode', verticalMenuId: 'v2', verticalMenuName: 'Service Provider' }),
      ],
    });

    const verticals = service.menuTree()[0]?.items ?? [];
    const countryLeaf = verticals.find((v) => v.label === 'Location')?.items?.find((s) => s.label === 'Country');
    const modeLeaf = verticals.find((v) => v.label === 'Service Provider')?.items?.find((s) => s.label === 'Mode');

    expect(countryLeaf?.implemented).toBe(true);
    expect(modeLeaf?.implemented).toBe(false);
  });

  it('findActiveTopLevelKey() returns the top-level group key containing the current route, regardless of depth', () => {
    service.initialize();
    httpMock.expectOne(apiUrl('admin/user-rights/me')).flush({ success: true, data: [row({})] });

    expect(service.findActiveTopLevelKey('/app/master/country')).toBe('0');
    expect(service.findActiveTopLevelKey('/app/does/not/exist')).toBeNull();
  });

  it('hasLoaded() becomes true once the request settles, even on an unsuccessful response', () => {
    expect(service.hasLoaded()).toBe(false);

    service.initialize();
    httpMock.expectOne(apiUrl('admin/user-rights/me')).flush({ success: false, message: 'boom', data: null });

    expect(service.hasLoaded()).toBe(true);
    expect(service.menuTree()).toEqual([]);
  });
});
