import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="section">
      <div class="container">
        <h1>Pagina niet gevonden</h1>
        <p class="lead">
          Deze pagina bestaat niet (meer). Misschien vindt u hieronder wat u zoekt.
        </p>
        <a class="btn" routerLink="/">Naar de homepage</a>
      </div>
    </section>
  `,
})
export class NotFound {}
