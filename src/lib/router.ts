import { useSyncExternalStore } from 'react';

// 해시 라우터: GitHub Pages에서 새로고침해도 404가 나지 않도록 #/경로 사용

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

const getHash = () => window.location.hash;

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, getHash);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

// 화면 이동은 브라우저 기록에 쌓지 않는다(replaceState). 이전 기록이 없으니
// 홈 화면 앱에서 가장자리를 스와이프해도 이전 화면으로 넘어가지 않는다.
export function navigate(path: string) {
  const hash = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash === hash) return;
  window.history.replaceState(window.history.state, '', hash);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
