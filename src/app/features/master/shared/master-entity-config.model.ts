// Declarative, per-entity config consumed by the one generic
// list/form/history component trio below — NOT one hand-written component
// set per entity. ~30 of the new API's master entities share an identical
// add/edit/delete/get/history shape (confirmed directly from the live spec
// — see api-response.model.ts's own comment), so duplicating a component
// trio per entity would be pure, unnecessary boilerplate in a greenfield
// project. Each entity instead supplies one small config object like this.
export type MasterFieldType = 'text' | 'number' | 'boolean' | 'select' | 'date' | 'password' | 'textarea';

export interface MasterFormField {
  key: string;
  label: string;
  type: MasterFieldType;
  required?: boolean;
  // Static option list (e.g. a fixed gender/type enum with no backing entity).
  options?: { label: string; value: unknown }[];
  // For a foreign-key field (e.g. Branch.companyId) — loads rows of the
  // referenced entity's own /get as dropdown options, value = row[valueField],
  // label = row[labelField].
  //
  // Cascading filtering is applied ONLY where the referenced entity's own
  // real .../get request schema documents a matching filter field (confirmed
  // directly from the live spec, entity by entity — see the Phase 2 report's
  // own verification note). Every master-data GetRequest (State/City/
  // Postalcode/Area/Site/Branch/etc.) was checked and documents ONLY
  // {id, searchText, isActive} — no parent-id filter exists server-side for
  // any of them, so those dropdowns deliberately stay un-cascaded (loading
  // all rows) rather than inventing an unsupported parameter. The admin menu
  // hierarchy IS documented with real parent-id filters (MainMenuGetRequest.
  // softwareId, VerticalMenuGetRequest.softwareId/mainMenuId) and those ARE
  // wired up via filterParams below.
  //
  // filterParams maps a real request field name on the referenced entity's
  // own GetRequest schema -> the key of another field in THIS SAME form
  // whose current value supplies it. When present, options are not loaded
  // until every driving field has a value, and reload whenever any of them
  // changes.
  optionsSource?: { apiBasePath: string; valueField: string; labelField: string; filterParams?: Record<string, string> };
  // Opts a single field out of the Add/Edit dialog's default two-column
  // grid (see master-form-dialog.component.html's own comment) to span
  // the full dialog width instead — for a field that genuinely benefits
  // from more horizontal room (free-text remarks/description) rather than
  // being squeezed into a half-width cell next to whatever happens to
  // follow it in formFields order. Optional, defaults to false; every
  // existing config is unaffected without this.
  fullRow?: boolean;
}

export interface MasterColumn {
  key: string;
  label: string;
  // Renders the cell as a checkmark/empty-box indicator instead of raw
  // text — for a real boolean field (e.g. Country's own hasState/hasCity/
  // isActive), matching how the reference screenshots show these columns.
  boolean?: boolean;
  // Resolves this column's displayed value from a REAL foreign-key id
  // already on the row (e.g. an Area row's own countryId) by looking it up
  // in another master entity's own /get response — confirmed against the
  // live spec that Area/Postalcode/City/State's own request/response
  // schemas carry ONLY the parent id (countryId/stateId/cityId), never a
  // denormalized countryName/stateName/cityName, so a column like "Country
  // Name" has to be resolved client-side the same way a dependent dropdown
  // already is in master-form-dialog.component.ts's own optionsSource
  // loading — never a fabricated/guessed field on the row itself.
  // fromField = this row's own foreign-key field (e.g. "countryId");
  // toField = the REFERENCED entity's own real primary-key field name
  // (e.g. Country's own "countryId" — explicit, not inferred, since every
  // master entity's own id field name is already known from the live spec).
  resolveFrom?: { apiBasePath: string; fromField: string; toField: string; labelField: string };
  // Explicit column width (any CSS width value, e.g. '90px') instead of the
  // default content-driven auto width — for a table whose own real columns
  // vary a lot in natural length (e.g. Sub Menu's own Code vs. Menu URL),
  // matching the reference app's own compact/medium/wide column proportions
  // rather than letting every column grow or shrink purely by its content.
  // Optional; every existing entity without it keeps today's auto-sizing.
  width?: string;
  // Renders this cell's value in a single-line, ellipsis-truncated span
  // with a native title attribute (the full value, as a plain browser
  // tooltip — no new UI library) instead of the default whitespace-nowrap
  // cell, which would otherwise force the column (and the whole table) to
  // grow to fit the longest value — for a column whose real values can be
  // long (e.g. Sub Menu's own Menu URL). Optional; every other column is
  // unaffected without it.
  truncate?: boolean;
}

