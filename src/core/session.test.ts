import { describe, expect, it } from 'vitest';
import {
  answer,
  createSession,
  currentWordId,
  deserializeSession,
  firstTryKnownCount,
  IDLE_CAP_MS,
  isComplete,
  knownCount,
  missedWords,
  remainingCount,
  serializeSession,
  undo,
  type Answer,
  type Rng,
  type Session,
} from './session';

/** 결정적인 난수 (mulberry32) */
function seeded(seed: number): Rng {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** 정책 함수에 따라 세션을 끝까지 진행하고 본 단어 순서를 반환 */
function run(s: Session, policy: (id: number, seen: number) => Answer, rng: Rng, limit = 10_000) {
  const shown: number[] = [];
  const seenCount = new Map<number, number>();
  let cur = s;
  while (!isComplete(cur) && shown.length < limit) {
    const id = currentWordId(cur)!;
    shown.push(id);
    const seen = (seenCount.get(id) ?? 0) + 1;
    seenCount.set(id, seen);
    cur = answer(cur, policy(id, seen), { rng, now: 0 });
  }
  return { shown, final: cur };
}

describe('createSession', () => {
  it('챕터 단어 전체를 섞어서 대기열을 만든다', () => {
    const s = createSession(ids(30), { rng: seeded(1), now: 0 });
    expect(s.queue).toHaveLength(30);
    expect([...s.queue].sort((a, b) => a - b)).toEqual(ids(30));
    expect(s.queue).not.toEqual(ids(30));
    expect(s.round).toBe(1);
    expect(remainingCount(s)).toBe(30);
  });

  it('섞기를 끄면 원래 순서를 유지한다', () => {
    const s = createSession(ids(5), { shuffle: false, now: 0 });
    expect(s.queue).toEqual(ids(5));
  });
});

describe('answer', () => {
  it('알고있음을 누른 단어는 다시 나오지 않는다', () => {
    const rng = seeded(2);
    const s = createSession(ids(30), { rng, now: 0 });
    const knownSet = new Set([1, 5, 9, 12, 20, 30]);
    const { shown } = run(s, (id, seen) => (knownSet.has(id) || seen >= 3 ? 'known' : 'unknown'), rng);
    for (const id of knownSet) {
      expect(shown.filter((x) => x === id)).toHaveLength(1);
    }
  });

  it('모르겠음을 누른 단어는 알고있음을 누를 때까지 계속 나온다', () => {
    const rng = seeded(3);
    let s = createSession(ids(10), { rng, now: 0 });
    // 단어 4는 6번째에야 알게 된다
    const { shown, final } = run(s, (id, seen) => (id === 4 && seen < 6 ? 'unknown' : 'known'), rng);
    expect(shown.filter((x) => x === 4)).toHaveLength(6);
    expect(isComplete(final)).toBe(true);
    expect(final.missCounts[4]).toBe(5);

    // 계속 모르겠음만 누르면 대기열이 절대 비지 않는다
    s = createSession(ids(3), { rng, now: 0 });
    const never = run(s, () => 'unknown', rng, 300);
    expect(never.shown).toHaveLength(300);
    expect(isComplete(never.final)).toBe(false);
    expect(remainingCount(never.final)).toBe(3);
  });

  it('모르겠음 단어는 이번 바퀴의 남은 단어 뒤로 가고, 바퀴가 끝나면 다음 바퀴가 시작된다', () => {
    let s = createSession([1, 2, 3, 4], { shuffle: false, now: 0 });
    s = answer(s, 'unknown'); // 1
    expect(s.queue).toEqual([2, 3, 4]);
    expect(s.pending).toEqual([1]);
    s = answer(s, 'known'); // 2
    s = answer(s, 'unknown'); // 3
    expect(s.round).toBe(1);
    s = answer(s, 'known'); // 4 -> 1바퀴 종료
    expect(s.round).toBe(2);
    expect(s.queue).toEqual([1, 3]);
    expect(s.pending).toEqual([]);
    expect(remainingCount(s)).toBe(2);
    expect(knownCount(s)).toBe(2);
  });

  it('같은 단어가 바로 연달아 나오지 않는다', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seeded(seed);
      const s = createSession(ids(seed % 2 ? 6 : 3), { rng, now: 0 });
      // 각 단어를 무작위로 몇 번 틀린다
      const { shown } = run(s, () => (rng() < 0.6 ? 'unknown' : 'known'), rng);
      for (let i = 1; i < shown.length; i++) {
        if (shown[i] === shown[i - 1]) {
          // 연속은 남은 단어가 그것 하나뿐일 때만 허용
          const rest = new Set(shown.slice(i));
          expect(rest.size).toBe(1);
        }
      }
    }
  });

  it('남은 단어가 하나뿐이면 같은 단어가 계속 나온다', () => {
    let s = createSession([7], { now: 0 });
    s = answer(s, 'unknown');
    expect(currentWordId(s)).toBe(7);
    expect(s.round).toBe(2);
    s = answer(s, 'known');
    expect(isComplete(s)).toBe(true);
  });

  it('입력 상태를 변경하지 않는다', () => {
    const s = createSession(ids(5), { rng: seeded(4), now: 0 });
    const snapshot = JSON.stringify(s);
    answer(s, 'unknown', { rng: seeded(5), now: 10 });
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('완료 통계: 바로 안 단어 수와 많이 틀린 순 목록', () => {
    let s = createSession([1, 2, 3], { shuffle: false, now: 0 });
    s = answer(s, 'unknown'); // 1
    s = answer(s, 'known'); // 2
    s = answer(s, 'unknown'); // 3 -> 2바퀴 [1,3]
    while (!isComplete(s)) {
      const id = currentWordId(s)!;
      s = answer(s, id === 3 && (s.missCounts[3] ?? 0) < 3 ? 'unknown' : 'known');
    }
    expect(firstTryKnownCount(s)).toBe(1);
    expect(missedWords(s)).toEqual([
      { wordId: 3, count: 3 },
      { wordId: 1, count: 1 },
    ]);
  });

  it('학습 시간은 자리를 비운 시간을 잘라서 더한다', () => {
    let s = createSession([1, 2, 3], { shuffle: false, now: 1000 });
    s = answer(s, 'known', { now: 4000 });
    expect(s.activeMs).toBe(3000);
    s = answer(s, 'known', { now: 4000 + 10 * 60_000 });
    expect(s.activeMs).toBe(3000 + IDLE_CAP_MS);
  });
});

describe('undo', () => {
  it('직전 답 1개를 취소한다 (알고있음)', () => {
    const s0 = createSession(ids(5), { shuffle: false, now: 0 });
    const s1 = answer(s0, 'known');
    const r = undo(s1)!;
    expect(r.undone).toMatchObject({ wordId: 1, answer: 'known' });
    expect(r.session.queue).toEqual(s0.queue);
    expect(currentWordId(r.session)).toBe(1);
    expect(r.session.history).toEqual([]);
  });

  it('직전 답 1개를 취소한다 (모르겠음, 틀린 횟수도 복구)', () => {
    const s0 = createSession(ids(5), { shuffle: false, now: 0 });
    const s1 = answer(s0, 'unknown');
    expect(s1.missCounts[1]).toBe(1);
    const r = undo(s1)!;
    expect(r.session.missCounts[1]).toBeUndefined();
    expect(r.session.pending).toEqual([]);
    expect(r.session.queue).toEqual(ids(5));
  });

  it('바퀴가 넘어간 직후에도 이전 바퀴로 되돌린다', () => {
    let s = createSession([1, 2], { shuffle: false, now: 0 });
    s = answer(s, 'unknown');
    const before = s;
    s = answer(s, 'unknown'); // 2바퀴 시작
    expect(s.round).toBe(2);
    const r = undo(s)!;
    expect(r.session.round).toBe(1);
    expect(r.session.queue).toEqual(before.queue);
    expect(r.session.pending).toEqual(before.pending);
  });

  it('여러 번 연속으로 되돌릴 수 있다 (c → b → a)', () => {
    let s = createSession([1, 2, 3], { shuffle: false, now: 0 });
    expect(undo(s)).toBeNull();
    s = answer(answer(answer(s, 'known'), 'unknown'), 'known'); // a, b, c
    let r = undo(s)!;
    expect(r.undone.wordId).toBe(3);
    expect(currentWordId(r.session)).toBe(3);
    r = undo(r.session)!;
    expect(r.undone.wordId).toBe(2);
    expect(currentWordId(r.session)).toBe(2);
    expect(r.session.missCounts[2]).toBeUndefined();
    r = undo(r.session)!;
    expect(r.undone.wordId).toBe(1);
    expect(currentWordId(r.session)).toBe(1);
    expect(remainingCount(r.session)).toBe(3);
    expect(undo(r.session)).toBeNull();
  });

  it('여러 바퀴를 진행한 뒤 끝까지 되돌리면 처음 상태로 돌아간다', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = seeded(seed);
      const s0 = createSession(ids(8), { rng, now: 0 });
      let s = s0;
      const states = [s0];
      for (let i = 0; i < 40 && !isComplete(s); i++) {
        s = answer(s, rng() < 0.5 ? 'unknown' : 'known', { rng, now: 0 });
        states.push(s);
      }
      // 한 단계씩 되돌리며 각 단계의 상태와 일치하는지 확인
      for (let k = states.length - 2; k >= 0; k--) {
        s = undo(s, { now: 0 })!.session;
        const want = states[k];
        expect([s.queue, s.pending, s.round, s.missCounts]).toEqual([want.queue, want.pending, want.round, want.missCounts]);
      }
      expect(undo(s)).toBeNull();
    }
  });

  it('완료 직후에도 마지막 답을 되돌릴 수 있다', () => {
    let s = createSession([1], { now: 0 });
    s = answer(s, 'known');
    expect(isComplete(s)).toBe(true);
    const r = undo(s)!;
    expect(currentWordId(r.session)).toBe(1);
  });
});

