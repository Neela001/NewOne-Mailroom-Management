// Per-tile gradient accent class names — see app-launcher.component.scss's
// own .tile-accent--* rules for the actual gradient/shadow each one
// renders. Deliberately kept OUT of core/models/application.model.ts and
// mock-applications.data.ts: a tile's color is a presentation concern this
// component owns, not a field the real future Software API would ever
// need to supply — swapping ApplicationLauncherService's mock data for a
// real API call still works unchanged, including for an id this map
// doesn't know (ACCENT_PALETTE's own hashed fallback in the component).
export const ID_ACCENT_MAP: Record<string, string> = {
  mailroom: 'tile-accent--blue',
  dashboard: 'tile-accent--indigo',
  hrms: 'tile-accent--violet',
  'asset-management': 'tile-accent--teal',
  'visitor-management': 'tile-accent--emerald',
  reports: 'tile-accent--orange',
  administration: 'tile-accent--slate',
  other: 'tile-accent--multicolor',
};

export const ACCENT_PALETTE = [
  'tile-accent--blue',
  'tile-accent--indigo',
  'tile-accent--violet',
  'tile-accent--teal',
  'tile-accent--emerald',
  'tile-accent--orange',
  'tile-accent--slate',
];
