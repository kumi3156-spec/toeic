import { describe, expect, it } from 'vitest';
import { answer, createSession } from '../core/session';
import { applyLayout, bumpWord, emptyProgress, exportJson, importJson, logAnswer, logCompletion, missesSince, resetDeck, updateDeck } from './progress';

describe('progress', () => {
  it('내보낸 JSON을 다시 불러오면 같은 기록이 된다 (진행 중 세션 포함)', () => {
    let p = emptyProgress();
    let s = createSession([1, 2, 3], { now: 0 });
    s = answer(s, 'unknown', { now: 10 });
    p = updateDeck(p, 'ch-1', (d) => ({ ...d, readCount: 2, lastStudiedAt: 5, session: s }));
    p = bumpWord(p, 1, 1, '2026-01-01');
    p = { ...p, lastDeck: 'ch-1', settings: { ...p.settings, autoSpeak: true } };

    const back = importJson(exportJson(p));
    expect(back).toEqual(p);
  });

  it('형식이 아닌 파일은 거부한다', () => {
    expect(importJson('hello')).toBeNull();
    expect(importJson('{"version":2,"decks":{},"words":{}}')).toBeNull();
  });

  it('챕터 초기화는 해당 챕터와 그 단어 기록만 지운다', () => {
    let p = emptyProgress();
    p = updateDeck(p, 'ch-1', (d) => ({ ...d, readCount: 1 }));
    p = updateDeck(p, 'ch-2', (d) => ({ ...d, readCount: 3 }));
    p = bumpWord(bumpWord(p, 1, 1), 40, 2);
    p = resetDeck(p, 'ch-1', [1, 2]);
    expect(p.decks['ch-1']).toBeUndefined();
    expect(p.decks['ch-2'].readCount).toBe(3);
    expect(p.words[1]).toBeUndefined();
    expect(p.words[40].miss).toBe(2);
  });

  it('챕터 구성이 바뀌면 챕터 기록만 지우고 단어 기록·자주 틀리는 단어 학습은 남긴다', () => {
    let p = emptyProgress();
    p = updateDeck(p, 'ch-1', (d) => ({ ...d, readCount: 2, session: createSession([1, 2], { now: 0 }) }));
    p = updateDeck(p, 'weak', (d) => ({ ...d, session: createSession([5], { now: 0 }) }));
    p = bumpWord(p, 1, 3);
    p = { ...p, lastDeck: 'ch-1' };
    const q = applyLayout(p, 3);
    expect(q.decks['ch-1']).toBeUndefined();
    expect(q.decks.weak.session).toBeDefined();
    expect(q.words[1].miss).toBe(3);
    expect(q.lastDeck).toBeUndefined();
    expect(q.layout).toBe(3);
    expect(applyLayout(q, 3)).toBe(q);
  });

  it('학습 기록: 날짜별 학습량을 쌓고 되돌리면 카드 수를 뺀다, 내보내기/불러오기에 포함된다', () => {
    let p = emptyProgress();
    p = logAnswer(p, 3000, 1, '2026-11-18');
    p = logAnswer(p, 2000, 1, '2026-11-18');
    p = logAnswer(p, 0, -1, '2026-11-18');
    expect(p.daily['2026-11-18']).toEqual({ answers: 1, ms: 5000 });
    p = logCompletion(p, { deck: 'ch-3', title: 'Day 3', finishedAt: 1, elapsedMs: 60000, rounds: 2, total: 30, firstTryKnown: 20, readCount: 1 });
    const back = importJson(exportJson(p))!;
    expect(back.daily).toEqual(p.daily);
    expect(back.history).toEqual(p.history);
    // 예전 형식(기록 필드 없음)도 불러올 수 있다
    expect(importJson(JSON.stringify({ version: 1, decks: {}, words: {} }))!.history).toEqual([]);
  });

  it('기간을 정하면 그 날짜 이후에 틀린 횟수만 센다', () => {
    let p = emptyProgress();
    // 날짜별 기록이 생기기 전에 쌓인 옛 데이터 (10월에 3번 틀림)
    p = { ...p, words: { 7: { miss: 3, lastSeen: '2026-10-02' }, 8: { miss: 2, lastSeen: '2026-11-16' } } };
    p = bumpWord(p, 7, 1, '2026-11-16');
    p = bumpWord(p, 7, 1, '2026-11-17');
    p = bumpWord(p, 9, 1, '2026-11-10');
    expect(missesSince(p.words[7], '')).toBe(5);
    expect(missesSince(p.words[7], '2026-11-15')).toBe(2);
    expect(missesSince(p.words[9], '2026-11-15')).toBe(0);
    // 옛 데이터는 마지막으로 본 날짜 기준으로 근사
    expect(missesSince(p.words[8], '2026-11-15')).toBe(2);
    // 되돌리면 그날 기록에서 뺀다
    p = bumpWord(p, 7, -1, '2026-11-17');
    expect(missesSince(p.words[7], '2026-11-15')).toBe(1);
    expect(importJson(exportJson(p))!.words[7].missDays).toEqual({ '2026-11-16': 1 });
  });
});
