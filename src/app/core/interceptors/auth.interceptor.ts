import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

// Attaches `Authorization: Bearer <token>` whenever a token exists —
// matches the spec's own security scheme (components.securitySchemes.Bearer,
// scheme: "bearer", bearerFormat: "JWT"). Deliberately conditional, not
// unconditional: login/captcha are called before any token exists, and
// just omitting the header for those requests is simpler and safer than
// trying to special-case their URLs here.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getAccessToken();

  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
