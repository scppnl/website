import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { foundation, navItems } from '../../content/site-content';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  styleUrl: './header.scss',
  templateUrl: './header.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class Header {
  protected readonly foundation = foundation;
  protected readonly brandTitle = foundation.name.replace(/^Stichting\s+/, '');
  protected readonly navItems = navItems;
  protected readonly menuOpen = signal(false);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly toggle = viewChild.required<ElementRef<HTMLButtonElement>>('menuToggle');

  constructor() {
    const destroyRef = inject(DestroyRef);
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationStart) this.closeMenu();
      });

    // Browser-only APIs must run after hydration, never during prerendering.
    afterNextRender(() => {
      const desktop = window.matchMedia('(min-width: 75rem)');
      const onBreakpointChange = () => {
        if (desktop.matches) this.closeMenu();
      };
      desktop.addEventListener('change', onBreakpointChange);
      // Use the actual bar height so larger text still leaves the dropdown scrollable.
      const observer = new ResizeObserver(() => {
        this.element.nativeElement.style.setProperty(
          '--header-height',
          `${this.element.nativeElement.getBoundingClientRect().height}px`,
        );
      });
      observer.observe(this.element.nativeElement);
      destroyRef.onDestroy(() => {
        desktop.removeEventListener('change', onBreakpointChange);
        observer.disconnect();
      });
    });
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) this.closeMenu();
  }

  protected onEscape(): void {
    if (!this.menuOpen()) return;
    this.closeMenu();
    this.toggle().nativeElement.focus();
  }

  protected onFocusOut(event: FocusEvent): void {
    if (event.relatedTarget && !this.element.nativeElement.contains(event.relatedTarget as Node)) {
      this.closeMenu();
    }
  }
}
