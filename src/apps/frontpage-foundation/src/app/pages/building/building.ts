import { Component } from '@angular/core';
import { buildingPage } from '../../content/site-content';
import { CtaBanner } from '../../shared/cta-banner/cta-banner';
import { PageHeader } from '../../shared/page-header/page-header';
import { Photo } from '../../shared/photo/photo';

@Component({
  selector: 'app-building',
  imports: [PageHeader, Photo, CtaBanner],
  styleUrl: './building.scss',
  templateUrl: './building.html',
})
export class Building {
  protected readonly content = buildingPage;
  protected roomPhotoSizes(count: number): string {
    const desktop =
      count === 4
        ? '(min-width: 76rem) 206px, (min-width: 75rem) calc((100vw - 392px) / 4), (min-width: 64rem) calc(50vw - 106px), '
        : '(min-width: 76rem) 305px, (min-width: 64rem) calc((100vw - 302px) / 3), ';
    const intermediate = count === 4 ? '' : '(min-width: 53rem) calc((100vw - 230px) / 3), ';
    return desktop + intermediate + '(min-width: 35.5rem) calc(50vw - 78px), calc(100vw - 82px)';
  }
}
