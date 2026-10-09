export type Pos = 'n' | 'v' | 'adj' | 'adv' | 'phr' | 'prep' | 'conj';

export interface Word {
  id: number;
  word: string;
  pos: Pos | string;
  meaning: string;
  synonyms: string[];
  collocations: string[];
  example: string;
  source: string;
  level: number;
  chapter: number;
}

export interface Level {
  level: number;
  name: string;
}

export interface Chapter {
  id: number;
  level: number;
  levelName: string;
  title: string;
  count: number;
}

export interface VocabData {
  version: number;
  levels: Level[];
  chapters: Chapter[];
  words: Word[];
}

export interface Vocab extends VocabData {
  wordById: Map<number, Word>;
  chapterById: Map<number, Chapter>;
  /** 챕터 id → 단어 id 목록 (데이터 순서) */
  wordIdsByChapter: Map<number, number[]>;
}

export const POS_LABEL: Record<string, string> = {
  n: '명',
  v: '동',
  adj: '형',
  adv: '부',
  phr: '숙',
  prep: '전',
  conj: '접',
};

export const posLabel = (pos: string) => POS_LABEL[pos] ?? pos;

export function buildVocab(data: VocabData): Vocab {
  const wordById = new Map<number, Word>();
  const wordIdsByChapter = new Map<number, number[]>();
  for (const w of data.words) {
    wordById.set(w.id, w);
    const list = wordIdsByChapter.get(w.chapter);
    if (list) list.push(w.id);
    else wordIdsByChapter.set(w.chapter, [w.id]);
  }
  const chapters = data.chapters.slice().sort((a, b) => a.id - b.id);
  // 단어 수는 실제 데이터 기준
  for (const c of chapters) c.count = wordIdsByChapter.get(c.id)?.length ?? 0;
  return {
    ...data,
    chapters,
    wordById,
    chapterById: new Map(chapters.map((c) => [c.id, c])),
    wordIdsByChapter,
  };
}

export async function loadVocab(): Promise<Vocab> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/toeic_vocab_chapters.json`);
  if (!res.ok) throw new Error(`단어 데이터를 불러오지 못했습니다 (${res.status})`);
  const data = (await res.json()) as VocabData;
  if (!Array.isArray(data.words) || !Array.isArray(data.chapters)) throw new Error('단어 데이터 형식이 올바르지 않습니다');
  return buildVocab(data);
}
