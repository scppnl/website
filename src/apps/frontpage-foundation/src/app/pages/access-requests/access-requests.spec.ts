import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Meta } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { SeoTitleStrategy } from '../../seo-title-strategy';

/** Lets the service's promises finish, then renders what they changed. */
async function settle(harness: RouterTestingHarness) {
  await new Promise((resolve) => setTimeout(resolve));
  await harness.fixture.whenStable();
  harness.detectChanges();
}

describe('foundation /beheer/toegangsaanvragen page', () => {
  let harness: RouterTestingHarness;
  let page: HTMLElement;

  async function render(url = '/beheer/toegangsaanvragen') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        { provide: TitleStrategy, useClass: SeoTitleStrategy },
      ],
    });
    harness = await RouterTestingHarness.create(url);
    await settle(harness);
    page = harness.routeNativeElement as HTMLElement;
  }

  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const $ = <T extends HTMLElement>(selector: string) => page.querySelector<T>(selector);
  const rows = () => Array.from(page.querySelectorAll<HTMLElement>('app-access-request-row'));
  const caption = () => text($('.list__caption'));
  const url = () => TestBed.inject(Router).url;

  const button = (label: string) =>
    Array.from(page.querySelectorAll<HTMLElement>('button, a')).find((el) =>
      text(el).startsWith(label),
    ) as HTMLElement;
  const tabCount = (label: string) => text(button(label).querySelector('.tab__count'));

  async function click(el: HTMLElement) {
    el.click();
    await settle(harness);
  }

  async function type(selector: string, value: string) {
    const field = $<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await settle(harness);
  }

  async function open(id: string) {
    await harness.navigateByUrl(`/beheer/toegangsaanvragen?aanvraag=${id}`);
    await settle(harness);
  }

  const submit = () => click($<HTMLButtonElement>('button[type="submit"]')!);

  it('is prerenderable: the heading is there before any data, and the page is not indexed', async () => {
    await render();
    expect(text($('h1'))).toBe('Toegangsaanvragen');
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex');
  });

  it('lists the open requests first, soonest start on top, with a count per status', async () => {
    await render();

    expect(caption()).toBe('6 openstaande aanvragen, eerstvolgende starttijd bovenaan');
    expect(rows()).toHaveLength(6);
    expect(text(rows()[0])).toContain('Daan Smit');
    expect(tabCount('Openstaand')).toBe('6');
    expect(tabCount('Goedgekeurd')).toBe('3');
    expect(tabCount('Afgewezen')).toBe('1');
    expect(tabCount('Alle')).toBe('10');
    expect(button('Openstaand').getAttribute('aria-pressed')).toBe('true');
  });

  it('shows who has more open requests, and an address without a name', async () => {
    await render();
    const list = text($('.list'));
    expect(list).toContain('3 aanvragen van Mila');
    expect(list).toContain('Alle sloten');
    expect(list).toContain('materiaalmeester@scpp.nl');
    expect(list).toContain('Naam niet gevonden');
  });

  it('switches status', async () => {
    await render();
    await click(button('Goedgekeurd'));

    expect(caption()).toBe('3 goedgekeurde aanvragen');
    expect(rows().map((row) => text(row))[0]).toContain('Wouter Bos');
    expect(button('Goedgekeurd').getAttribute('aria-pressed')).toBe('true');
  });

  it('searches and filters on a lock, and explains an empty result', async () => {
    await render();
    await click(button('Alle'));

    await type('input[type="search"]', 'mila');
    expect(rows()).toHaveLength(3);

    await type('input[type="search"]', 'bestaat niet');
    expect(rows()).toHaveLength(0);
    expect(text($('.empty'))).toContain('Geen aanvragen gevonden');

    await type('input[type="search"]', '');
    const select = $<HTMLSelectElement>('select')!;
    select.value = 'Voordeur kleine gebouw';
    select.dispatchEvent(new Event('change'));
    await settle(harness);
    // Requests for every lock match any lock; Daan only asks for the warehouse doors.
    const names = rows().map((row) => text(row));
    expect(names).toHaveLength(5);
    expect(names.join(' ')).toContain('Lotte Jansen');
    expect(names.join(' ')).toContain('Wouter Bos');
    expect(names.join(' ')).not.toContain('Daan Smit');
  });

  it('says everything is done when no request is open', async () => {
    await render();
    await open('d1');
    for (const id of ['d1', 'd2', 'd3', 'm1', 'm2', 'm3']) {
      await open(id);
      await click(button('Goedkeuren'));
      await submit();
    }
    await click(button('Openstaand'));
    expect(text($('.empty'))).toContain('Alles is afgehandeld');
  });

  it('opens a request through its link and shows it in the address', async () => {
    await render();
    expect($('.detail__empty')).toBeTruthy();

    await click(rows()[0].querySelector('a')!);

    expect(url()).toContain('aanvraag=d1');
    expect(text($('app-access-request-panel h2'))).toBe('Daan Smit');
    expect(rows()[0].querySelector('a')!.getAttribute('aria-current')).toBe('true');
  });

  it('opens the request named in the address and ignores an unknown one', async () => {
    await render('/beheer/toegangsaanvragen?aanvraag=m2');
    expect(text($('app-access-request-panel h2'))).toBe('Mila Koster');

    await open('onbekend');
    expect($('app-access-request-panel')).toBeNull();
    expect($('.detail__empty')).toBeTruthy();
  });

  it('shows the details, and who else has access in the same period', async () => {
    await render('/beheer/toegangsaanvragen?aanvraag=m2');
    const panel = text($('app-access-request-panel'));

    expect(panel).toContain('Aanvraag beoordelen');
    expect(panel).toContain('Sloten · alle vier');
    expect(panel).toContain('Winterkamp welpen.');
    expect(panel).toContain('Ook toegang in deze periode');
    expect(panel).toContain('Wouter Bos');
  });

  it('needs a choice before it saves', async () => {
    await render('/beheer/toegangsaanvragen?aanvraag=d1');
    await submit();

    expect(text($('[role="alert"]'))).toContain('Kies eerst of je de aanvraag goedkeurt of afwijst.');
    expect($('.toast')).toBeNull();
  });

  it('needs an explanation for a rejection, but not for an approval', async () => {
    await render('/beheer/toegangsaanvragen?aanvraag=d1');
    await click(button('Afwijzen'));
    expect(text($('label[for="decision-comment"]'))).toContain('(verplicht)');
    await submit();

    expect(text($('[role="alert"]'))).toContain('Geef een toelichting bij een afwijzing.');
    expect($('#decision-comment')!.getAttribute('aria-invalid')).toBe('true');
    expect($('.toast')).toBeNull();

    await type('#decision-comment', 'Het magazijn is dan dicht.');
    expect($('[role="alert"]')).toBeNull();

    await click(button('Goedkeuren'));
    await type('#decision-comment', '');
    expect(text($('label[for="decision-comment"]'))).toContain('(optioneel)');
    await submit();
    expect($('.toast')).toBeTruthy();
  });

  it('rejects a whole series at once and can undo it', async () => {
    await render('/beheer/toegangsaanvragen?aanvraag=m2');
    await click(button('Afwijzen'));

    const series = $<HTMLInputElement>('.series input[type="checkbox"]')!;
    expect(text($('.series'))).toContain('Ook de 2 andere openstaande aanvragen van Mila afwijzen');
    expect(text($('button[type="submit"]'))).toBe('Afwijzen en opslaan');
    series.click();
    await settle(harness);
    expect(text($('button[type="submit"]'))).toBe('Afwijzen (3) en opslaan');

    await type('#decision-comment', 'Het hele weekend is verhuurd.');
    await submit();

    expect(text($('.toast'))).toContain('3 aanvragen van Mila Koster afgewezen.');
    // The example data e-mails nobody, and the page must not claim otherwise.
    expect(text($('.toast'))).toContain('Er is geen e-mail verstuurd: dit zijn voorbeeldgegevens.');
    expect(text($('.toast'))).not.toContain('krijgt');
    expect(text($('app-access-request-panel'))).toContain('e-mail niet verstuurd (voorbeeld)');
    expect(text($('app-access-request-panel'))).not.toContain('e-mail verstuurd ');
    expect(tabCount('Openstaand')).toBe('3');
    expect(tabCount('Afgewezen')).toBe('4');
    expect(text($('app-access-request-panel'))).toContain('Afgewezen door');
    expect(text($('app-access-request-panel'))).toContain('Het hele weekend is verhuurd.');

    await click(button('Ongedaan maken'));
    expect($('.toast')).toBeNull();
    expect(tabCount('Openstaand')).toBe('6');
    expect(tabCount('Afgewezen')).toBe('1');
    expect(url()).toContain('aanvraag=m2');
  });

  it('keeps the e-mail out of the toast when none is sent', async () => {
    await render('/beheer/toegangsaanvragen?aanvraag=d1');
    await click(button('Goedkeuren'));
    $<HTMLInputElement>('.check--plain input')!.click();
    await settle(harness);
    await submit();

    expect(text($('.toast'))).toContain('Aanvraag van Daan Smit goedgekeurd.');
    expect(text($('.toast'))).toContain('Er is geen e-mail verstuurd.');
  });

  it('asks nothing about a name it does not have', async () => {
    await render('/beheer/toegangsaanvragen?aanvraag=d3');

    expect(text($('app-access-request-panel h2'))).toBe('materiaalmeester@scpp.nl');
    expect(text($('app-access-request-panel'))).toContain('Bij dit e-mailadres is geen naam gevonden.');
    expect(text($('.check--plain'))).toBe('Stuur de aanvrager een e-mail met het besluit en de toelichting');
  });

  it('shows a decided request as a record, and lets the decision be reconsidered', async () => {
    await render('/beheer/toegangsaanvragen?aanvraag=a1');
    const panel = () => text($('app-access-request-panel'));

    expect(panel()).toContain('Goedgekeurd door Karin Willems');
    expect(panel()).toContain('Akkoord. Wil je na afloop de verwarming terugzetten');
    expect(panel()).toContain('Ingediend via het formulier');
    expect($('form')).toBeNull();

    await click(button('Besluit herzien'));
    expect(panel()).toContain('Besluit herzien');
    expect($<HTMLTextAreaElement>('#decision-comment')!.value).toContain('Akkoord.');
    expect(button('Goedkeuren').getAttribute('aria-pressed')).toBe('true');

    await click(button('Annuleren'));
    expect($('form')).toBeNull();

    await click(button('Besluit herzien'));
    await click(button('Afwijzen'));
    await type('#decision-comment', 'De vergadering is verplaatst.');
    await submit();
    expect(panel()).toContain('Afgewezen door');
    expect(panel()).toContain('Herzien naar afgewezen door');
  });

  it('says so when a decision came without explanation', async () => {
    await render('/beheer/toegangsaanvragen?aanvraag=a3');
    expect(text($('app-access-request-panel'))).toContain('Geen toelichting gegeven.');
  });

  it('continues with the next open request', async () => {
    await render('/beheer/toegangsaanvragen?aanvraag=x1');
    await click(button('Volgende openstaande'));

    expect(url()).toContain('aanvraag=d1');
    expect(text($('app-access-request-panel h2'))).toBe('Daan Smit');
  });

  it('leaves the details with the back link, for the one-screen layout', async () => {
    await render('/beheer/toegangsaanvragen?aanvraag=d1');
    expect($('.page')!.classList).toContain('page--detail');

    await click($<HTMLAnchorElement>('.panel__back')!);
    expect(url()).not.toContain('aanvraag');
    expect($('.page')!.classList).not.toContain('page--detail');
  });
  it('shows the locks and overlaps of every request a series decision includes', async () => {
    // m1 itself overlaps nobody, but m2 in the same series overlaps Wouter Bos.
    await render('/beheer/toegangsaanvragen?aanvraag=m1');
    expect(text($('app-access-request-panel .overlaps'))).toBe('');

    const series = text($('.series'));
    expect(series).toContain('Alle sloten');
    expect(series).toContain('Ook toegang: Wouter Bos');
    expect(series).toContain('Voordeur kleine gebouw, Magazijn buitendeur');
  });

  it('keeps the sample-data notice in view on the details screen', async () => {
    await render('/beheer/toegangsaanvragen?aanvraag=d1');
    expect(text($('.notice--detail'))).toBe('Voorbeeldgegevens: besluiten worden nog niet opgeslagen.');
  });

  it('goes back in history to the list it came from, so Back does not reopen the details', async () => {
    await render();
    const location = TestBed.inject(Location);
    const back = vi.spyOn(location, 'back');

    await click(rows()[0].querySelector('a')!);
    expect(url()).toContain('aanvraag=d1');
    await click($<HTMLAnchorElement>('.panel__back')!);

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('keeps the list mark when switching requests, and not for a direct link', async () => {
    await render('/beheer/toegangsaanvragen?aanvraag=d1');
    const location = TestBed.inject(Location);
    const back = vi.spyOn(location, 'back');

    // Switching rows replaces this directly opened entry; it must not claim to come from the list.
    await click(rows()[1].querySelector('a')!);
    expect(url()).toContain('aanvraag=d2');
    await click($<HTMLAnchorElement>('.panel__back')!);

    expect(back).not.toHaveBeenCalled();
    expect(url()).toBe('/beheer/toegangsaanvragen');
  });
});
