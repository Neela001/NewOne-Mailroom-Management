import { forkJoin, map, Observable, of } from 'rxjs';
import { MasterApiService } from './master-api.service';
import { MasterColumn } from './master-entity-config.model';

export type ColumnLookups = Record<string, Map<unknown, Record<string, unknown>>>;

// Fetches each DISTINCT apiBasePath referenced by a set of resolveFrom
// columns exactly once (e.g. Area's own Country/State/City/Postal Code
// columns all share one master/country, one master/state… fetch, not one
// per column) and builds an id -> row lookup map for each, keyed by the
// referenced entity's own real id field (resolveFrom.toField). Used by
// both the list table and the history table, since both need to resolve
// the same kind of real-but-bare foreign-key id into a display label —
// see master-entity-config.model.ts's own MasterColumn.resolveFrom
// comment for why this can't just read a field already on the row.
export function buildColumnLookups(masterApi: MasterApiService, columns: MasterColumn[]): Observable<ColumnLookups> {
  const resolvers = columns.filter((c) => c.resolveFrom).map((c) => c.resolveFrom!);
  const byPath = new Map(resolvers.map((r) => [r.apiBasePath, r]));
  if (byPath.size === 0) return of({});

  const requests = [...byPath.entries()].map(([path, resolver]) =>
    masterApi.get<Record<string, unknown>, Record<string, unknown>>(path, { searchText: null, isActive: null }).pipe(
      map((rows) => {
        const map_ = new Map<unknown, Record<string, unknown>>();
        for (const row of rows) map_.set(row[resolver.toField], row);
        return [path, map_] as const;
      }),
    ),
  );

  return forkJoin(requests).pipe(map((entries) => Object.fromEntries(entries)));
}

export function resolveColumnValue(row: Record<string, unknown>, column: MasterColumn, lookups: ColumnLookups): unknown {
  if (!column.resolveFrom) return row[column.key];
  const { apiBasePath, fromField, labelField } = column.resolveFrom;
  const relatedRow = lookups[apiBasePath]?.get(row[fromField]);
  return relatedRow ? relatedRow[labelField] : null;
}
