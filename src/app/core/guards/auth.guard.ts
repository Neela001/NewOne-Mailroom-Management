import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Session check for every route under the shell. Redirects silently to
// /login when there's no token — no confirm/alert popup. This is a
// deliberate, confirmed design choice from day one here, not a retrofit:
// the reference project shipped with an "Unauthorized Access" popup on
// this exact check and had to have it removed after it was reported as a
// jarring first impression on a plain unauthenticated visit to the base
// URL (that popup fired before the user ever saw the login page). Same
// root cause would exist here if this guard showed one too, so it never
// did.
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  return true;
};
