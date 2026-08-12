import { Component, inject } from '@angular/core';
import { ThemeService } from '../../app/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.css',
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);

  toggle(): void {
    this.theme.toggle();
  }
}
