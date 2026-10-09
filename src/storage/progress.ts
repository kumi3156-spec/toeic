import { parseSession, type Session } from '../core/session';

export interface Settings {
  shuffle: boolean;
  autoSpeak: boolean;
}

export interface DeckRecord {
  /** 회독 수 (완주 횟수) */
  readCount: number;
  lastStudiedAt?: number;
  /** 진행 중인 세션 */
  session?: Session;
}

export interface WordStat {
  /** "모르겠음" 누적 횟수 */
  miss: number;
  /** 마지막으로 본 날짜 (YYYY-MM-DD) */
  lastSeen?: string;
}

export interface Progress {
  version: 1;
  /** 키: "ch-12" (챕터), "weak" (자주 틀리는 단어) */
  decks: Record<string, DeckRecord>;
  words: Record<string, WordStat>;
  lastDeck?: string;
  settings: Settings;
}

export interface CompletionResult {
  deck: string;
  wordIds: number[];
  elapsedMs: number;
  rounds: number;
  total: number;
  firstTryKnown: number;
  missed: { wordId: number; count: number }[];
  finishedAt: number;
  readCount: number;
}

export const DEFAULT_SETTINGS: Settings = {
  shuffle: true,
  autoSpeak: false,
};

export const emptyProgress = (): Progress => ({
  version: 1,
  decks: {},
  words: {},
  settings: { ...DEFAULT_SETTINGS },
});

export const chapterDeck = (chapterId: number) => `ch-${chapterId}`;
export const WEAK_DECK = 'weak';
export const deckChapterId = (deck: string): number | null => {
  const m = /^ch-(\d+)$/.exec(deck);
  return m ? Number(m[1]) : null;
};

export function todayString(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- 검증 ----------

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** 저장된/불러온 데이터를 검증하며 Progress로 변환. 형식이 아니면 null */
export function parseProgress(raw: unknown): Progress | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 || typeof o.decks !== 'object' || typeof o.words !== 'object' || !o.decks || !o.words) return null;

  const decks: Record<string, DeckRecord> = {};
  for (const [key, v] of Object.entries(o.decks as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const d = v as Record<string, unknown>;
    const rec: DeckRecord = { readCount: Math.max(0, Math.floor(num(d.readCount, 0))) };
    if (typeof d.lastStudiedAt === 'number') rec.lastStudiedAt = d.lastStudiedAt;
    const session = d.session ? parseSession(d.session) : null;
    if (session) rec.session = session;
    decks[key] = rec;
  }

  const words: Record<string, WordStat> = {};
  for (const [key, v] of Object.entries(o.words as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const w = v as Record<string, unknown>;
    const stat: WordStat = { miss: Math.max(0, Math.floor(num(w.miss, 0))) };
    if (typeof w.lastSeen === 'string') stat.lastSeen = w.lastSeen;
    words[key] = stat;
  }

  const s = (o.settings ?? {}) as Record<string, unknown>;
  const settings: Settings = {
    shuffle: typeof s.shuffle === 'boolean' ? s.shuffle : DEFAULT_SETTINGS.shuffle,
    autoSpeak: typeof s.autoSpeak === 'boolean' ? s.autoSpeak : DEFAULT_SETTINGS.autoSpeak,
  };

  return {
    version: 1,
    decks,
    words,
    lastDeck: typeof o.lastDeck === 'string' ? o.lastDeck : undefined,
    settings,
  };
}

// ---------- localStorage (실패해도 앱은 동작) ----------

const KEY = 'hoedok:progress:v1';
const RESULT_KEY = 'hoedok:lastResult';

export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* 무시 */
  }
}

function readProgress(): Progress {
  const raw = safeGet(KEY);
  if (!raw) return emptyProgress();
  try {
    return parseProgress(JSON.parse(raw)) ?? emptyProgress();
  } catch {
    return emptyProgress();
  }
}

// ---------- 스토어 ----------

let state: Progress | null = null;
const listeners = new Set<() => void>();

export function getProgress(): Progress {
  if (!state) state = readProgress();
  return state;
}

export function setProgress(next: Progress | ((p: Progress) => Progress)) {
  state = typeof next === 'function' ? next(getProgress()) : next;
  safeSet(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export function subscribeProgress(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------- 갱신 헬퍼 (순수 함수) ----------

export function updateDeck(p: Progress, deck: string, f: (d: DeckRecord) => DeckRecord): Progress {
  const cur = p.decks[deck] ?? { readCount: 0 };
  return { ...p, decks: { ...p.decks, [deck]: f(cur) } };
}

export function bumpWord(p: Progress, wordId: number, missDelta: number, today = todayString()): Progress {
  const cur = p.words[wordId] ?? { miss: 0 };
  return {
    ...p,
    words: { ...p.words, [wordId]: { miss: Math.max(0, cur.miss + missDelta), lastSeen: today } },
  };
}

export function resetDeck(p: Progress, deck: string, wordIds: number[]): Progress {
  const decks = { ...p.decks };
  delete decks[deck];
  const words = { ...p.words };
  for (const id of wordIds) delete words[id];
  return { ...p, decks, words, lastDeck: p.lastDeck === deck ? undefined : p.lastDeck };
}

// ---------- 완료 결과 ----------

let lastResult: CompletionResult | null = null;

export function saveResult(r: CompletionResult) {
  lastResult = r;
  safeSet(RESULT_KEY, JSON.stringify(r));
}

export function loadResult(): CompletionResult | null {
  if (lastResult) return lastResult;
  const raw = safeGet(RESULT_KEY);
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as CompletionResult;
    return typeof r?.deck === 'string' && Array.isArray(r.missed) && Array.isArray(r.wordIds) ? r : null;
  } catch {
    return null;
  }
}

export function clearResult() {
  lastResult = null;
  safeRemove(RESULT_KEY);
}

// ---------- 내보내기 / 불러오기 ----------

export function exportJson(p: Progress): string {
  return JSON.stringify({ app: 'hoedok', exportedAt: new Date().toISOString(), ...p }, null, 2);
}

export function importJson(text: string): Progress | null {
  try {
    return parseProgress(JSON.parse(text));
  } catch {
    return null;
  }
}
