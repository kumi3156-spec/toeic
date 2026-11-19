import { useEffect } from 'react';
import { deckTitle, startDeck, toTestLabel } from '../app/actions';
import type { Vocab } from '../data/vocab';
import { navigate } from '../lib/router';
import { chapterDeck, deckChapterId, getProgress, loadResult, TEST_DECK } from '../storage/progress';

function formatDuration(ms: number) {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) return `${Math.floor(m / 60)}시간 ${m % 60}분`;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

export function Complete({ vocab, deck }: { vocab: Vocab; deck: string }) {
  const result = loadResult();
  const valid = result && result.deck === deck;

  useEffect(() => {
    if (!valid) navigate('/', { replace: true });
  }, [valid]);
  if (!valid) return null;

  const chId = deckChapterId(deck);
  const idx = chId !== null ? vocab.chapters.findIndex((c) => c.id === chId) : -1;
  const next = idx >= 0 ? vocab.chapters[idx + 1] : undefined;

  const again = () => {
    // 같은 단어 묶음으로 처음부터
    const ids = chId !== null ? vocab.wordIdsByChapter.get(chId) ?? result.wordIds : result.wordIds;
    startDeck(deck, ids);
    navigate(`/study/${deck}`, { replace: true });
  };

  if (result.once) {
    // 테스트 결과
    const label = getProgress().decks[TEST_DECK]?.label ?? deckTitle(vocab, deck);
    const base = label.replace(/ · 오답( 회독)?$/, '');
    const missedIds = result.missed.map((m) => m.wordId);
    const pct = result.total ? Math.round((result.firstTryKnown / result.total) * 100) : 0;
    const go = (ids: number[], once: boolean, suffix: string) => {
      startDeck(TEST_DECK, ids, { once, label: base + suffix });
      navigate(`/study/${TEST_DECK}`, { replace: true });
    };
    return (
      <div className="screen complete">
        <div className="complete-hero">
          <div className="complete-check score" aria-hidden>
            {pct}
          </div>
          <h1>테스트 결과</h1>
          <p className="muted">{label}</p>
        </div>

        <div className="stats">
          <div className="stat">
            <span className="stat-label">맞힌 단어</span>
            <span className="stat-value">
              {result.firstTryKnown}
              <small> / {result.total}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">정답률</span>
            <span className="stat-value">{pct}%</span>
          </div>
          <div className="stat">
            <span className="stat-label">소요 시간</span>
            <span className="stat-value">{formatDuration(result.elapsedMs)}</span>
          </div>
        </div>

        {result.missed.length > 0 ? (
          <section className="missed">
            <h2>
              틀린 단어 <span className="muted">{result.missed.length}개</span>
            </h2>
            <ul className="word-list">
              {result.missed.map((m) => {
                const w = vocab.wordById.get(m.wordId);
                if (!w) return null;
                return (
                  <li key={m.wordId}>
                    <span className="wl-word" lang="en">
                      {w.word}
                      {w.imp === 3 && <span className="wl-imp"> ★</span>}
                    </span>
                    <span className="wl-meaning">{w.meaning}</span>
                    <span className="wl-count">Day {w.chapter}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <p className="perfect">전부 맞혔어요 🎉</p>
        )}

        <div className="complete-actions">
          {missedIds.length > 0 && (
            <>
              <button className="btn btn-primary" onClick={() => go(missedIds, false, ' · 오답 회독')}>
                틀린 단어 회독하기
              </button>
              <button className="btn btn-secondary" onClick={() => go(missedIds, true, ' · 오답')}>
                틀린 단어만 다시 테스트
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={() => go(result.wordIds, true, '')}>
            같은 범위 다시 테스트
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/', { replace: true })}>
            홈으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen complete">
      <div className="complete-hero">
        <div className="complete-check" aria-hidden>
          ✓
        </div>
        <h1>{deckTitle(vocab, deck)} 완료!</h1>
        <p className="muted">{chId !== null ? `${result.readCount}회독 달성` : '모든 단어를 외웠어요'}</p>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="stat-label">소요 시간</span>
          <span className="stat-value">{formatDuration(result.elapsedMs)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">바퀴 수</span>
          <span className="stat-value">{result.rounds}바퀴</span>
        </div>
        <div className="stat">
          <span className="stat-label">바로 안 단어</span>
          <span className="stat-value">
            {result.firstTryKnown}
            <small> / {result.total}</small>
          </span>
        </div>
      </div>

      {result.missed.length > 0 ? (
        <section className="missed">
          <h2>
            이번에 틀린 단어 <span className="muted">{result.missed.length}개</span>
          </h2>
          <ul className="word-list">
            {result.missed.map((m) => {
              const w = vocab.wordById.get(m.wordId);
              if (!w) return null;
              return (
                <li key={m.wordId}>
                  <span className="wl-word" lang="en">
                    {w.word}
                    {w.imp === 3 && <span className="wl-imp"> ★</span>}
                  </span>
                  <span className="wl-meaning">{w.meaning}</span>
                  <span className="wl-count">×{m.count}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="perfect">한 번도 틀리지 않았어요 🎉</p>
      )}

      <div className="complete-actions">
        <button className="btn btn-primary" onClick={again}>
          다시 회독하기
        </button>
        {deck === TEST_DECK && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              const label = getProgress().decks[TEST_DECK]?.label ?? '테스트';
              startDeck(TEST_DECK, result.wordIds, { once: true, label: toTestLabel(label) });
              navigate(`/study/${TEST_DECK}`, { replace: true });
            }}
          >
            같은 범위 테스트하기
          </button>
        )}
        {next && (
          <button className="btn btn-secondary" onClick={() => navigate(`/study/${chapterDeck(next.id)}`, { replace: true })}>
            다음 챕터 ({next.title})
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => navigate('/', { replace: true })}>
          홈으로
        </button>
      </div>
    </div>
  );
}
