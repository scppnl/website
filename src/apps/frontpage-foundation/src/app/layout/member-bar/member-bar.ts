import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { foundation } from '../../content/site-content';
import { Logo } from '../../shared/logo/logo';

/** Slim top bar for the pages outside the public layout that members use: brand and a way back. */
@Component({
  selector: 'app-member-bar',
  imports: [RouterLink, Logo],
  styleUrl: './member-bar.scss',
  template: `
    <header class="bar">
      <div class="container bar__inner">
        <a class="bar__brand" routerLink="/" [attr.aria-label]="foundation.name">
          <app-logo [size]="40" />
          <span class="bar__name">
            <span class="bar__label">{{ label() }}</span>
            <span class="bar__title">Blokhut De Wildert</span>
          </span>
        </a>
        <a class="bar__back" routerLink="/" aria-label="Naar de website">
          <span class="bar__long" aria-hidden="true">Naar de website</span>
          <span class="bar__short" aria-hidden="true">Website</span>
        </a>
      </div>
    </header>
  `,
})
export class MemberBar {
  protected readonly foundation = foundation;
  readonly label = input('Toegang aanvragen');
}