describe('저장 후 복원', () => {
  it('직렬화 후 복원하면 같은 상태로 이어서 진행된다', () => {
    const rng = seeded(9);
    let s = createSession(ids(30), { rng, now: 0 });
    for (let i = 0; i < 17; i++) s = answer(s, i % 3 === 0 ? 'unknown' : 'known', { rng, now: i * 1000 });

    const restored = deserializeSession(serializeSession(s))!;
    expect(restored).toEqual(s);
    expect(remainingCount(restored)).toBe(remainingCount(s));
    expect(currentWordId(restored)).toBe(currentWordId(s));

    // 복원된 세션에서 되돌리기도 동작한다
    const r = undo(restored)!;
    expect(currentWordId(r.session)).toBe(s.history[s.history.length - 1].wordId);
    expect(remainingCount(r.session)).toBeGreaterThanOrEqual(remainingCount(s));

    // 같은 난수로 이어가면 원본과 같은 결과
    const a = run(s, () => 'known', seeded(1));
    const b = run(restored, () => 'known', seeded(1));
    expect(b.shown).toEqual(a.shown);
  });

  it('손상된 데이터는 null을 반환한다', () => {
    expect(deserializeSession('not json')).toBeNull();
    expect(deserializeSession('{}')).toBeNull();
    expect(deserializeSession(JSON.stringify({ wordIds: [1], queue: [2], pending: [], round: 1 }))).toBeNull();
  });
});
