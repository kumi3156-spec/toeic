import { useMemo, useState } from 'react';
import { useProgress } from '../app/useProgress';
import { IconCalendar, IconChevron, IconFlame, IconSettings } from '../components/Icons';
import { remainingCount } from '../core/session';
import type { Chapter, Vocab } from '../data/vocab';
import { navigate } from '../lib/router';
import { chapterDeck, deckChapterId, safeGet, safeSet, TEST_DECK, WEAK_DECK, type Progress } from '../storage/progress';

const OPEN_KEY = 'hoedok:ui:openLevels';

function loadOpenLevels(): number[] | null {
  try {
    const v = JSON.parse(safeGet(OPEN_KEY) ?? 'null');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'number') : null;
  } catch {
    return null;
  }
}

/** "이어서 학습" 대상: 진행 중이면 그 덱, 마지막 챕터를 끝냈으면 다음 챕터 */
function continueTarget(vocab: Vocab, p: Progress): { deck: string; label: string; sub: string } {
  let last = p.lastDeck;
  if (last) {
    const rec = p.decks[last];
    if (rec?.session) {
      const title =
        last === WEAK_DECK
          ? '자주 틀리는 단어'
          : last === TEST_DECK
            ? rec.label ?? '테스트'
            : vocab.chapterById.get(deckChapterId(last) ?? -1)?.title;
      if (title) {
        const left = remainingCount(rec.session);
        return {
          deck: last,
          label: `${title} 이어하기`,
          sub: rec.session.once ? `남은 문제 ${left}개` : `${rec.session.round}바퀴째 · 남은 단어 ${left}개`,
        };
      }
    }
  }
  // 마지막 학습이 챕터가 아니면 (테스트·자주 틀리는 단어) 가장 최근에 공부한 챕터 기준
  if (last && deckChapterId(last) === null) {
    last = Object.entries(p.decks)
      .filter(([deck]) => deckChapterId(deck) !== null)
      .sort((a, b) => (b[1].lastStudiedAt ?? 0) - (a[1].lastStudiedAt ?? 0))[0]?.[0];
  }
  if (last) {
    const rec = p.decks[last];
    const id = deckChapterId(last);
    if (id !== null && vocab.chapterById.has(id)) {
      const idx = vocab.chapters.findIndex((c) => c.id === id);
      const next = (rec?.readCount ?? 0) > 0 ? vocab.chapters[idx + 1] ?? vocab.chapters[idx] : vocab.chapters[idx];
      return { deck: chapterDeck(next.id), label: `${next.title} 시작하기`, sub: `${next.count}단어 · ${next.levelName}` };
    }
  }
  const first = vocab.chapters[0];
  return { deck: chapterDeck(first.id), label: `${first.title}부터 시작하기`, sub: `${first.count}단어 · ${first.levelName}` };
}

function ChapterCard({ chapter, progress }: { chapter: Chapter; progress: Progress }) {
  const rec = progress.decks[chapterDeck(chapter.id)];
  const reads = rec?.readCount ?? 0;
  const left = rec?.session ? remainingCount(rec.session) : null;
  const isLast = progress.lastDeck === chapterDeck(chapter.id);
  return (
    <button
      className={`ch-card ${left !== null ? 'in-progress' : ''} ${reads > 0 ? 'done' : ''} ${isLast ? 'last' : ''}`}
      onClick={() => navigate(`/study/${chapterDeck(chapter.id)}`)}
    >
      <span className="ch-num">{chapter.id}</span>
      <span className="ch-count">{chapter.count}단어</span>
      {left !== null ? (
        <span className="ch-status resume">이어하기 · {left}개</span>
      ) : reads > 0 ? (
        <span className="ch-status reads">{reads}회독</span>
      ) : (
        <span className="ch-status">&nbsp;</span>
      )}
      {left !== null && reads > 0 && <span className="ch-reads-dot">{reads}</span>}
    </button>
  );
}

