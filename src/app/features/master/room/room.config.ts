import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's RoomSaveRequest/RoomGetRequest, confirmed
// against a real authenticated master/room/get response (2 live rows).
// RoomHistoryRecord (reflection, D:\NewOne) declares only actionType/
// actionBy/actionDate — no code/name/isActive snapshot fields like its
// sibling entities (Flat/Wing/Floor) carry, so historyColumns stays to
// just those three rather than inventing the usual snapshot columns.
export const ROOM_CONFIG: MasterEntityConfig = {
  entityLabel: 'Room',
  entityLabelPlural: 'Rooms',
  apiBasePath: 'master/room',
  idField: 'roomId',
  columns: [
    { key: 'siteName', label: 'Site' },
    { key: 'buildingName', label: 'Building' },
    { key: 'floorName', label: 'Floor' },
    { key: 'wingName', label: 'Wing' },
    { key: 'flatName', label: 'Flat' },
    { key: 'roomCode', label: 'Code' },
    { key: 'roomName', label: 'Name' },
    { key: 'roomNumber', label: 'Number' },
  ],
  formFields: [
    { key: 'siteId', label: 'Site', type: 'select', required: true, optionsSource: { apiBasePath: 'master/site', valueField: 'siteId', labelField: 'siteName' } },
    { key: 'buildingId', label: 'Building', type: 'select', required: true, optionsSource: { apiBasePath: 'master/building', valueField: 'buildingId', labelField: 'buildingName' } },
    { key: 'floorId', label: 'Floor', type: 'select', required: true, optionsSource: { apiBasePath: 'master/floor', valueField: 'floorId', labelField: 'floorName' } },
    { key: 'wingId', label: 'Wing', type: 'select', required: true, optionsSource: { apiBasePath: 'master/wing', valueField: 'wingId', labelField: 'wingName' } },
    { key: 'flatId', label: 'Flat', type: 'select', optionsSource: { apiBasePath: 'master/flat', valueField: 'flatId', labelField: 'flatName' } },
    { key: 'roomCode', label: 'Room Code', type: 'text', required: true },
    { key: 'roomName', label: 'Room Name', type: 'text', required: true },
    { key: 'roomNumber', label: 'Room Number', type: 'text' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
  ],
  buildDeleteRequest: (row) => ({ roomId: row['roomId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ roomId: row['roomId'] }),
};
