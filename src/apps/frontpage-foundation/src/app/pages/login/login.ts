import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AUTH_API_BASE_URL } from '../../auth/auth-api-config';
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
  protected readonly signInUrl = signInUrl(inject(AUTH_API_BASE_URL));
}
