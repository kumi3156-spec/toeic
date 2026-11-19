import { useMemo, useState } from 'react';
import { formatDays, startTest } from '../app/actions';
import { useProgress } from '../app/useProgress';
import { IconBack } from '../components/Icons';
import { remainingCount } from '../core/session';
import type { Vocab } from '../data/vocab';
import { navigate } from '../lib/router';
import { chapterDeck, TEST_DECK } from '../storage/progress';

const LIMITS = [0, 30, 50, 100] as const; // 0 = 전체

export function Test({ vocab }: { vocab: Vocab }) {
  const progress = useProgress();
  const session = progress.decks[TEST_DECK]?.session;
  const [selected, setSelected] = useState<number[]>([]);
  const [limit, setLimit] = useState<number>(0);

  const done = useMemo(
    () => vocab.chapters.filter((c) => (progress.decks[chapterDeck(c.id)]?.readCount ?? 0) > 0).map((c) => c.id),
    [vocab, progress.decks],
  );
  const recent = useMemo(
    () =>
      [...done]
        .sort((a, b) => (progress.decks[chapterDeck(b)]?.lastStudiedAt ?? 0) - (progress.decks[chapterDeck(a)]?.lastStudiedAt ?? 0))
        .slice(0, 5),
    [done, progress.decks],
  );

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const wordCount = selected.reduce((n, id) => n + (vocab.wordIdsByChapter.get(id)?.length ?? 0), 0);
  const questions = limit > 0 ? Math.min(limit, wordCount) : wordCount;

  const start = () => {
    if (questions === 0) return;
    if (session && !window.confirm('진행 중인 테스트가 있어요. 새로 시작할까요?')) return;
    startTest(vocab, selected, limit);
    navigate(`/study/${TEST_DECK}`);
  };

  return (
    <div className="screen test-screen">
      <header className="top-bar">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="뒤로">
          <IconBack />
        </button>
        <h1 className="page-title">Day 골라서 테스트</h1>
        <span className="icon-btn-spacer" />
      </header>

      {session && (
        <button className="continue" onClick={() => navigate(`/study/${TEST_DECK}`)}>
          <span className="continue-kicker">진행 중인 테스트</span>
          <span className="continue-title">{progress.decks[TEST_DECK]?.label ?? '테스트'}</span>
          <span className="continue-sub">남은 문제 {remainingCount(session)}개</span>
          <span className="continue-arrow" aria-hidden>
            →
          </span>
        </button>
      )}

      <p className="field-desc test-desc">
        고른 Day의 단어를 한 번씩만 보고 맞힌 개수를 확인해요. 틀린 단어는 끝난 뒤 다시 테스트하거나 회독할 수 있어요.
      </p>

      <section className="panel">
        <div className="field">
          <span className="field-label">빠른 선택</span>
          <div className="quick-row">
            <button className="chip-btn" onClick={() => setSelected(recent)} disabled={recent.length === 0}>
              최근 완료 5개
            </button>
            <button className="chip-btn" onClick={() => setSelected(done)} disabled={done.length === 0}>
              완료한 Day 전체 ({done.length})
            </button>
            <button className="chip-btn" onClick={() => setSelected([])} disabled={selected.length === 0}>
              선택 해제
            </button>
          </div>
        </div>
        <div className="field">
          <span className="field-label">문제 수</span>
          <div className="segmented">
            {LIMITS.map((n) => (
              <button key={n} className={limit === n ? 'on' : ''} onClick={() => setLimit(n)}>
                {n === 0 ? '전부' : `${n}개`}
              </button>
            ))}
          </div>
          {limit > 0 && <span className="field-desc">고른 Day에서 무작위로 뽑아요</span>}
        </div>
      </section>

      {vocab.levels.map((lv) => {
        const chapters = vocab.chapters.filter((c) => c.level === lv.level);
        return (
          <section key={lv.level} className="test-level">
            <h2 className="section-title">
              Lv.{lv.level} {lv.name}
            </h2>
            <div className="day-grid">
              {chapters.map((c) => {
                const on = selected.includes(c.id);
                const isDone = done.includes(c.id);
                return (
                  <button
                    key={c.id}
                    className={`day-chip ${on ? 'on' : ''} ${isDone ? 'done' : ''}`}
                    onClick={() => toggle(c.id)}
                    aria-pressed={on}
                  >
                    {c.id}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="test-start">
        <button className="btn btn-primary block" onClick={start} disabled={questions === 0}>
          {selected.length === 0 ? 'Day를 골라 주세요' : `${formatDays(selected)} · ${questions}문제 시작`}
        </button>
      </div>
    </div>
  );
}
