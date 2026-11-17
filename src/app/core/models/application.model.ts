// The app-launcher's own data shape — deliberately exactly the structure
// requested for the eventual real Software API, so swapping
// ApplicationLauncherService's mock implementation for a real HTTP call
// later needs no change to this interface or to AppLauncherComponent,
// which only ever depends on this shape.
export interface Application {
  id: string;
  name: string;
  icon: string; // an app-icon name, see icon-map.ts
  url?: string; // an internal route; omitted when no real screen exists yet
  isActive: boolean;
}
