import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { buildingPage } from '../../content/site-content';
import { Building } from './building';

describe('Building', () => {
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Building],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Building);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  });

  it('jump links point at the sections on this page, not the homepage', () => {
    const hrefs = Array.from(element.querySelectorAll('nav.jump a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual(buildingPage.buildings.map((b) => `/gebouw#${b.id}`));
    for (const b of buildingPage.buildings) {
      expect(element.querySelector(`section#${b.id}`)).not.toBeNull();
    }
  });
});
