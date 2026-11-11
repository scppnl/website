import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  facilities,
  foundation,
  home,
  rentalOption,
  formatEuro,
  type BuildingCard,
} from '../../content/site-content';
import { CopyText } from '../../shared/copy/copy';
import { CtaBanner } from '../../shared/cta-banner/cta-banner';
import { Icon } from '../../shared/icon/icon';
import { Photo } from '../../shared/photo/photo';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Photo, CtaBanner, Icon, CopyText],
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home {
  protected readonly content = home;
  protected readonly facilities = facilities;
  protected readonly foundation = foundation;

  protected price(card: BuildingCard): string {
    return formatEuro(rentalOption(card.id).amount);
  }
}
