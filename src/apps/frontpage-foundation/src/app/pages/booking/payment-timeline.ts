import { Component, input } from '@angular/core';
import { bookingPage, deposit, formatEuro } from '../../content/site-content';

/** What the renter pays when, and until when cancelling is free. */
@Component({
  selector: 'app-payment-timeline',
  styleUrl: './payment-timeline.scss',
  template: `
    <h2>{{ content.title }}</h2>
    <ol>
      <li>
        <span class="number number--active">1</span>
        <span class="text">
          <strong>{{ content.now.title }}</strong>
          <span>{{ content.now.text }}</span>
        </span>
      </li>
      <li>
        <span class="number">2</span>
        <span class="text">
          <strong>{{ content.confirm.title }}</strong>
          <span>{{ content.confirm.text }}</span>
        </span>
      </li>
      <li>
        <span class="number">3</span>
        <span class="text">
          <strong>{{ content.signed.title }}</strong>
          <span>{{ content.signed.depositLabel }} {{ formatEuro(deposit, true) }}</span>
          @if (rent() !== null) {
            <span>{{ content.signed.rentLabel }} {{ formatEuro(rent()!, true) }}</span>
          }
        </span>
      </li>
      <li>
        <span class="number">4</span>
        <span class="text">
          <strong>{{ content.returned.title }}</strong>
          <span>{{ content.returned.text }}</span>
        </span>
      </li>
    </ol>
    @if (cancelBy(); as deadline) {
      <p class="cancel">
        {{ content.cancelPrefix }} <strong>{{ deadline }}</strong
        >.
      </p>
    }
  `,
})
export class PaymentTimeline {
  /** The rent in euros, once there is a price. */
  readonly rent = input<number | null>(null);
  /** The last day of free cancellation, written out. */
  readonly cancelBy = input<string | null>(null);

  protected readonly content = bookingPage.payment;
  protected readonly deposit = deposit;
  protected readonly formatEuro = formatEuro;
}
