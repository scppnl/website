import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { foundation } from './content/site-content';

/**
 * Appends the foundation name to every page title, mirrors `data.description` into the meta
 * description and sets or removes the robots meta tag from `data.robots`.
 */
@Injectable({ providedIn: 'root' })
export class SeoTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const pageTitle = this.buildTitle(snapshot);
    this.title.setTitle(pageTitle ? `${pageTitle} | ${foundation.name}` : foundation.name);

    let route: ActivatedRouteSnapshot = snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    const description = route.data['description'];
    if (typeof description === 'string') {
      this.meta.updateTag({ name: 'description', content: description });
    }

    const robots = route.data['robots'];
    if (typeof robots === 'string') {
      this.meta.updateTag({ name: 'robots', content: robots });
    } else {
      this.meta.removeTag('name="robots"');
    }
  }
}