export function Home({ vocab }: { vocab: Vocab }) {
  const progress = useProgress();
  const target = continueTarget(vocab, progress);

  const levels = useMemo(
    () =>
      vocab.levels.map((lv) => ({
        ...lv,
        chapters: vocab.chapters.filter((c) => c.level === lv.level),
      })),
    [vocab],
  );

  const [open, setOpen] = useState<number[]>(() => {
    const saved = loadOpenLevels();
    if (saved) return saved;
    const lastCh = vocab.chapterById.get(deckChapterId(progress.lastDeck ?? '') ?? -1);
    return [lastCh?.level ?? levels[0]?.level ?? 1];
  });
  const toggle = (level: number) => {
    const next = open.includes(level) ? open.filter((l) => l !== level) : [...open, level];
    setOpen(next);
    safeSet(OPEN_KEY, JSON.stringify(next));
  };

  const isDone = (c: Chapter) => (progress.decks[chapterDeck(c.id)]?.readCount ?? 0) > 0;
  const doneCount = vocab.chapters.filter(isDone).length;
  // 핵심 레벨(목표 점수용) 진도와 하루 1챕터 기준 완료 예정일
  const coreLevels = new Set(vocab.levels.filter((lv) => lv.core).map((lv) => lv.level));
  const coreChapters = vocab.chapters.filter((c) => coreLevels.has(c.level));
  const coreDone = coreChapters.filter(isDone).length;
  const coreLeft = coreChapters.length - coreDone;
  const finish = new Date();
  finish.setDate(finish.getDate() + Math.max(0, coreLeft - 1));
  const totalReads = vocab.chapters.reduce((sum, c) => sum + (progress.decks[chapterDeck(c.id)]?.readCount ?? 0), 0);
  const total = vocab.chapters.length;

  return (
    <div className="screen home">
      <header className="top-bar">
        <h1 className="app-title">회독 TOEIC</h1>
        <div className="top-actions">
          <button className="icon-btn" onClick={() => navigate('/history')} aria-label="학습 기록">
            <IconCalendar />
          </button>
          <button className="icon-btn" onClick={() => navigate('/weak')} aria-label="자주 틀리는 단어">
            <IconFlame />
          </button>
          <button className="icon-btn" onClick={() => navigate('/settings')} aria-label="설정">
            <IconSettings />
          </button>
        </div>
      </header>

      <button className="continue" onClick={() => navigate(`/study/${target.deck}`)}>
        <span className="continue-kicker">이어서 학습</span>
        <span className="continue-title">{target.label}</span>
        <span className="continue-sub">{target.sub}</span>
        <span className="continue-arrow" aria-hidden>
          →
        </span>
      </button>

      <button className="home-test" onClick={() => navigate('/test')}>
        <span>
          여러 Day 골라서 회독·테스트
          <small>배운 Day를 한 번에 복습하거나 점검하기</small>
        </span>
        <span aria-hidden>→</span>
      </button>

      <section className="overall">
        {coreChapters.length > 0 && (
          <>
            <div className="overall-row">
              <span>핵심 진도 (Lv.1~3)</span>
              <span>
                <b>{coreDone}</b> / {coreChapters.length}일
              </span>
            </div>
            <div className="bar">
              <i style={{ width: `${(coreDone / coreChapters.length) * 100}%` }} />
            </div>
            <p className="plan-note">
              {coreLeft > 0
                ? `하루 1챕터씩 하면 ${finish.getMonth() + 1}월 ${finish.getDate()}일에 핵심 완료 (남은 ${coreLeft}일)`
                : '핵심 레벨 완료! 보충 레벨과 자주 틀리는 단어로 복습하세요'}
            </p>
          </>
        )}
        <div className="overall-row">
          <span>전체</span>
          <span>
            <b>{doneCount}</b> / {total} 챕터 · 누적 {totalReads}회독
          </span>
        </div>
      </section>

      {levels.map((lv) => {
        const isOpen = open.includes(lv.level);
        const lvDone = lv.chapters.filter((c) => (progress.decks[chapterDeck(c.id)]?.readCount ?? 0) > 0).length;
        const first = lv.chapters[0]?.id;
        const last = lv.chapters[lv.chapters.length - 1]?.id;
        return (
          <section className="level" key={lv.level}>
            <button className="level-head" onClick={() => toggle(lv.level)} aria-expanded={isOpen}>
              <span className="level-badge">Lv.{lv.level}</span>
              <span className="level-name">
                {lv.name}
                <small>
                  Day {first}–{last}
                  {lv.core === false && ' · 선택'}
                </small>
              </span>
              <span className="level-count">
                {lvDone}/{lv.chapters.length}
              </span>
              <IconChevron open={isOpen} />
            </button>
            {isOpen && (
              <div className="ch-grid">
                {lv.chapters.map((c) => (
                  <ChapterCard key={c.id} chapter={c} progress={progress} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
