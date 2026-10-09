// 회독 세션과 학습 기록을 묶어서 갱신하는 동작들
import {
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
  chapterDeck,
  deckChapterId,
  getProgress,
  saveResult,
  setProgress,
  updateDeck,
  WEAK_DECK,
  type CompletionResult,
  type Progress,
} from '../storage/progress';

export function getSession(deck: string): Session | undefined {
  return getProgress().decks[deck]?.session;
}

export function startDeck(deck: string, wordIds: number[]): Session {
  const session = createSession(wordIds, { shuffle: getProgress().settings.shuffle });
  setProgress((p) => ({
    ...updateDeck(p, deck, (d) => ({ ...d, session, lastStudiedAt: Date.now() })),
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
    bumpWord(
      updateDeck(p, deck, (d) => ({ ...d, session: next, lastStudiedAt: Date.now() })),
      wordId,
      ans === 'unknown' ? 1 : 0,
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
    let q = updateDeck(p, deck, (d) => ({ ...d, session: r.session }));
    if (r.undone.answer === 'unknown') q = bumpWord(q, r.undone.wordId, -1);
    return q;
  });
  return r.session;
}

/** 대기열이 빈 세션을 마무리: 회독 수 +1, 결과 저장 */
export function completeDeck(deck: string): CompletionResult | null {
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
  };
  setProgress((p) => updateDeck(p, deck, () => ({ readCount, lastStudiedAt: Date.now() })));
  saveResult(result);
  return result;
}

export function deckTitle(vocab: Vocab, deck: string): string {
  if (deck === WEAK_DECK) return '자주 틀리는 단어';
  const id = deckChapterId(deck);
  return (id !== null && vocab.chapterById.get(id)?.title) || deck;
}

/** 자주 틀리는 단어 (많이 틀린 순) */
export function weakWordIds(vocab: Vocab, progress: Progress): { wordId: number; miss: number }[] {
  return Object.entries(progress.words)
    .map(([id, w]) => ({ wordId: Number(id), miss: w.miss }))
    .filter((w) => w.miss > 0 && vocab.wordById.has(w.wordId))
    .sort((a, b) => b.miss - a.miss || a.wordId - b.wordId);
}
