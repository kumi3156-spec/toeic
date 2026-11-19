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
/** 학습 화면에 있는 동안은 미디어 세션을 계속 유지 (발음할 때마다 전환하면 늦어진다) */
let held = false;

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
  if (held) return;
  window.clearTimeout(stopTimer);
  stopTimer = window.setTimeout(() => {
    if (!held && !window.speechSynthesis.speaking) silent?.pause();
  }, 800);
}

/** 학습 화면에 들어오고 나갈 때 호출: 들어와 있는 동안 오디오 세션을 미리 열어 둔다 */
export function holdAudio(on: boolean) {
  held = on;
  if (on) {
    setPlaybackSession();
    startSilent();
  } else {
    stopSilentSoon();
  }
}

let warmed = false;
/** 음성 엔진을 소리 없이 미리 깨워 둔다 (첫 발음이 특히 늦는 것을 줄임) */
function warmUp() {
  if (warmed || !speechSupported) return;
  warmed = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    u.lang = 'en-US';
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  } catch {
    /* 무시 */
  }
}

if (typeof window !== 'undefined') {
  if (isIOS) setPlaybackSession();
  // 첫 터치(사용자 동작) 때 세션 지정, 엔진 예열, 학습 화면이면 무음 재생 시작
  window.addEventListener(
    'pointerdown',
    () => {
      if (isIOS) setPlaybackSession();
      warmUp();
      if (held) startSilent();
    },
    { capture: true },
  );
}

export function speak(text: string) {
  if (!speechSupported) return;
  try {
    setPlaybackSession();
    startSilent();
    const synth = window.speechSynthesis;
    // 말하는 중일 때만 취소 (매번 cancel하면 iOS에서 오히려 늦어진다)
    if (synth.speaking || synth.pending) synth.cancel();
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
