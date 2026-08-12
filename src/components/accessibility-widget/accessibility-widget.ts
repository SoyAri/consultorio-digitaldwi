import { Component, ElementRef, HostListener, OnDestroy, inject, signal } from '@angular/core';
import { AccessibilityService } from '../../app/services/accessibility.service';

@Component({
  selector: 'app-accessibility-widget',
  templateUrl: './accessibility-widget.html',
  styleUrl: './accessibility-widget.css',
})
export class AccessibilityWidget implements OnDestroy {
  protected readonly a11y = inject(AccessibilityService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  protected readonly open = signal(false);

  toggleOpen(): void {
    this.open.update(v => !v);
  }

  close(): void {
    this.open.set(false);
  }

  fontPercent(): number {
    return Math.round(this.a11y.prefs().fontScale * 100);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close();
  }

  ngOnDestroy(): void {
    this.a11y.stopReading();
  }
}
