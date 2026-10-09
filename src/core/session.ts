// 회독 로직: UI와 분리된 순수 함수 모음.
// 모든 함수는 입력 상태를 변경하지 않고 새 상태를 반환한다.

export type Answer = 'known' | 'unknown';

export type Rng = () => number;

/** 되돌리기용 기록: 답 하나를 거꾸로 되돌리는 데 필요한 최소 정보 */
export interface UndoEntry {
  wordId: number;
  answer: Answer;
  /** 이 답으로 바퀴가 넘어갔다면, 답하기 직전의 pending (바퀴를 되돌릴 때 필요) */
  rolled?: number[];
}

/** 되돌리기 기록 최대 개수 */
export const MAX_UNDO = 1000;

export interface SessionCore {
  /** 이번 회독에 포함된 전체 단어 */
  wordIds: number[];
  /** 이번 바퀴에서 아직 보지 않은 단어. 맨 앞이 현재 단어 */
  queue: number[];
  /** 이번 바퀴에서 "모르겠음"을 받은 단어. 다음 바퀴 대기열이 된다 */
  pending: number[];
  /** 현재 바퀴 수 (1부터) */
  round: number;
  /** 이번 회독에서 단어별 "모르겠음" 횟수 */
  missCounts: Record<string, number>;
  shuffle: boolean;
  startedAt: number;
  /** 실제 학습한 시간(ms). 오래 자리를 비운 시간은 IDLE_CAP_MS로 잘린다 */
  activeMs: number;
  lastTick: number;
}

export interface Session extends SessionCore {
  /** 되돌리기 기록 (오래된 순). 마지막이 가장 최근 답 */
  history: UndoEntry[];
}

export interface Clock {
  now?: number;
  rng?: Rng;
}

/** 답 사이 간격이 이보다 길면 자리를 비운 것으로 보고 이 값까지만 시간에 반영 */
export const IDLE_CAP_MS = 60_000;

export function shuffleArray<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createSession(
  wordIds: readonly number[],
  opts: { shuffle?: boolean } & Clock = {},
): Session {
  const now = opts.now ?? Date.now();
  const shuffle = opts.shuffle ?? true;
  const ids = Array.from(new Set(wordIds));
  return {
    wordIds: ids,
    queue: shuffle ? shuffleArray(ids, opts.rng) : ids.slice(),
    pending: [],
    round: 1,
    missCounts: {},
    shuffle,
    startedAt: now,
    activeMs: 0,
    lastTick: now,
    history: [],
  };
}

export function currentWordId(s: Session): number | null {
  return s.queue.length > 0 ? s.queue[0] : null;
}

/** 아직 "알고있음"을 받지 못한 단어 수 */
export function remainingCount(s: Session): number {
  return s.queue.length + s.pending.length;
}

export function knownCount(s: Session): number {
  return s.wordIds.length - remainingCount(s);
}

export function isComplete(s: Session): boolean {
  return remainingCount(s) === 0;
}

/** 처음 봤을 때 바로 "알고있음"을 누른 단어 수 */
export function firstTryKnownCount(s: Session): number {
  return s.wordIds.filter((id) => !s.missCounts[id]).length;
}

