// 회독 세션과 학습 기록을 묶어서 갱신하는 동작들
import {
  shuffleArray,
  answer,
  createSession,
  firstTryKnownCount,
  isComplete,
  missedWords,
  resume,
  undo,
  type Answer,
  type Session,
} from '../core/session';
import type { Vocab } from '../data/vocab';
import {
  bumpWord,
  logAnswer,
  logCompletion,
  chapterDeck,
  deckChapterId,
  getProgress,
  saveResult,
  setProgress,
  updateDeck,
  WEAK_DECK,
  TEST_DECK,
  missesSince,
  type CompletionResult,
  type Progress,
} from '../storage/progress';

export function getSession(deck: string): Session | undefined {
  return getProgress().decks[deck]?.session;
}

export function startDeck(deck: string, wordIds: number[], opts: { once?: boolean; label?: string } = {}): Session {
  const session = createSession(wordIds, { shuffle: opts.once ? true : getProgress().settings.shuffle, once: opts.once });
  setProgress((p) => ({
    ...updateDeck(p, deck, (d) => ({ ...d, session, lastStudiedAt: Date.now(), label: opts.label ?? d.label })),
    lastDeck: deck,
  }));
  return session;
}

export function startChapter(vocab: Vocab, chapterId: number): Session {
  return startDeck(chapterDeck(chapterId), vocab.wordIdsByChapter.get(chapterId) ?? []);
}

/** 이어하기: 자리를 비운 시간이 학습 시간에 들어가지 않게 한다 */
export function resumeDeck(deck: string) {
  setProgress((p) => {
    const s = p.decks[deck]?.session;
    if (!s) return p;
    return { ...updateDeck(p, deck, (d) => ({ ...d, session: resume(s) })), lastDeck: deck };
  });
}

export function recordAnswer(deck: string, ans: Answer): Session | null {
  const s = getSession(deck);
  if (!s || s.queue.length === 0) return null;
  const wordId = s.queue[0];
  const next = answer(s, ans);
  setProgress((p) =>
    logAnswer(
      bumpWord(
        updateDeck(p, deck, (d) => ({ ...d, session: next, lastStudiedAt: Date.now() })),
        wordId,
        ans === 'unknown' ? 1 : 0,
      ),
      next.activeMs - s.activeMs,
    ),
  );
  return next;
}

export function undoAnswer(deck: string): Session | null {
  const s = getSession(deck);
  if (!s) return null;
  const r = undo(s);
  if (!r) return null;
  setProgress((p) => {
    let q = logAnswer(
      updateDeck(p, deck, (d) => ({ ...d, session: r.session })),
      0,
      -1,
    );
    if (r.undone.answer === 'unknown') q = bumpWord(q, r.undone.wordId, -1);
    return q;
  });
  return r.session;
}

/** 대기열이 빈 세션을 마무리: 회독 수 +1, 결과 저장 */
export function completeDeck(deck: string, title: string = deck): CompletionResult | null {
  const s = getSession(deck);
  if (!s || !isComplete(s)) return null;
  const readCount = (getProgress().decks[deck]?.readCount ?? 0) + 1;
  const result: CompletionResult = {
    deck,
    wordIds: s.wordIds,
    elapsedMs: s.activeMs,
    rounds: s.round,
    total: s.wordIds.length,
    firstTryKnown: firstTryKnownCount(s),
    missed: missedWords(s),
    finishedAt: Date.now(),
    readCount,
    ...(s.once ? { once: true } : {}),
  };
  setProgress((p) =>
    logCompletion(
      updateDeck(p, deck, (d) => ({ readCount, lastStudiedAt: Date.now(), label: d.label })),
      {
        deck,
        title,
        finishedAt: result.finishedAt,
        elapsedMs: result.elapsedMs,
        rounds: result.rounds,
        total: result.total,
        firstTryKnown: result.firstTryKnown,
        readCount,
        ...(s.once ? { once: true } : {}),
      },
    ),
  );
  saveResult(result);
  return result;
}

export function deckTitle(vocab: Vocab, deck: string): string {
  if (deck === WEAK_DECK) return '자주 틀리는 단어';
  if (deck === TEST_DECK) return getProgress().decks[TEST_DECK]?.label ?? '테스트';
  const id = deckChapterId(deck);
  return (id !== null && vocab.chapterById.get(id)?.title) || deck;
}

/** 자주 틀리는 단어 (많이 틀린 순) */
export function weakWordIds(vocab: Vocab, progress: Progress, since = ''): { wordId: number; miss: number }[] {
  return Object.entries(progress.words)
    .map(([id, w]) => ({ wordId: Number(id), miss: missesSince(w, since) }))
    .filter((w) => w.miss > 0 && vocab.wordById.has(w.wordId))
    .sort((a, b) => b.miss - a.miss || a.wordId - b.wordId);
}

/** Day 번호 목록을 짧게 표시: [1,2,3,5,7,8] → "Day 1–3, 5, 7–8" */
export function formatDays(ids: number[]): string {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j + 1;
  }
  return `Day ${parts.join(', ')}`;
}

/** 여러 Day를 골라 테스트: 각 단어를 한 번씩만 본다. limit이 있으면 그만큼 무작위로 뽑는다 */
export function startTest(vocab: Vocab, chapterIds: number[], limit = 0): Session {
  let ids = chapterIds.flatMap((c) => vocab.wordIdsByChapter.get(c) ?? []);
  if (limit > 0 && ids.length > limit) ids = shuffleArray(ids).slice(0, limit);
  return startDeck(TEST_DECK, ids, { once: true, label: `테스트 · ${formatDays(chapterIds)}` });
}
