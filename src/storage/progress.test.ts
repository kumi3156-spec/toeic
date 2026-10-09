import { describe, expect, it } from 'vitest';
import { answer, createSession } from '../core/session';
import { bumpWord, emptyProgress, exportJson, importJson, resetDeck, updateDeck } from './progress';

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
});
