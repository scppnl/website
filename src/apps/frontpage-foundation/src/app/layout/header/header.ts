import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { foundation, navItems } from '../../content/site-content';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header {
  protected readonly foundation = foundation;
  protected readonly navItems = navItems;
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
