import { afterNextRender, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AUTH_API_BASE_URL } from '../../auth/auth-api-config';
import { AuthSession } from '../../auth/auth-session';
import { AuthSessionService } from '../../auth/auth-session.service';
import { signInUrl } from '../../auth/sign-in-url';
import { foundation, home, workspaceDomainsText } from '../../content/site-content';
import { GoogleSignInButton } from '../../shared/google-sign-in-button/google-sign-in-button';
import { Icon } from '../../shared/icon/icon';
import { Logo } from '../../shared/logo/logo';
import { Photo } from '../../shared/photo/photo';

@Component({
  selector: 'app-login',
  imports: [RouterLink, GoogleSignInButton, Icon, Logo, Photo],
  styleUrl: './login.scss',
  templateUrl: './login.html',
})
export class Login {
  protected readonly foundation = foundation;
  protected readonly photo = home.heroPhoto;
  protected readonly domains = workspaceDomainsText;
  private readonly authSession = inject(AuthSessionService);
  private readonly authApiBaseUrl = inject(AUTH_API_BASE_URL);

  protected readonly signInUrl = signInUrl(this.authApiBaseUrl);
  protected readonly switchAccountUrl = signInUrl(this.authApiBaseUrl, { selectAccount: true });

  /** Who is signed in, or `null`. Only known in the browser: the page itself is prerendered. */
  protected readonly session = signal<AuthSession | null>(null);
  protected readonly signingOut = signal(false);
  protected readonly signOutFailed = signal(false);
  protected readonly signedOut = signal(false);

  constructor() {
    afterNextRender(async () => this.session.set(await this.authSession.current()));
  }

  protected async signOut(): Promise<void> {
    this.signingOut.set(true);
    this.signOutFailed.set(false);
    try {
      await this.authSession.signOut();
      this.session.set(null);
      this.signedOut.set(true);
    } catch {
      this.signOutFailed.set(true);
    } finally {
      this.signingOut.set(false);
    }
  }
}
