import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { home } from '../../content/site-content';
import { CtaBanner } from '../../shared/cta-banner/cta-banner';
import { Photo } from '../../shared/photo/photo';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Photo, CtaBanner],
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home {
  protected readonly content = home;
}
