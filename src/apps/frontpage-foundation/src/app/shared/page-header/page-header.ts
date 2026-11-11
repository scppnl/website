import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  styleUrl: './page-header.scss',
  template: `
    <div class="page-header">
      <div class="container">
        <h1>{{ title() }}</h1>
        <p class="lead">
          <span class="long">{{ lead() }}</span>
          <span class="short">{{ shortLead() ?? lead() }}</span>
        </p>
        <ng-content />
      </div>
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly lead = input.required<string>();
  /** Shorter text for phones. */
  readonly shortLead = input<string | null>(null);
}
