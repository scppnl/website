import { NgTemplateOutlet } from '@angular/common';
import { Component } from '@angular/core';
import { formatEuro, ratesPage, rentalOptions } from '../../content/site-content';
import { CopyText } from '../../shared/copy/copy';
import { CtaBanner } from '../../shared/cta-banner/cta-banner';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';

@Component({
  selector: 'app-rates',
  imports: [PageHeader, CtaBanner, Icon, CopyText, NgTemplateOutlet],
  styleUrl: './rates.scss',
  templateUrl: './rates.html',
})
export class Rates {
  protected readonly content = ratesPage;
  protected readonly options = rentalOptions;
  protected readonly formatEuro = formatEuro;
}
