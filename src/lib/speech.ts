// Web Speech API로 영어 발음 (en-US)

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

let voice: SpeechSynthesisVoice | null = null;

function pickVoice() {
  if (!speechSupported) return;
  const voices = window.speechSynthesis.getVoices();
  const us = voices.filter((v) => v.lang.replace('_', '-').toLowerCase() === 'en-us');
  voice = us.find((v) => v.localService) ?? us[0] ?? voices.find((v) => v.lang.toLowerCase().startsWith('en')) ?? null;
}

if (speechSupported) {
  pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function speak(text: string) {
  if (!speechSupported) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[~()]/g, ' '));
    u.lang = 'en-US';
    if (voice) u.voice = voice;
    u.rate = 0.95;
    synth.speak(u);
  } catch {
    /* 발음 실패는 무시 */
  }
}
