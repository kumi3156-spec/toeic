import { parseSession, type Session } from '../core/session';

export interface Settings {
  shuffle: boolean;
  autoSpeak: boolean;
  /** 뜻을 안 보고 "알고있음"을 눌렀을 때 뜻을 보여주는 시간(ms). 0이면 바로 넘어감 */
  knownRevealMs: number;
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

/** 하루 학습량 */
export interface DayStat {
  /** 답한 카드 수 (같은 단어를 여러 번 봐도 각각 센다) */
  answers: number;
  /** 학습 시간(ms) */
  ms: number;
}

/** 회독 완료 기록 */
export interface HistoryEntry {
  deck: string;
  /** 완료 당시 이름 (예: "Day 3") */
  title: string;
  finishedAt: number;
  elapsedMs: number;
  rounds: number;
  total: number;
  firstTryKnown: number;
  readCount: number;
}

/** 완료 기록 최대 개수 */
export const MAX_HISTORY = 3000;

export interface Progress {
  version: 1;
  /** 키: "ch-12" (챕터), "weak" (자주 틀리는 단어) */
  decks: Record<string, DeckRecord>;
  words: Record<string, WordStat>;
  lastDeck?: string;
  /** 챕터 구성(단어 데이터 version). 구성이 바뀌면 챕터 기록을 초기화한다 */
  layout?: number;
  /** 날짜(YYYY-MM-DD)별 학습량 */
  daily: Record<string, DayStat>;
  /** 회독 완료 기록 (오래된 순) */
  history: HistoryEntry[];
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
  knownRevealMs: 800,
};

export const emptyProgress = (): Progress => ({
  version: 1,
  decks: {},
  words: {},
  daily: {},
  history: [],
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

  const daily: Record<string, DayStat> = {};
  if (o.daily && typeof o.daily === 'object') {
    for (const [day, v] of Object.entries(o.daily as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !v || typeof v !== 'object') continue;
      const x = v as Record<string, unknown>;
      daily[day] = { answers: Math.max(0, Math.floor(num(x.answers, 0))), ms: Math.max(0, num(x.ms, 0)) };
    }
  }

  const history: HistoryEntry[] = [];
  if (Array.isArray(o.history)) {
    for (const v of o.history as Record<string, unknown>[]) {
      if (!v || typeof v.deck !== 'string' || typeof v.finishedAt !== 'number') continue;
      history.push({
        deck: v.deck,
        title: typeof v.title === 'string' ? v.title : v.deck,
        finishedAt: v.finishedAt,
        elapsedMs: Math.max(0, num(v.elapsedMs, 0)),
        rounds: Math.max(1, Math.floor(num(v.rounds, 1))),
        total: Math.max(0, Math.floor(num(v.total, 0))),
        firstTryKnown: Math.max(0, Math.floor(num(v.firstTryKnown, 0))),
        readCount: Math.max(1, Math.floor(num(v.readCount, 1))),
      });
    }
  }

  const s = (o.settings ?? {}) as Record<string, unknown>;
  const settings: Settings = {
    shuffle: typeof s.shuffle === 'boolean' ? s.shuffle : DEFAULT_SETTINGS.shuffle,
    autoSpeak: typeof s.autoSpeak === 'boolean' ? s.autoSpeak : DEFAULT_SETTINGS.autoSpeak,
    knownRevealMs: Math.max(0, Math.min(5000, num(s.knownRevealMs, DEFAULT_SETTINGS.knownRevealMs))),
  };

  return {
    version: 1,
    decks,
    words,
    lastDeck: typeof o.lastDeck === 'string' ? o.lastDeck : undefined,
    layout: typeof o.layout === 'number' ? o.layout : undefined,
    daily,
    history: history.slice(-MAX_HISTORY),
    settings,
  };
}

/** 하루 학습량 기록. 되돌리기는 count를 -1로 */
export function logAnswer(p: Progress, ms: number, count = 1, day = todayString()): Progress {
  const cur = p.daily[day] ?? { answers: 0, ms: 0 };
  return {
    ...p,
    daily: { ...p.daily, [day]: { answers: Math.max(0, cur.answers + count), ms: cur.ms + Math.max(0, ms) } },
  };
}

export function logCompletion(p: Progress, entry: HistoryEntry): Progress {
  return { ...p, history: [...p.history, entry].slice(-MAX_HISTORY) };
}

/**
 * 챕터 구성이 바뀌었으면 챕터별 기록(회독 수, 진행 중 학습)을 지운다.
 * 단어별 기록(틀린 횟수)과 자주 틀리는 단어 학습, 설정은 그대로 둔다.
 */
export function applyLayout(p: Progress, layout: number): Progress {
  if (p.layout === layout) return p;
  const decks: Record<string, DeckRecord> = {};
  for (const [key, rec] of Object.entries(p.decks)) {
    if (deckChapterId(key) === null) decks[key] = rec;
  }
  const lastDeck = p.lastDeck && deckChapterId(p.lastDeck) === null ? p.lastDeck : undefined;
  return { ...p, decks, lastDeck, layout };
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
