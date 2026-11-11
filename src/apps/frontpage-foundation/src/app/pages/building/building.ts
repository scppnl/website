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
}
