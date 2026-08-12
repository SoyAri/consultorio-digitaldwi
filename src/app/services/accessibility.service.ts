import { Injectable, signal, computed, effect } from '@angular/core';

export interface A11yPrefs {
  fontScale: number;
  highContrast: boolean;
  underlineLinks: boolean;
  dyslexiaFont: boolean;
  textSpacing: boolean;
  reduceMotion: boolean;
}

const STORAGE_KEY = 'a11y-prefs';
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.4;
const STEP = 0.1;

const DEFAULT_PREFS: A11yPrefs = {
  fontScale: 1,
  highContrast: false,
  underlineLinks: false,
  dyslexiaFont: false,
  textSpacing: false,
  reduceMotion: false,
};

@Injectable({ providedIn: 'root' })
export class AccessibilityService {
  readonly prefs = signal<A11yPrefs>(this.loadPrefs());

  readonly isReading = signal(false);
  readonly isPaused  = signal(false);

  private utterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    effect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs())));
  }

  increaseFont(): void {
    this.prefs.update(p => ({ ...p, fontScale: Math.min(MAX_SCALE, round1(p.fontScale + STEP)) }));
  }

  decreaseFont(): void {
    this.prefs.update(p => ({ ...p, fontScale: Math.max(MIN_SCALE, round1(p.fontScale - STEP)) }));
  }

  toggleHighContrast(): void   { this.prefs.update(p => ({ ...p, highContrast: !p.highContrast })); }
  toggleUnderlineLinks(): void { this.prefs.update(p => ({ ...p, underlineLinks: !p.underlineLinks })); }
  toggleDyslexiaFont(): void   { this.prefs.update(p => ({ ...p, dyslexiaFont: !p.dyslexiaFont })); }
  toggleTextSpacing(): void    { this.prefs.update(p => ({ ...p, textSpacing: !p.textSpacing })); }
  toggleReduceMotion(): void   { this.prefs.update(p => ({ ...p, reduceMotion: !p.reduceMotion })); }

  reset(): void {
    this.prefs.set({ ...DEFAULT_PREFS });
    this.stopReading();
  }

  startReading(): void {
    if (!('speechSynthesis' in window)) return;
    this.stopReading();

    const main = document.querySelector('main');
    const text = main?.innerText?.trim();
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    utterance.onstart = () => { this.isReading.set(true); this.isPaused.set(false); };
    utterance.onend   = () => { this.isReading.set(false); this.isPaused.set(false); };
    utterance.onerror = () => { this.isReading.set(false); this.isPaused.set(false); };

    this.utterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  pauseReading(): void {
    if (!this.isReading()) return;
    window.speechSynthesis.pause();
    this.isPaused.set(true);
  }

  resumeReading(): void {
    if (!this.isReading()) return;
    window.speechSynthesis.resume();
    this.isPaused.set(false);
  }

  stopReading(): void {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.utterance = null;
    this.isReading.set(false);
    this.isPaused.set(false);
  }

  private loadPrefs(): A11yPrefs {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PREFS };
      return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
