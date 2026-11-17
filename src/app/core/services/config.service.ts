import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

interface AppConfig {
  apiUrl: string;
  name?: string;
}

// Runtime-resolved API base URL (assets/config.json, loaded before bootstrap
// — see provideAppInitializer in app.config.ts), not a build-time
// environment.ts constant. This lets the same build target a different API
// host without a rebuild, and matches the reference project's own pattern
// for the identical reason (see its config.service.ts).
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config: AppConfig | undefined;

  constructor(private http: HttpClient) {}

  async loadConfig(): Promise<void> {
    try {
      this.config = await firstValueFrom(this.http.get<AppConfig>('assets/config.json'));
    } catch (error) {
      console.error('Error loading configuration file:', error);
    }
  }

  getApiUrl(): string {
    return this.config?.apiUrl ?? '';
  }

  getAppName(): string {
    return this.config?.name ?? 'NewOne';
  }
}