/** 이번 회독에서 한 번이라도 틀린 단어 (많이 틀린 순) */
export function missedWords(s: Session): { wordId: number; count: number }[] {
  return Object.entries(s.missCounts)
    .map(([id, count]) => ({ wordId: Number(id), count }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count || a.wordId - b.wordId);
}

/** 대기열 맨 앞이 방금 본 단어라면 다른 단어와 자리를 바꾼다 */
function avoidImmediateRepeat(queue: number[], lastId: number, rng: Rng): number[] {
  if (queue.length < 2 || queue[0] !== lastId) return queue;
  const q = queue.slice();
  const j = 1 + Math.floor(rng() * (q.length - 1));
  [q[0], q[j]] = [q[j], q[0]];
  return q;
}

/** 현재 단어에 답한다 */
export function answer(s: Session, ans: Answer, clock: Clock = {}): Session {
  const id = currentWordId(s);
  if (id === null) return s;
  const now = clock.now ?? Date.now();
  const rng = clock.rng ?? Math.random;

  let queue = s.queue.slice(1);
  let pending = s.pending;
  let round = s.round;
  let missCounts = s.missCounts;

  if (ans === 'unknown') {
    pending = [...pending, id];
    missCounts = { ...missCounts, [id]: (missCounts[id] ?? 0) + 1 };
  }

  const entry: UndoEntry = { wordId: id, answer: ans };

  // 한 바퀴를 다 돌았으면 남은 "모르겠음" 단어로 다음 바퀴 시작
  if (queue.length === 0 && pending.length > 0) {
    entry.rolled = s.pending;
    queue = s.shuffle ? shuffleArray(pending, rng) : pending.slice();
    queue = avoidImmediateRepeat(queue, id, rng);
    pending = [];
    round += 1;
  }

  const delta = Math.max(0, Math.min(now - s.lastTick, IDLE_CAP_MS));

  return {
    ...s,
    queue,
    pending,
    round,
    missCounts,
    activeMs: s.activeMs + delta,
    lastTick: now,
    history: [...s.history, entry].slice(-MAX_UNDO),
  };
}

export function canUndo(s: Session): boolean {
  return s.history.length > 0;
}

/** 가장 최근 답 1개를 취소한다. 여러 번 호출하면 계속 이전으로 돌아간다. 취소할 것이 없으면 null */
export function undo(s: Session, clock: Clock = {}): { session: Session; undone: UndoEntry } | null {
  const entry = s.history[s.history.length - 1];
  if (!entry) return null;
  const now = clock.now ?? Date.now();
  const id = entry.wordId;

  let queue: number[];
  let pending: number[];
  let round = s.round;
  if (entry.rolled) {
    // 바퀴가 넘어간 답: 이전 바퀴의 마지막 단어 하나만 남은 상태로 복원
    queue = [id];
    pending = entry.rolled;
    round -= 1;
  } else {
    queue = [id, ...s.queue];
    pending = entry.answer === 'unknown' ? s.pending.slice(0, -1) : s.pending;
  }

  const missCounts = { ...s.missCounts };
  if (entry.answer === 'unknown') {
    const n = (missCounts[id] ?? 0) - 1;
    if (n > 0) missCounts[id] = n;
    else delete missCounts[id];
  }

  return {
    // 시간은 되돌리지 않는다 (실제로 공부한 시간이므로)
    session: { ...s, queue, pending, round, missCounts, lastTick: now, history: s.history.slice(0, -1) },
    undone: entry,
  };
}

/** 이어하기를 시작할 때 호출: 자리를 비운 시간이 학습 시간에 들어가지 않도록 */
export function resume(s: Session, now: number = Date.now()): Session {
  return { ...s, lastTick: now };
}

// ---------- 저장 / 복원 ----------

export function serializeSession(s: Session): string {
  return JSON.stringify(s);
}

const isIdArray = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isFinite(x));

function parseCore(v: unknown): SessionCore | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isIdArray(o.wordIds) || !isIdArray(o.queue) || !isIdArray(o.pending)) return null;
  if (typeof o.round !== 'number' || o.round < 1) return null;
  const all = new Set(o.wordIds);
  if (![...o.queue, ...o.pending].every((id) => all.has(id))) return null;
  const missCounts: Record<string, number> = {};
  if (o.missCounts && typeof o.missCounts === 'object') {
    for (const [k, n] of Object.entries(o.missCounts as Record<string, unknown>)) {
      if (typeof n === 'number' && n > 0) missCounts[k] = n;
    }
  }
  const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
  const now = Date.now();
  return {
    wordIds: o.wordIds,
    queue: o.queue,
    pending: o.pending,
    round: o.round,
    missCounts,
    shuffle: o.shuffle !== false,
    startedAt: num(o.startedAt, now),
    activeMs: num(o.activeMs, 0),
    lastTick: num(o.lastTick, now),
  };
}

/** 저장된 세션을 검증하며 복원한다. 손상된 데이터면 null */
export function parseSession(v: unknown): Session | null {
  const core = parseCore(v);
  if (!core) return null;
  const history: UndoEntry[] = [];
  const h = (v as Record<string, unknown>).history;
  if (Array.isArray(h)) {
    for (const e of h as Record<string, unknown>[]) {
      if (!e || typeof e.wordId !== 'number' || (e.answer !== 'known' && e.answer !== 'unknown')) continue;
      const entry: UndoEntry = { wordId: e.wordId, answer: e.answer };
      if (isIdArray(e.rolled)) entry.rolled = e.rolled;
      history.push(entry);
    }
  }
  // 예전 형식(undo: 직전 1개)은 버린다
  return { ...core, history: history.slice(-MAX_UNDO) };
}

export function deserializeSession(json: string): Session | null {
  try {
    return parseSession(JSON.parse(json));
  } catch {
    return null;
  }
}
