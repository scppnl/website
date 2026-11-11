import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { foundation, navItems } from '../../content/site-content';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  styleUrl: './footer.scss',
  templateUrl: './footer.html',
})
export class Footer {
  protected readonly foundation = foundation;
  protected readonly navItems = navItems;
  protected readonly year = new Date().getFullYear();
}
