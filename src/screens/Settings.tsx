import { useRef, useState, type ReactNode } from 'react';
import { useProgress } from '../app/useProgress';
import { IconBack } from '../components/Icons';
import type { Vocab } from '../data/vocab';
import { navigate } from '../lib/router';
import { speak, speechSupported } from '../lib/speech';
import {
  chapterDeck,
  clearResult,
  emptyProgress,
  exportJson,
  importJson,
  resetDeck,
  setProgress,
  todayString,
  type Settings as SettingsT,
} from '../storage/progress';

const REVEAL_OPTIONS = [
  { ms: 0, label: '끄기' },
  { ms: 500, label: '0.5초' },
  { ms: 800, label: '0.8초' },
  { ms: 1200, label: '1.2초' },
  { ms: 2000, label: '2초' },
];

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: ReactNode }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="field-label">{label}</span>
        {desc && <span className="field-desc">{desc}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden />
    </label>
  );
}

export function Settings({ vocab }: { vocab: Vocab }) {
  const progress = useProgress();
  const s = progress.settings;
  const [resetChapter, setResetChapter] = useState<number>(vocab.chapters[0]?.id ?? 1);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<SettingsT>) => setProgress((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  const flashMessage = (m: string) => {
    setMessage(m);
    window.setTimeout(() => setMessage(null), 2500);
  };

  const doExport = () => {
    try {
      const blob = new Blob([exportJson(progress)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hoedok-backup-${todayString()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      flashMessage('기록을 내보냈어요');
    } catch {
      flashMessage('내보내기에 실패했어요');
    }
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text().catch(() => '');
    const data = importJson(text);
    if (!data) {
      window.alert('올바른 백업 파일이 아니에요.');
      return;
    }
    if (!window.confirm('지금 기록을 불러온 파일로 덮어쓸까요?\n현재 기록은 사라집니다.')) return;
    setProgress(data);
    clearResult();
    flashMessage('기록을 불러왔어요');
  };

  const doResetChapter = () => {
    const ch = vocab.chapterById.get(resetChapter);
    if (!ch) return;
    if (!window.confirm(`${ch.title}의 학습 기록(회독 수, 진행 중 학습, 단어별 틀린 횟수)을 초기화할까요?`)) return;
    setProgress((p) => resetDeck(p, chapterDeck(ch.id), vocab.wordIdsByChapter.get(ch.id) ?? []));
    flashMessage(`${ch.title} 기록을 초기화했어요`);
  };

  const doResetAll = () => {
    if (!window.confirm('모든 학습 기록을 초기화할까요?\n회독 수, 진행 중 학습, 틀린 단어 기록이 모두 사라집니다.')) return;
    setProgress((p) => ({ ...emptyProgress(), settings: p.settings }));
    clearResult();
    flashMessage('모든 기록을 초기화했어요');
  };

  return (
    <div className="screen">
      <header className="top-bar">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="뒤로">
          <IconBack />
        </button>
        <h1 className="page-title">설정</h1>
        <span className="icon-btn-spacer" />
      </header>

      <h2 className="section-title">학습</h2>
      <section className="panel">
        <Toggle
          label="단어 순서 섞기"
          desc="새로 시작하는 회독부터 적용"
          checked={s.shuffle}
          onChange={(v) => update({ shuffle: v })}
        />
        <Toggle
          label="자동 발음"
          desc={speechSupported ? '카드가 나올 때 발음 재생' : '이 브라우저는 음성 합성을 지원하지 않아요'}
          checked={s.autoSpeak}
          onChange={(v) => {
            update({ autoSpeak: v });
            if (v) speak('Hello');
          }}
        />
        <div className="field">
          <span className="field-label">알고있음 뜻 표시 시간</span>
          <span className="field-desc">뜻을 안 보고 알고있음을 눌렀을 때 잠깐 보여줌</span>
          <div className="segmented">
            {REVEAL_OPTIONS.map((o) => (
              <button key={o.ms} className={s.knownRevealMs === o.ms ? 'on' : ''} onClick={() => update({ knownRevealMs: o.ms })}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <h2 className="section-title">기록 백업</h2>
      <section className="panel">
        <p className="field-desc">폰을 바꿀 때 JSON 파일로 내보낸 뒤 새 폰에서 불러오세요.</p>
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={doExport}>
            내보내기
          </button>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            불러오기
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void doImport(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </section>

      <h2 className="section-title">초기화</h2>
      <section className="panel">
        <div className="field">
          <span className="field-label">챕터별 초기화</span>
          <div className="btn-row">
            <select value={resetChapter} onChange={(e) => setResetChapter(Number(e.target.value))}>
              {vocab.chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({progress.decks[chapterDeck(c.id)]?.readCount ?? 0}회독)
                </option>
              ))}
            </select>
            <button className="btn btn-danger-outline" onClick={doResetChapter}>
              초기화
            </button>
          </div>
        </div>
        <button className="btn btn-danger block" onClick={doResetAll}>
          학습 기록 전체 초기화
        </button>
      </section>

      <p className="muted center-text small">
        단어 {vocab.words.length.toLocaleString()}개 · {vocab.chapters.length}챕터
      </p>

      {message && <div className="toast">{message}</div>}
    </div>
  );
}
