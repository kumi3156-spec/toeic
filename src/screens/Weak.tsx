import { useState } from 'react';
import { startDeck, weakWordIds } from '../app/actions';
import { useProgress } from '../app/useProgress';
import { IconBack } from '../components/Icons';
import { remainingCount } from '../core/session';
import type { Vocab } from '../data/vocab';
import { navigate } from '../lib/router';
import { WEAK_DECK } from '../storage/progress';

const SIZES = [20, 30, 50, 0] as const; // 0 = 전체

export function Weak({ vocab }: { vocab: Vocab }) {
  const progress = useProgress();
  const weak = weakWordIds(vocab, progress);
  const [size, setSize] = useState<number>(30);
  const [minMiss, setMinMiss] = useState(1);
  const session = progress.decks[WEAK_DECK]?.session;

  const pool = weak.filter((w) => w.miss >= minMiss);
  const picked = size === 0 ? pool : pool.slice(0, size);

  const start = () => {
    if (picked.length === 0) return;
    if (session && !window.confirm('진행 중인 학습이 있어요. 새로 시작할까요?')) return;
    startDeck(
      WEAK_DECK,
      picked.map((w) => w.wordId),
    );
    navigate(`/study/${WEAK_DECK}`);
  };

  return (
    <div className="screen">
      <header className="top-bar">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="뒤로">
          <IconBack />
        </button>
        <h1 className="page-title">자주 틀리는 단어</h1>
        <span className="icon-btn-spacer" />
      </header>

      {weak.length === 0 ? (
        <div className="empty">
          <p>아직 "모르겠음"을 누른 단어가 없어요.</p>
          <p className="muted">챕터를 학습하면 틀린 단어가 여기에 모여요.</p>
        </div>
      ) : (
        <>
          {session && (
            <button className="continue" onClick={() => navigate(`/study/${WEAK_DECK}`)}>
              <span className="continue-kicker">진행 중</span>
              <span className="continue-title">이어서 학습하기</span>
              <span className="continue-sub">
                {session.round}바퀴째 · 남은 단어 {remainingCount(session)}개
              </span>
              <span className="continue-arrow" aria-hidden>
                →
              </span>
            </button>
          )}

          <section className="panel">
            <div className="field">
              <span className="field-label">단어 수</span>
              <div className="segmented">
                {SIZES.map((n) => (
                  <button key={n} className={size === n ? 'on' : ''} onClick={() => setSize(n)}>
                    {n === 0 ? '전체' : n}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-label">최소 틀린 횟수</span>
              <div className="segmented">
                {[1, 2, 3, 5].map((n) => (
                  <button key={n} className={minMiss === n ? 'on' : ''} onClick={() => setMinMiss(n)}>
                    {n}회+
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary block" onClick={start} disabled={picked.length === 0}>
              {picked.length}단어 {session ? '새로 ' : ''}회독 시작
            </button>
          </section>

          <h2 className="section-title">
            많이 틀린 순 <span className="muted">{pool.length}개</span>
          </h2>
          <ul className="word-list">
            {pool.slice(0, 200).map((w) => {
              const word = vocab.wordById.get(w.wordId)!;
              return (
                <li key={w.wordId}>
                  <span className="wl-word" lang="en">
                    {word.word}
                  </span>
                  <span className="wl-meaning">{word.meaning}</span>
                  <span className="wl-count">×{w.miss}</span>
                </li>
              );
            })}
          </ul>
          {pool.length > 200 && <p className="muted center-text">상위 200개만 표시</p>}
        </>
      )}
    </div>
  );
}
