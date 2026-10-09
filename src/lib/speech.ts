// Web Speech API로 영어 발음 (en-US)

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

const isIOS =
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

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

// ---------- iOS 무음 모드 대응 ----------
// iOS에서 음성 합성은 기본적으로 벨소리 채널을 써서 무음 스위치를 켜면 소리가 나지 않는다.
// 미디어 채널(무음 스위치 무시)로 바꾸기 위해
//  1) Audio Session API(Safari 16.4+)로 'playback' 지정
//  2) 말하는 동안 무음 오디오를 재생해 오디오 세션을 미디어 재생 상태로 유지

function setPlaybackSession() {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== 'playback') session.type = 'playback';
  } catch {
    /* 미지원 */
  }
}

/** 0.5초 길이의 무음 WAV (8kHz, 8bit, mono) */
function silentWavUrl(): string {
  const rate = 8000;
  const n = rate / 2;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128); // 8bit 무음
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

let silent: HTMLAudioElement | null = null;
let stopTimer: number | undefined;

function startSilent() {
  if (!isIOS) return;
  try {
    if (!silent) {
      silent = new Audio(silentWavUrl());
      silent.loop = true;
      silent.setAttribute('playsinline', '');
    }
    window.clearTimeout(stopTimer);
    if (silent.paused) void silent.play().catch(() => {});
  } catch {
    /* 무시 */
  }
}

function stopSilentSoon() {
  window.clearTimeout(stopTimer);
  stopTimer = window.setTimeout(() => {
    if (!window.speechSynthesis.speaking) silent?.pause();
  }, 800);
}

/** 첫 터치 때 미리 미디어 재생 세션으로 지정해 둔다 */
if (isIOS && typeof window !== 'undefined') {
  setPlaybackSession();
  window.addEventListener('pointerdown', setPlaybackSession, { once: true, capture: true });
}

export function speak(text: string) {
  if (!speechSupported) return;
  try {
    setPlaybackSession();
    startSilent();
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[~()]/g, ' '));
    u.lang = 'en-US';
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = stopSilentSoon;
    u.onerror = stopSilentSoon;
    synth.speak(u);
  } catch {
    /* 발음 실패는 무시 */
  }
}
