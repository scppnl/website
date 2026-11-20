import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AUTH_API_BASE_URL } from '../../auth/auth-api-config';
import { signInUrl } from '../../auth/sign-in-url';
import { foundation, workspaceDomainsText } from '../../content/site-content';
import { GoogleSignInButton } from '../../shared/google-sign-in-button/google-sign-in-button';
import { Icon } from '../../shared/icon/icon';
import { Logo } from '../../shared/logo/logo';

/** Shown after Google sign-in with an account outside the foundation's Workspace. */
@Component({
  selector: 'app-login-denied',
  imports: [RouterLink, GoogleSignInButton, Icon, Logo],
  styleUrl: './login-denied.scss',
  templateUrl: './login-denied.html',
})
export class LoginDenied {
  protected readonly foundation = foundation;
  protected readonly domains = workspaceDomainsText;
  protected readonly retryUrl = signInUrl(inject(AUTH_API_BASE_URL), { selectAccount: true });
}
