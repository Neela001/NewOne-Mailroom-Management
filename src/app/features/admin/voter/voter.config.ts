import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Dedicated — not MasterListComponent-driven — see voter-list.component.ts's
// own comment for why (exact Windows-reference column/filter/popup
// structure the generic formFields/columns model has no shape for, plus a
// real Import Voters workflow). Kept and reused ONLY to drive the
// "View / History" action via the existing MasterViewHistoryDialogComponent,
// the same pattern already established for Desk/Email Setting/User/Role
// Rights. VoterRow already carries every real field directly (no bare
// foreign-key ids needing resolveFrom) — View Data reads them as-is.
const GENDER_OPTIONS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];

export const VOTER_CONFIG: MasterEntityConfig = {
  entityLabel: 'Voter',
  entityLabelPlural: 'Voters',
  apiBasePath: 'master/voter-record',
  idField: 'voterRecordId',
  columns: [],
  formFields: [
    { key: 'wardNo', label: 'Ward No', type: 'text' },
    { key: 'boothNo', label: 'Booth No', type: 'text' },
    { key: 'serialNumber', label: 'Serial Number', type: 'text' },
    { key: 'voterId', label: 'Voter ID', type: 'text' },
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'relationType', label: 'Relation Type', type: 'text' },
    { key: 'relativeName', label: 'Relative Name', type: 'text' },
    { key: 'houseNumber', label: 'House Number', type: 'text' },
    { key: 'age', label: 'Age', type: 'text' },
    { key: 'gender', label: 'Gender', type: 'select', options: GENDER_OPTIONS },
    { key: 'isActive', label: 'Active', type: 'boolean' },
  ],
  // CONFIRMED LIVE: master/voter-record/history/get is a real typed,
  // already-camelCase response (unlike Desk/Email Setting's own history)
  // — no historyRowsArePascalCase flag needed here.
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'wardNo', label: 'Ward No' },
    { key: 'boothNo', label: 'Booth No' },
    { key: 'voterId', label: 'Voter ID' },
    { key: 'name', label: 'Name' },
    { key: 'relationType', label: 'Relation' },
    { key: 'relativeName', label: 'Relative Name' },
    { key: 'houseNumber', label: 'House No' },
    { key: 'age', label: 'Age' },
    { key: 'gender', label: 'Gender' },
    { key: 'isActive', label: 'Active', boolean: true },
  ],
  buildDeleteRequest: (row) => ({ voterRecordId: row['voterRecordId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ voterRecordId: row['voterRecordId'] }),
};
