import { Component } from '@angular/core';
import { ratesPage } from '../../content/site-content';
import { CtaBanner } from '../../shared/cta-banner/cta-banner';
import { PageHeader } from '../../shared/page-header/page-header';

@Component({
  selector: 'app-rates',
  imports: [PageHeader, CtaBanner],
  styleUrl: './rates.scss',
  templateUrl: './rates.html',
})
export class Rates {
  protected readonly content = ratesPage;
}
