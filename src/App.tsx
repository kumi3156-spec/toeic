import { useCallback, useEffect, useState } from 'react';
import { loadVocab, type Vocab } from './data/vocab';
import { useRoute } from './lib/router';
import { useProgress } from './app/useProgress';
import { applyLayout, setProgress } from './storage/progress';
import { Complete } from './screens/Complete';
import { Home } from './screens/Home';
import { Settings } from './screens/Settings';
import { Study } from './screens/Study';
import { Weak } from './screens/Weak';

export function App() {
  const [vocab, setVocab] = useState<Vocab | null>(null);
  const [error, setError] = useState<string | null>(null);
  const route = useRoute();

  const load = useCallback(() => {
    setError(null);
    loadVocab()
      .then(setVocab)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '단어 데이터를 불러오지 못했습니다'));
  }, []);

  useEffect(load, [load]);

  // 단어 데이터의 챕터 구성이 바뀌었으면 예전 챕터 기록을 정리
  const layout = useProgress().layout;
  const vocabVersion = vocab?.version;
  useEffect(() => {
    if (vocabVersion !== undefined && layout !== vocabVersion) setProgress((p) => applyLayout(p, vocabVersion));
  }, [layout, vocabVersion]);

  // 화면이 바뀌면 맨 위로
  const path = route.join('/');
  useEffect(() => {
    // 최신 Chrome은 scrollTo가 Promise를 돌려주므로 effect에서 반환하지 않는다
    window.scrollTo(0, 0);
  }, [path]);

  if (error) {
    return (
      <div className="screen center">
        <p>{error}</p>
        <button className="btn btn-primary" onClick={load}>
          다시 시도
        </button>
      </div>
    );
  }
  if (!vocab) return <div className="screen center muted">단어 불러오는 중…</div>;

  const [page, param] = route;
  switch (page) {
    case 'study':
      return param ? <Study key={param} vocab={vocab} deck={param} /> : <Home vocab={vocab} />;
    case 'done':
      return param ? <Complete key={param} vocab={vocab} deck={param} /> : <Home vocab={vocab} />;
    case 'weak':
      return <Weak vocab={vocab} />;
    case 'settings':
      return <Settings vocab={vocab} />;
    default:
      return <Home vocab={vocab} />;
  }
}
