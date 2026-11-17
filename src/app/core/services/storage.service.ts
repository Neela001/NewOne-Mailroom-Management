import { Injectable } from '@angular/core';
import { StorageKey } from '../models/storage-key.enum';

// Thin sessionStorage wrapper (JSON in/out) — see storage-key.enum.ts's own
// comment for why this is plain, not encrypted, unlike the reference
// project's StorageService.
@Injectable({ providedIn: 'root' })
export class StorageService {
  set<T>(key: StorageKey, value: T): void {
    sessionStorage.setItem(key, JSON.stringify(value));
  }

  get<T>(key: StorageKey): T | null {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  remove(key: StorageKey): void {
    sessionStorage.removeItem(key);
  }

  clear(): void {
    sessionStorage.clear();
  }
}
