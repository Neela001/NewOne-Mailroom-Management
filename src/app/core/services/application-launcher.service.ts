import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Application } from '../models/application.model';
import { MOCK_APPLICATIONS } from '../data/mock-applications.data';

// The ONE place AppLauncherComponent gets its application list from — kept
// as its own service, separate from the component and from the mock data
// file itself, specifically so the real Software API can replace the
// of(MOCK_APPLICATIONS) body below with a real ApiService call (returning
// the same Application[] shape) later without AppLauncherComponent itself
// changing at all. Not a fake API endpoint — this never touches HTTP.
@Injectable({ providedIn: 'root' })
export class ApplicationLauncherService {
  getApplications(): Observable<Application[]> {
    return of(MOCK_APPLICATIONS);
  }
}
