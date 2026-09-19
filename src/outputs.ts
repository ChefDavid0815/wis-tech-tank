import { type Lang } from './engine';

export class AudioOutput {
  enabled = true; status: 'ready' | 'speaking' | 'unavailable' | 'error' = 'ready';
  private synth = window.speechSynthesis; private generation = 0;
  constructor() { if (!this.synth || !('SpeechSynthesisUtterance' in window)) this.status = 'unavailable'; }
  speak(text: string, lang: Lang) {
    if (!this.enabled || !this.synth) return;
    this.cancel(); const generation = this.generation;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'zh' ? 'zh-CN' : 'en-GB'; utterance.rate = 1.08;
    const voices = this.synth.getVoices();
    const available = voices.filter(v => v.lang.startsWith(lang));
    utterance.voice = available.find(v => v.localService) ?? available[0] ?? null;
    utterance.onstart = () => { if (this.generation === generation) this.status = 'speaking'; };
    utterance.onend = () => { if (this.generation === generation) this.status = 'ready'; };
    utterance.onerror = e => { if (this.generation === generation && e.error !== 'interrupted' && e.error !== 'canceled') this.status = 'error'; };
    this.synth.speak(utterance);
  }
  cancel() { this.generation++; this.synth?.cancel(); if (this.status !== 'unavailable') this.status = 'ready'; }
  voiceInfo(lang: Lang) { const voices = this.synth?.getVoices().filter(v => v.lang.startsWith(lang)) ?? []; return { count: voices.length, local: voices.some(v => v.localService) }; }
}
