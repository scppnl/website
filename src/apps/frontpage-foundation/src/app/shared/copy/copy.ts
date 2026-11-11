import { Component, computed, input } from '@angular/core';
import type { Copy } from '../../content/site-content';

/**
 * Renders text that has a shorter phone variant. Both variants are in the HTML; the
 * global `.long` / `.short` classes show the right one, so prerendered pages need no JavaScript.
 */
@Component({
  selector: 'app-copy',
  template: `
    @if (differs()) {
      <span class="long">{{ value().long }}</span
      ><span class="short">{{ value().short }}</span>
    } @else {
      {{ value().long }}
    }
  `,
})
export class CopyText {
  readonly value = input.required<Copy>({ alias: 'text' });
  protected readonly differs = computed(() => {
    const { long, short } = this.value();
    return short !== undefined && short !== long;
  });
}
