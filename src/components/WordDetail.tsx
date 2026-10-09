import type { Word } from '../data/vocab';
import { splitHighlight } from '../lib/highlight';

const POS_FULL: Record<string, string> = {
  n: '명사',
  v: '동사',
  adj: '형용사',
  adv: '부사',
  phr: '숙어',
  prep: '전치사',
  conj: '접속사',
};

export function Example({ word }: { word: Word }) {
  return (
    <>
      {splitHighlight(word.example, word.word).map((seg, i) =>
        seg.hit ? <strong key={i}>{seg.text}</strong> : <span key={i}>{seg.text}</span>,
      )}
    </>
  );
}

/** 카드 뒷면: 뜻, 품사, 유의어, 콜로케이션, 예문 */
export function WordDetail({ word }: { word: Word }) {
  return (
    <div className="detail">
      <p className="detail-meaning">
        <span className="pos-tag">{POS_FULL[word.pos] ?? word.pos}</span>
        {word.meaning}
      </p>
      {word.synonyms.length > 0 && (
        <section className="detail-row">
          <h4>유의어</h4>
          <div className="chips">
            {word.synonyms.map((s) => (
              <span className="chip" key={s}>
                {s}
              </span>
            ))}
          </div>
        </section>
      )}
      {word.collocations.length > 0 && (
        <section className="detail-row">
          <h4>콜로케이션</h4>
          <ul className="colloc">
            {word.collocations.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      )}
      {word.example && (
        <section className="detail-row">
          <h4>예문</h4>
          <p className="example">
            <Example word={word} />
          </p>
        </section>
      )}
    </div>
  );
}
