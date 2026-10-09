// 예문 속 표제어(활용형 포함)를 찾아 굵게 표시하기 위한 분할 함수

const IRREGULAR: Record<string, string[]> = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  have: ['has', 'had', 'having'],
  do: ['does', 'did', 'done', 'doing'],
  go: ['goes', 'went', 'gone', 'going'],
  give: ['gave', 'given'],
  grow: ['grew', 'grown'],
  come: ['came'],
  take: ['took', 'taken'],
  make: ['made'],
  get: ['got', 'gotten', 'getting'],
  put: ['putting'],
  run: ['ran', 'running'],
  bring: ['brought'],
  buy: ['bought'],
  think: ['thought'],
  catch: ['caught'],
  teach: ['taught'],
  seek: ['sought'],
  fight: ['fought'],
  find: ['found'],
  hold: ['held'],
  keep: ['kept'],
  sleep: ['slept'],
  leave: ['left'],
  feel: ['felt'],
  meet: ['met'],
  send: ['sent'],
  spend: ['spent'],
  lend: ['lent'],
  build: ['built'],
  lose: ['lost'],
  pay: ['paid'],
  say: ['said'],
  lay: ['laid'],
  lie: ['lay', 'lain', 'lying'],
  tell: ['told'],
  sell: ['sold'],
  stand: ['stood'],
  understand: ['understood'],
  win: ['won'],
  sit: ['sat'],
  see: ['saw', 'seen'],
  write: ['wrote', 'written'],
  ride: ['rode', 'ridden'],
  rise: ['rose', 'risen'],
  arise: ['arose', 'arisen'],
  drive: ['drove', 'driven'],
  speak: ['spoke', 'spoken'],
  break: ['broke', 'broken'],
  choose: ['chose', 'chosen'],
  wake: ['woke', 'woken'],
  steal: ['stole', 'stolen'],
  freeze: ['froze', 'frozen'],
  forget: ['forgot', 'forgotten'],
  begin: ['began', 'begun'],
  drink: ['drank', 'drunk'],
  swim: ['swam', 'swum'],
  sing: ['sang', 'sung'],
  ring: ['rang', 'rung'],
  sink: ['sank', 'sunk'],
  shrink: ['shrank', 'shrunk'],
  eat: ['ate', 'eaten'],
  fall: ['fell', 'fallen'],
  draw: ['drew', 'drawn'],
  throw: ['threw', 'thrown'],
  know: ['knew', 'known'],
  blow: ['blew', 'blown'],
  fly: ['flew', 'flown'],
  show: ['shown'],
  wear: ['wore', 'worn'],
  tear: ['tore', 'torn'],
  bear: ['bore', 'borne'],
  swear: ['swore', 'sworn'],
  hide: ['hid', 'hidden'],
  bite: ['bit', 'bitten'],
  shake: ['shook', 'shaken'],
  mistake: ['mistook', 'mistaken'],
  undertake: ['undertook', 'undertaken'],
  overtake: ['overtook', 'overtaken'],
  forgive: ['forgave', 'forgiven'],
  become: ['became'],
  overcome: ['overcame'],
  feed: ['fed'],
  lead: ['led'],
  mislead: ['misled'],
  flee: ['fled'],
  hear: ['heard'],
  mean: ['meant'],
  deal: ['dealt'],
  shoot: ['shot'],
  light: ['lit'],
  slide: ['slid'],
  stick: ['stuck'],
  strike: ['struck'],
  swing: ['swung'],
  hang: ['hung'],
  dig: ['dug'],
  spin: ['spun'],
  bind: ['bound'],
  wind: ['wound'],
  grind: ['ground'],
  forbid: ['forbade', 'forbidden'],
  withdraw: ['withdrew', 'withdrawn'],
  cling: ['clung'],
  leaf: ['leaves'],
  shelf: ['shelves'],
  half: ['halves'],
  life: ['lives'],
  knife: ['knives'],
  wife: ['wives'],
  thief: ['thieves'],
  child: ['children'],
  person: ['people'],
  man: ['men'],
  woman: ['women'],
  foot: ['feet'],
  tooth: ['teeth'],
  mouse: ['mice'],
  good: ['better', 'best'],
  bad: ['worse', 'worst'],
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function irregularForms(t: string): string[] {
  if (IRREGULAR[t]) return IRREGULAR[t];
  // misunderstand → misunderstood, withhold → withheld
  for (const base of Object.keys(IRREGULAR)) {
    if (base.length >= 3 && t.length > base.length && t.endsWith(base)) {
      const prefix = t.slice(0, t.length - base.length);
      return IRREGULAR[base].map((f) => prefix + f);
    }
  }
  return [];
}

function tokenPattern(token: string): string {
  const t = token.toLowerCase();
  const alts = irregularForms(t).map(esc);
  if (!/^[a-z]+$/.test(t)) return [`${esc(t)}s?`, ...alts].join('|');
  if (t.length <= 3) {
    // 짧은 단어는 흔한 어미만 허용 (go → good 같은 오탐 방지)
    const last = t[t.length - 1];
    if (last === 'y') alts.push(`${t.slice(0, -1)}i(?:ed|es)`);
    alts.push(`${t}(?:s|es|d|ed|ing|n|ne|${last}ed|${last}ing|${last}er)?`);
  } else if (t.endsWith('y')) {
    alts.push(`${t.slice(0, -1)}(?:y|i)[a-z]*`);
  } else if (t.endsWith('e')) {
    alts.push(`${t.slice(0, -1)}[a-z]*`);
  } else {
    alts.push(`${t}[a-z]*`);
  }
  return alts.join('|');
}

export function headwordRegex(word: string): RegExp | null {
  const tokens = word
    .replace(/\(.*?\)/g, ' ')
    .replace(/[~/]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return null;
  const parts = tokens.map((tok, i) => {
    if (i === 0) return `(?:${tokenPattern(tok)})`;
    // 마지막 단어는 복수형 허용 (fossil fuels)
    return i === tokens.length - 1 ? `${esc(tok.toLowerCase())}(?:s|es)?` : esc(tok.toLowerCase());
  });
  // 구동사는 사이에 목적어가 끼어들 수 있다 (see her off, think it over)
  const gap = tokens.length > 1 ? "\\s+(?:[A-Za-z']+\\s+){0,2}?" : '';
  const body = parts[0] + (tokens.length > 1 ? gap + parts.slice(1).join('\\s+') : '');
  // 단어 경계: 영문자가 아닌 곳
  return new RegExp(`(?<![A-Za-zÀ-ÿ])${body}(?![A-Za-zÀ-ÿ])`, 'i');
}

export interface Segment {
  text: string;
  hit: boolean;
}

export function splitHighlight(sentence: string, word: string): Segment[] {
  const re = headwordRegex(word);
  const m = re ? re.exec(sentence) : null;
  if (!m) return [{ text: sentence, hit: false }];
  const out: Segment[] = [];
  if (m.index > 0) out.push({ text: sentence.slice(0, m.index), hit: false });
  out.push({ text: m[0], hit: true });
  const end = m.index + m[0].length;
  if (end < sentence.length) out.push({ text: sentence.slice(end), hit: false });
  return out;
}
