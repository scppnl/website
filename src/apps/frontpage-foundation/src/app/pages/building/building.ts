import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { buildingPage, type GalleryPhoto } from '../../content/site-content';
import { CtaBanner } from '../../shared/cta-banner/cta-banner';
import { Icon } from '../../shared/icon/icon';
import { PageHeader } from '../../shared/page-header/page-header';
import { Photo } from '../../shared/photo/photo';
import { PhotoLightbox } from '../../shared/photo-lightbox/photo-lightbox';

@Component({
  selector: 'app-building',
  imports: [RouterLink, PageHeader,Photo, PhotoLightbox, CtaBanner, Icon],
  styleUrl: './building.scss',
  templateUrl: './building.html',
})
export class Building {
  protected readonly content = buildingPage;

  protected gallerySizes(photo: GalleryPhoto): string {
    return photo.span === 2
      ? '(min-width: 75rem) 760px, (min-width: 64rem) calc(66vw - 60px), calc(100vw - 40px)'
      : '(min-width: 75rem) 370px, (min-width: 64rem) calc(33vw - 40px), (min-width: 35.5rem) 50vw, calc(100vw - 40px)';
  }
}
