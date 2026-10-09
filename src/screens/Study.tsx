import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  completeDeck,
  deckTitle,
  getSession,
  recordAnswer,
  resumeDeck,
  startChapter,
  undoAnswer,
} from '../app/actions';
import { useProgress } from '../app/useProgress';
import { IconClose, IconSpeaker, IconUndo } from '../components/Icons';
import { WordDetail } from '../components/WordDetail';
import { currentWordId, isComplete, knownCount, remainingCount, type Answer } from '../core/session';
import { posLabel, type Vocab } from '../data/vocab';
import { navigate } from '../lib/router';
import { speak, speechSupported } from '../lib/speech';
import { deckChapterId, WEAK_DECK } from '../storage/progress';

type Phase = { kind: 'question' } | { kind: 'unknown'; wordId: number };

const SWIPE_THRESHOLD = 80;

function wordSizeClass(word: string) {
  if (word.length <= 10) return 'word-xl';
  if (word.length <= 16) return 'word-lg';
  return 'word-md';
}

function vibrate() {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* 미지원 */
  }
}

export function Study({ vocab, deck }: { vocab: Vocab; deck: string }) {
  const progress = useProgress();
  const session = progress.decks[deck]?.session;
  const settings = progress.settings;

  const [phase, setPhase] = useState<Phase>({ kind: 'question' });
  const [cardKey, setCardKey] = useState(0);
  // 카드를 탭하면 영어 단어 아래에 뜻을 보여줌
  const [peek, setPeek] = useState(false);
  const [flash, setFlash] = useState<Answer | null>(null);
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const flashTimer = useRef<number>();
  // 스와이프 직후 따라오는 click 이벤트가 뜻 보기를 토글하지 않도록
  const swipedAt = useRef(0);

  const finish = useCallback(() => {
    if (completeDeck(deck)) navigate(`/done/${deck}`, { replace: true });
  }, [deck]);

  // 시작 또는 이어하기
  useEffect(() => {
    const s = getSession(deck);
    if (!s) {
      const ch = deckChapterId(deck);
      if (ch !== null && vocab.chapterById.has(ch)) startChapter(vocab, ch);
      else navigate(deck === WEAK_DECK ? '/weak' : '/', { replace: true });
    } else if (isComplete(s)) {
      finish();
    } else {
      resumeDeck(deck);
    }
    setPhase({ kind: 'question' });
    setPeek(false);
  }, [deck, vocab, finish]);

  const nextQuestion = useCallback(() => {
    const s = getSession(deck);
    if (s && isComplete(s)) {
      finish();
      return;
    }
    setPhase({ kind: 'question' });
    setPeek(false);
    setCardKey((k) => k + 1);
  }, [deck, finish]);

  const onAnswer = useCallback(
    (ans: Answer) => {
      if (phase.kind !== 'question') return;
      const s = getSession(deck);
      const id = s ? currentWordId(s) : null;
      if (id === null) return;
      recordAnswer(deck, ans);
      vibrate();
      setFlash(ans);
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 320);
      if (ans === 'unknown') setPhase({ kind: 'unknown', wordId: id });
      else nextQuestion();
    },
    [deck, phase.kind, nextQuestion],
  );

  const onUndo = useCallback(() => {
    if (undoAnswer(deck)) {
      setPhase({ kind: 'question' });
      setPeek(false);
      setCardKey((k) => k + 1);
      setDx(0);
    }
  }, [deck]);

  const wordId = phase.kind === 'question' ? (session ? currentWordId(session) : null) : phase.wordId;
  const word = wordId !== null ? vocab.wordById.get(wordId) : undefined;

  // 자동 발음
  useEffect(() => {
    if (phase.kind === 'question' && settings.autoSpeak && word) speak(word.word);
  }, [phase.kind, word, settings.autoSpeak, cardKey]);

  const togglePeek = useCallback(() => {
    if (phase.kind === 'question' && Date.now() - swipedAt.current > 400) setPeek((v) => !v);
  }, [phase.kind]);

  // 키보드 (PC에서 확인용): ← 모르겠음, → 알고있음, Space 뜻 보기 / 다음, Z 되돌리기
  const keyRef = useRef({ onAnswer, nextQuestion, onUndo, togglePeek, phase });
  keyRef.current = { onAnswer, nextQuestion, onUndo, togglePeek, phase };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keyRef.current;
      if (e.key === 'ArrowLeft') k.onAnswer('unknown');
      else if (e.key === 'ArrowRight') k.onAnswer('known');
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (k.phase.kind === 'question') k.togglePeek();
        else k.nextQuestion();
      } else if (e.key === 'z' || e.key === 'Backspace') k.onUndo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 스와이프
  const onPointerDown = (e: PointerEvent) => {
    if (phase.kind !== 'question') return;
    drag.current = { x: e.clientX, y: e.clientY, active: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(mx) < 10 || Math.abs(mx) < Math.abs(my)) return;
      d.active = true;
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        /* 무시 */
      }
    }
    setDx(mx);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    swipedAt.current = Date.now();
    if (dx > SWIPE_THRESHOLD) onAnswer('known');
    else if (dx < -SWIPE_THRESHOLD) onAnswer('unknown');
    setDx(0);
  };
  const onPointerCancel = () => {
    drag.current = null;
    setDx(0);
  };

  if (!session) return <div className="screen center muted">불러오는 중…</div>;

  const total = session.wordIds.length;
  const remaining = remainingCount(session);
  const pct = total ? (knownCount(session) / total) * 100 : 0;
  const title = deckTitle(vocab, deck);
  const chapter = vocab.chapterById.get(deckChapterId(deck) ?? -1);
  const swipeHint = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD);

  return (
    <div className="study">
      <header className="study-head">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="나가기">
          <IconClose />
        </button>
        <div className="study-title">
          <strong>{title}</strong>
          {chapter && <small>{chapter.levelName}</small>}
        </div>
        <button className="icon-btn" onClick={onUndo} disabled={!session.undo} aria-label="되돌리기">
          <IconUndo />
        </button>
      </header>

      <div className="study-progress">
        <div className="study-progress-text">
          <span className={session.round > 1 ? 'round-badge on' : 'round-badge'}>{session.round}바퀴째</span>
          <span>
            남은 단어 <b>{remaining}</b> / {total}
          </span>
        </div>
        <div className="bar">
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>

      <main className="stage">
        {word && (
          <div key={cardKey} className="card-wrap card-enter">
          <div
            className={`card ${phase.kind === 'unknown' ? 'card-open' : ''} ${
              flash === 'unknown' ? 'flash-unknown' : ''
            } ${dx !== 0 ? 'dragging' : ''}`}
            style={dx ? { transform: `translateX(${dx}px) rotate(${dx / 25}deg)` } : undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onClick={togglePeek}
          >
            {dx !== 0 && (
              <div className={`swipe-label ${dx > 0 ? 'known' : 'unknown'}`} style={{ opacity: swipeHint }}>
                {dx > 0 ? '알고있음' : '모르겠음'}
              </div>
            )}
            <div className="card-front">
              <span className="pos">{posLabel(word.pos)}</span>
              <h1 className={`word ${wordSizeClass(word.word)}`} lang="en">
                {word.word}
              </h1>
              {speechSupported && (
                <button
                  className="speak-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    speak(word.word);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="발음 듣기"
                >
                  <IconSpeaker />
                </button>
              )}
              {phase.kind === 'question' &&
                (peek ? (
                  <p className="quick-meaning">{word.meaning}</p>
                ) : (
                  <p className="peek-hint">탭해서 뜻 보기</p>
                ))}
            </div>
            {phase.kind === 'unknown' && <WordDetail word={word} />}
          </div>
          </div>
        )}
      </main>

      <footer className="answer-bar">
        {phase.kind === 'unknown' ? (
          <button className="btn btn-next" onClick={nextQuestion} autoFocus>
            다음
          </button>
        ) : (
          <>
            <button
              className={`btn btn-unknown ${flash === 'unknown' ? 'pop' : ''}`}
              onClick={() => onAnswer('unknown')}
            >
              모르겠음
            </button>
            <button className={`btn btn-known ${flash === 'known' ? 'pop' : ''}`} onClick={() => onAnswer('known')}>
              알고있음
            </button>
          </>
        )}
      </footer>
    </div>
  );
}
