import { describe, expect, it } from 'vitest';
import { splitHighlight } from './highlight';

const hit = (sentence: string, word: string) =>
  splitHighlight(sentence, word)
    .filter((s) => s.hit)
    .map((s) => s.text)
    .join('');

describe('splitHighlight', () => {
  it('활용형을 찾는다', () => {
    expect(hit('The factory ceased operations last year.', 'cease')).toBe('ceased');
    expect(hit('The baby cried all night.', 'cry')).toBe('cried');
    expect(hit('He applied for the job.', 'apply')).toBe('applied');
    expect(hit('He finally gave in to their demands.', 'give in')).toBe('gave in');
    expect(hit('I think you misunderstood me.', 'misunderstand')).toBe('misunderstood');
    expect(hit('Books are arranged on the shelves.', 'shelf')).toBe('shelves');
  });

  it('구동사 사이의 목적어를 허용한다', () => {
    expect(hit('Let me think it over.', 'think over')).toBe('think it over');
  });

  it('짧은 단어의 오탐을 막는다', () => {
    expect(hit('That was a good idea.', 'go')).toBe('');
  });

  it('찾지 못하면 원문 그대로 반환한다', () => {
    expect(splitHighlight('Hello world.', 'acquire')).toEqual([{ text: 'Hello world.', hit: false }]);
  });
});
