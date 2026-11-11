import { currentDate } from '../../../current-date';
import { Component, computed } from '@angular/core';
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
  private readonly date = currentDate();
  protected readonly year = computed(() => this.date().year);
}
