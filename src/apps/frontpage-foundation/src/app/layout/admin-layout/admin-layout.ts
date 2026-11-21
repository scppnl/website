import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { foundation } from '../../content/site-content';
import { Icon } from '../../shared/icon/icon';
import { Logo } from '../../shared/logo/logo';

/** Header and main content around the management pages. Like the sign-in pages it has no footer. */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Logo],
  styleUrl: './admin-layout.scss',
  template: `
    <header class="header">
      <div class="header__inner">
        <a class="brand" routerLink="/beheer/toegangsaanvragen">
          <app-logo [size]="40" />
          <span class="brand__name">
            <span class="brand__prefix">Stichting · beheer</span>
            <span class="brand__title">{{ brandTitle }}</span>
          </span>
        </a>

        <button
          type="button"
          class="menu-toggle"
          aria-controls="admin-nav"
          [attr.aria-expanded]="menuOpen()"
          [attr.aria-label]="menuOpen() ? 'Menu sluiten' : 'Menu openen'"
          (click)="menuOpen.set(!menuOpen())"
        >
          <app-icon [name]="menuOpen() ? 'close' : 'menu'" [size]="26" [strokeWidth]="2" />
        </button>

        <nav id="admin-nav" class="nav" aria-label="Beheermenu" [class.nav--open]="menuOpen()">
          <a
            routerLink="/beheer/toegangsaanvragen"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            >Toegangsaanvragen</a
          >
          <a routerLink="/">Naar de website</a>
        </nav>
      </div>
    </header>
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
  `,
})
export class AdminLayout {
  protected readonly brandTitle = foundation.name.replace(/^Stichting\s+/, '');
  protected readonly menuOpen = signal(false);

  constructor() {
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationStart) this.menuOpen.set(false);
      });
  }
}
