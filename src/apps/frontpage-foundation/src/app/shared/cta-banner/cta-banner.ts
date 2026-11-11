import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cta-banner',
  imports: [RouterLink],
  styleUrl: './cta-banner.scss',
  template: `
    <section class="cta on-dark">
      <div class="container cta__inner">
        <div class="cta__text">
          <h2>{{ title() }}</h2>
          <p>{{ text() }}</p>
        </div>
        <div class="cta__actions">
          <a class="btn btn--accent" routerLink="/reserveren">Reserveer nu</a>
          @if (secondaryLabel(); as label) {
            <a class="btn btn--on-dark" [routerLink]="secondaryLink()">{{ label }}</a>
          }
        </div>
      </div>
    </section>
  `,
})
export class CtaBanner {
  readonly title = input('Interesse in het clubhuis?');
  readonly text = input('Doe een vrijblijvende aanvraag, dan nemen wij contact met u op.');
  readonly secondaryLabel = input<string | null>(null);
  readonly secondaryLink = input('/contact');
}
