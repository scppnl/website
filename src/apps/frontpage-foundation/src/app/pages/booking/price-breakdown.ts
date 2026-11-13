import { Component, input, output } from '@angular/core';
import { countLabel, Quote } from '../../booking/price';
import { bookingPage, formatEuro } from '../../content/site-content';
import { Icon } from '../../shared/icon/icon';

/** The rows of a price calculation: rent, the headline amount and a tip to rent both buildings. */
@Component({
  selector: 'app-price-breakdown',
  imports: [Icon],
  styleUrl: './price-breakdown.scss',
  template: `
    @let q = quote();
    @if (q) {
      <div class="price-row">
        <span class="price-row__label">
          <strong>{{ q.option.label }}</strong>
          <span>{{ countLabel(q.count) }} × {{ formatEuro(q.option.amount, true) }}</span>
        </span>
        <span class="price-row__amount">{{ formatEuro(q.rent, true) }}</span>
      </div>
      <div class="price-row price-row--muted">
        <span>{{ content.includedLabel }}</span>
        <span>{{ content.includedValue }}</span>
      </div>

      <div class="price-total">
        <strong>{{ content.rentTitle }}</strong>
        <span class="price-total__amount">{{ formatEuro(q.rent, true) }}</span>
      </div>
      <p class="price-note">
        <app-icon name="shield" [size]="18" />
        <span>{{ content.fullAmountNote }}</span>
      </p>

      @if (upgrade(); as extra) {
        <p class="price-note price-note--upsell">
          <app-icon name="tag" [size]="18" />
          <span>
            Voor {{ formatEuro(extra, true) }} {{ content.upsellSuffix }}
            <button type="button" class="link-button" (click)="bundle.emit()">
              {{ content.upsellAction }}
            </button>
          </span>
        </p>
      }
    } @else {
      <div class="price-total">
        <strong>{{ content.rentTitle }}</strong>
        <span class="price-total__amount price-total__amount--empty">€ –</span>
      </div>
      <p class="price-hint">{{ emptyHint() }}</p>
    }
  `,
})
export class PriceBreakdown {
  /** `null` until a building and at least one dagdeel are chosen. */
  readonly quote = input<Quote | null>(null);
  /** Extra cost per dagdeel of renting both buildings; `null` when that is not on offer. */
  readonly upgrade = input<number | null>(null);
  readonly emptyHint = input('');
  /** The renter wants to switch to both buildings. */
  readonly bundle = output<void>();

  protected readonly content = bookingPage.price;
  protected readonly formatEuro = formatEuro;
  protected readonly countLabel = countLabel;
}
