import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { ApiResponse } from '../models/api-response.model';

// Thin wrapper over HttpClient for the new API's own base URL + its uniform
// {success, message, data, traceId} envelope (see api-response.model.ts's
// own comment) — every feature service builds on top of this rather than
// calling HttpClient directly, so the base URL only lives in one place.
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  post<TReq, TRes>(path: string, body: TReq): Observable<ApiResponse<TRes>> {
    return this.http.post<ApiResponse<TRes>>(`${this.config.getApiUrl()}${path}`, body);
  }

  get<TRes>(path: string): Observable<ApiResponse<TRes>> {
    return this.http.get<ApiResponse<TRes>>(`${this.config.getApiUrl()}${path}`);
  }

  // For the handful of endpoints that return a real binary file (not the
  // usual {success, message, data, traceId} envelope) — e.g. Upload
  // Files' own template/result downloads. Filename is NOT recoverable
  // from here: these responses don't send Access-Control-Expose-Headers,
  // so the browser's Fetch/XHR layer withholds Content-Disposition from
  // JS even though the server sets it — confirmed live (see
  // uploadfiles.model.ts's own comment). Callers construct their own
  // filename instead.
  getBlob(path: string): Observable<Blob> {
    return this.http.get(`${this.config.getApiUrl()}${path}`, { responseType: 'blob' });
  }

  // For a multipart submit that wants real upload-progress events (e.g.
  // Upload Files' own admin/uploads/submit with a potentially large Excel
  // file) — emits HttpEventType.UploadProgress events as the body streams,
  // then one HttpEventType.Response event carrying the real
  // ApiResponse<TRes> envelope, same as every other post().
  postMultipartWithProgress<TRes>(path: string, form: FormData): Observable<HttpEvent<ApiResponse<TRes>>> {
    return this.http.post<ApiResponse<TRes>>(`${this.config.getApiUrl()}${path}`, form, { reportProgress: true, observe: 'events' });
  }
}
