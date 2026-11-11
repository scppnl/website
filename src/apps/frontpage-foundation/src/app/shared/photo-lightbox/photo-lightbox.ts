import { Component, ElementRef, input, viewChild } from '@angular/core';
import { Icon } from '../icon/icon';
import { Photo } from '../photo/photo';

/**
 * A captioned photo with a "Vergroot foto" button that opens the large version in a native
 * `<dialog>`. The dialog handles Escape and focus return; a click on the backdrop also closes it.
 */
@Component({
  selector: 'app-photo-lightbox',
  imports: [Photo, Icon],
  styleUrl: './photo-lightbox.scss',
  template: `
    <figure>
      <div class="frame">
        <app-photo [src]="src()" [alt]="alt()" [ratio]="ratio()" [sizes]="sizes()" />
        <button
          type="button"
          class="zoom"
          [attr.aria-label]="'Vergroot foto: ' + label()"
          (click)="open()"
        >
          <app-icon name="expand" [size]="20" [strokeWidth]="2.2" />
        </button>
      </div>
      <figcaption>
        <strong>{{ title() }}</strong>
        <span>{{ text() }}</span>
      </figcaption>
    </figure>

    <dialog #dialog class="dialog" [attr.aria-label]="title()" (click)="onDialogClick($event)">
      <img [src]="'/' + src() + '-1600.jpg'" [alt]="alt()" loading="lazy" />
      <p>
        <strong>{{ title() }}</strong> {{ text() }}
      </p>
      <button type="button" class="close" (click)="close()">
        <app-icon name="close" [size]="20" [strokeWidth]="2.2" />
        Sluiten
      </button>
    </dialog>
  `,
})
export class PhotoLightbox {
  /** Path below `public/` without size suffix or extension. */
  readonly src = input.required<string>();
  readonly alt = input.required<string>();
  readonly title = input.required<string>();
  readonly text = input.required<string>();
  /** Lower-case name used in the button label, e.g. "keuken". */
  readonly label = input.required<string>();
  readonly ratio = input('4 / 3');
  readonly sizes = input('(min-width: 64rem) 363px, (min-width: 35.5rem) 50vw, calc(100vw - 40px)');

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected open(): void {
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected onDialogClick(event: MouseEvent): void {
    // Only the backdrop reports the dialog itself as the target.
    if (event.target === this.dialog().nativeElement) this.close();
  }
}
