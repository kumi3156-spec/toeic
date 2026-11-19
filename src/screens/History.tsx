import { useMemo } from 'react';
import { useProgress } from '../app/useProgress';
import { IconBack } from '../components/Icons';
import { navigate } from '../lib/router';
import { deckChapterId, todayString, type HistoryEntry } from '../storage/progress';

const WEEKS = 12;
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatMinutes(ms: number) {
  if (ms > 0 && ms < 60000) return '1분 미만';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}

function formatDuration(ms: number) {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  return m > 0 ? `${m}분 ${sec % 60}초` : `${sec}초`;
}

function level(answers: number) {
  if (answers <= 0) return 0;
  if (answers < 30) return 1;
  if (answers < 60) return 2;
  if (answers < 120) return 3;
  return 4;
}

export function History() {
  const progress = useProgress();
  const { daily, history } = progress;

  const byDay = useMemo(() => {
    const m = new Map<string, HistoryEntry[]>();
    for (const h of history) {
      const day = todayString(new Date(h.finishedAt));
      const list = m.get(day);
      if (list) list.push(h);
      else m.set(day, [h]);
    }
    return m;
  }, [history]);

  const studied = (day: string) => (daily[day]?.answers ?? 0) > 0 || byDay.has(day);
  const days = [...new Set([...Object.keys(daily).filter((d) => daily[d].answers > 0), ...byDay.keys()])].sort().reverse();

  // 연속 학습일: 오늘(아직 안 했으면 어제)부터 거꾸로
  const today = new Date();
  let streak = 0;
  let cursor = studied(todayString(today)) ? today : addDays(today, -1);
  while (studied(todayString(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  const totalMs = Object.values(daily).reduce((s, d) => s + d.ms, 0);
  const totalAnswers = Object.values(daily).reduce((s, d) => s + d.answers, 0);

  // 최근 12주 달력 (열 = 주, 행 = 요일)
  const gridStart = addDays(today, -today.getDay() - (WEEKS - 1) * 7);
  const cells: { day: string; lv: number; future: boolean }[] = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = addDays(gridStart, i);
    const key = todayString(d);
    cells.push({ day: key, lv: level(daily[key]?.answers ?? 0) || (byDay.has(key) ? 1 : 0), future: d > today });
  }

  return (
    <div className="screen">
      <header className="top-bar">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="뒤로">
          <IconBack />
        </button>
        <h1 className="page-title">학습 기록</h1>
        <span className="icon-btn-spacer" />
      </header>

      <div className="stats stats-4">
        <div className="stat">
          <span className="stat-label">연속 학습</span>
          <span className="stat-value">{streak}일</span>
        </div>
        <div className="stat">
          <span className="stat-label">학습한 날</span>
          <span className="stat-value">{days.length}일</span>
        </div>
        <div className="stat">
          <span className="stat-label">총 학습 시간</span>
          <span className="stat-value">{formatMinutes(totalMs)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">완료한 회독</span>
          <span className="stat-value">{history.length}번</span>
        </div>
      </div>

      <h2 className="section-title">최근 {WEEKS}주</h2>
      <section className="panel heat-panel">
        <div className="heat">
          <div className="heat-dow">
            {DOW.map((d, i) => (
              <span key={d}>{i % 2 === 1 ? d : ''}</span>
            ))}
          </div>
          <div className="heat-grid">
            {cells.map((c) => (
              <span
                key={c.day}
                className={`heat-cell lv${c.lv} ${c.future ? 'future' : ''} ${c.day === todayString(today) ? 'today' : ''}`}
                title={`${c.day} · 카드 ${daily[c.day]?.answers ?? 0}장`}
              />
            ))}
          </div>
        </div>
        <div className="heat-legend">
          <span>적음</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`heat-cell lv${l}`} />
          ))}
          <span>많음</span>
        </div>
        <p className="field-desc">총 {totalAnswers.toLocaleString()}장의 카드를 넘겼어요</p>
      </section>

      <h2 className="section-title">날짜별 기록</h2>
      {days.length === 0 ? (
        <div className="empty">
          <p>아직 기록이 없어요.</p>
          <p className="muted">단어를 학습하면 여기에 날짜별로 쌓여요.</p>
        </div>
      ) : (
        <ul className="history-list">
          {days.map((day) => {
            const d = new Date(`${day}T00:00:00`);
            const stat = daily[day];
            const done = byDay.get(day) ?? [];
            return (
              <li key={day} className="history-day">
                <div className="history-head">
                  <strong>
                    {d.getMonth() + 1}월 {d.getDate()}일 ({DOW[d.getDay()]})
                  </strong>
                  <span className="muted">
                    {stat ? `카드 ${stat.answers}장 · ${formatMinutes(stat.ms)}` : ''}
                  </span>
                </div>
                {done.length > 0 && (
                  <div className="history-done">
                    {done.map((h) => (
                      <span key={h.finishedAt} className="done-chip">
                        <b>{h.title}</b>{' '}
                        {h.once
                          ? `정답 ${h.firstTryKnown}/${h.total} · ${formatDuration(h.elapsedMs)}`
                          : `${deckChapterId(h.deck) !== null ? `${h.readCount}회독 · ` : ''}${formatDuration(h.elapsedMs)} · 바로 안 단어 ${h.firstTryKnown}/${h.total}`}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
