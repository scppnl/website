import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TURNSTILE_SITE_KEY, TurnstileApi, TurnstileLoader } from './turnstile-loader';

@Component({
  selector: 'app-turnstile',
  standalone: true,
  template: `
    <div #container></div>
    @if (failed()) {
      <p role="alert">De beveiligingscontrole is niet gelukt. Uw gegevens zijn bewaard.</p>
      <button type="button" (click)="retry()">Beveiligingscontrole opnieuw proberen</button>
    } @else if (!verified()) {
      <p role="status">Beveiligingscontrole wordt uitgevoerd…</p>
    }
  `,
})
export class TurnstileWidget implements OnDestroy {
  readonly sitekey = input(inject(TURNSTILE_SITE_KEY));
  readonly action = input('contact');
  readonly tokenChange = output<string | null>();
  protected readonly failed = signal(false);
  protected readonly verified = signal(false);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly loader = inject(TurnstileLoader);
  private api?: TurnstileApi;
  private widgetId?: string;
  private destroyed = false;

  constructor() {
    afterNextRender(() => {
      void this.start();
    });
  }

  private clear(): void {
    this.verified.set(false);
    this.tokenChange.emit(null);
  }

  private async start(): Promise<void> {
    this.failed.set(false);
    this.clear();
    try {
      const api = await this.loader.load();
      if (this.destroyed) return;
      this.api = api;
      this.widgetId = api.render(this.container().nativeElement, {
        sitekey: this.sitekey(),
        action: this.action(),
        appearance: 'interaction-only',
        callback: (token) => {
          if (this.destroyed) return;
          this.failed.set(false);
          this.verified.set(true);
          this.tokenChange.emit(token);
        },
        'expired-callback': () => {
          if (!this.destroyed) this.clear();
        },
        'error-callback': () => {
          if (!this.destroyed) {
            this.clear();
            this.failed.set(true);
          }
          return true;
        },
        'timeout-callback': () => {
          if (!this.destroyed) {
            this.clear();
            this.failed.set(true);
          }
        },
      });
    } catch {
      if (!this.destroyed) {
        this.clear();
        this.failed.set(true);
      }
    }
  }

  reset(): void {
    this.clear();
    this.failed.set(false);
    if (this.api && this.widgetId !== undefined) {
      try {
        this.api.reset(this.widgetId);
      } catch {
        this.failed.set(true);
      }
    }
  }

  protected retry(): void {
    if (this.widgetId !== undefined) this.reset();
    else void this.start();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.widgetId !== undefined) this.api?.remove(this.widgetId);
  }
}