// An extra, entity-specific toolbar filter dropdown — a REAL server-side
// filter param (confirmed per-entity against the live GetRequest schema,
// same evidence bar as optionsSource.filterParams above), not a client-side
// re-filter of the already-fetched set the way activeFilter is. Requires
// an actual /get call with this param set, so it only applies when the
// user clicks Find/Refresh (or presses Enter in search) — same "commit,
// don't live-filter" convention the search box itself already uses.
// Optional; every entity without it is completely unaffected.
export interface MasterExtraFilter {
  key: string; // the real GetRequest field name, e.g. "softwareId"
  label: string; // e.g. "Software" — also drives the "All {label}" default option
  apiBasePath: string; // where to load this dropdown's own options from
  valueField: string;
  labelField: string;
}

export interface MasterEntityConfig<TRow extends Record<string, unknown> = Record<string, unknown>> {
  entityLabel: string; // "Country"
  entityLabelPlural: string; // "Countries"
  // e.g. "master/country" — every action below is {apiBasePath}/{add|edit|delete|get|history/get}
  apiBasePath: string;
  idField: string; // e.g. "countryId" — the row's own primary key field
  extraFilters?: MasterExtraFilter[];
  // Where extraFilters render in the toolbar — 'after-find' (the default,
  // every existing entity's own current position, e.g. Vertical Menu/Sub
  // Menu's own Software/Main Menu) or 'before-search' (Role Master's own
  // Software dropdown, which the reference app places before the search
  // box). Optional; omitting it keeps today's after-find position.
  extraFiltersPosition?: 'before-search' | 'after-find';
  // A second, entity-specific navigation button in the same rights-gated
  // group as Edit/Delete/View History (e.g. Role Master's own "Role Rights"
  // button) — enabled only when a row is selected, like those three.
  // Navigates to targetRoute with the selected row's own idField value as a
  // query param named queryParamKey; the target screen (if it declares a
  // matching extraFilters entry of that same key) picks that param up as
  // its own initial filter value — see master-list.component.ts's own
  // constructor comment. Optional; every entity without it is unaffected.
  secondaryAction?: { label: string; icon: string; targetRoute: string; queryParamKey: string };
  // Overrides the page header badge's icon (an app-icon name, see icon-map.ts)
  // instead of the live backend iconName normally looked up for this route
  // (MenuService.findIconForRoute — see master-list.component.ts's own
  // headerIcon comment). Only needed where that real menu leaf's own
  // iconName doesn't map to a known icon and falls back to a blank circle
  // glyph — optional, every other entity is unaffected without this.
  headerIconOverride?: string;
  columns: MasterColumn[]; // list table columns
  formFields: MasterFormField[]; // add/edit dialog fields, in order
  historyColumns: MasterColumn[]; // history dialog columns
  // Builds the delete request body. Every /delete endpoint's own exact
  // field name is NOT uniform across entities (confirmed per-entity from
  // the spec as each is implemented) — supplied per entity rather than
  // assumed.
  buildDeleteRequest: (row: TRow) => Record<string, unknown>;
  // Builds the /get (search) request body. CONFIRMED LIVE (real backend,
  // real account, 2026-10-17): /delete is a soft delete — it sets the row's
  // own isActive to false rather than removing it (confirmed by deleting a
  // real test row via the live UI and re-querying it with isActive: null
  // afterward: still returned, now isActive: false).
  //
  // Every entity here passes isActive: null (fetch the full set, active +
  // inactive) in ONE request — MasterListComponent itself then filters to
  // active-only for the visible table, so Delete still visibly removes a
  // row from it, matching the ordinary meaning of "delete" — see
  // master-list.component.ts's own comment.
  // extraFilterValues — current value per extraFilters[].key (empty string
  // for "All"), only ever populated when extraFilters is actually declared;
  // every existing single-param implementation stays valid as-is (JS/TS
  // both allow a callback to declare fewer params than its type permits).
  buildListRequest: (searchText: string, extraFilterValues?: Record<string, string>) => Record<string, unknown>;
  // Builds the /history/get request body from the row being inspected.
  buildHistoryRequest: (row: TRow) => Record<string, unknown>;
  // /history/get is normally a REAL typed response (confirmed camelCase for
  // every entity checked so far — see pascal-case.util.ts's own comment),
  // unlike the untyped `/get` family. Email Setting is the one entity so
  // far that's untyped end-to-end (its own /get is ALSO raw PascalCase —
  // see emailsetting.config.ts), and its /history/get was CONFIRMED LIVE
  // (real backend, real account, 2026-11-11) to come back the same way
  // (`EmailSettingHistoryId`, `ActionType`, `ActionBy`, …) — without this,
  // MasterViewHistoryDialogComponent's History Data tab silently rendered
  // zero populated cells despite a correct "N history record(s)" count.
  // Optional; every other entity (genuinely typed/camelCase) is unaffected.
  historyRowsArePascalCase?: boolean;
}
