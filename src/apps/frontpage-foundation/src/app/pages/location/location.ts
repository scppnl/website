import { Component } from '@angular/core';
import { foundation, locationPage } from '../../content/site-content';
import { CtaBanner } from '../../shared/cta-banner/cta-banner';
import { PageHeader } from '../../shared/page-header/page-header';
import { Photo } from '../../shared/photo/photo';

@Component({
  selector: 'app-location',
  imports: [PageHeader, Photo, CtaBanner],
  styleUrl: './location.scss',
  templateUrl: './location.html',
})
export class Location {
  protected readonly foundation = foundation;
  protected readonly content = locationPage;
}
