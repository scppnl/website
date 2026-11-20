import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from '../footer/footer';
import { Header } from '../header/header';

/** Header, main content and footer around the public pages. The sign-in pages sit outside it. */
@Component({
  selector: 'app-site-layout',
  imports: [RouterOutlet, Header, Footer],
  styleUrl: './site-layout.scss',
  template: `
    <app-header />
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
    <app-footer />
  `,
})
export class SiteLayout {}
