import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cta-banner',
  imports: [RouterLink],
  styleUrl: './cta-banner.scss',
  template: `
    <section class="cta">
      <div class="container cta__inner">
        <div>
          <h2>Interesse in het clubhuis?</h2>
          <p>Doe een vrijblijvende aanvraag, dan nemen wij contact met u op.</p>
        </div>
        <a class="btn btn--accent" routerLink="/reserveren">Reserveer nu</a>
      </div>
    </section>
  `,
})
export class CtaBanner {}
