import { useSyncExternalStore } from 'react';

// 해시 라우터: GitHub Pages에서 새로고침해도 404가 나지 않도록 #/경로 사용
// 화면 이동은 브라우저 기록에 쌓지 않는다(replaceState). 기기의 뒤로가기/스와이프는
// installBackGuard가 가로채서 앱 밖으로 나가거나 학습 화면을 벗어나지 않게 한다.

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

const getHash = () => window.location.hash;

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, getHash);
  return parseRoute(hash);
}

export function parseRoute(hash: string): string[] {
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function navigate(path: string) {
  const hash = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash === hash) return;
  window.history.replaceState(window.history.state, '', hash);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

const GUARD = { hoedokGuard: true };

/**
 * 뒤로가기 방지: 현재 기록 위에 같은 주소의 "가드" 항목을 하나 쌓아 둔다.
 * 뒤로가기로 가드가 빠지면 즉시 다시 쌓고 원래 화면을 유지한 뒤 onBack을 호출한다.
 * Chrome은 사용자 조작 없이 쌓은 기록을 뒤로가기에서 건너뛰므로, 다시 쌓는 것은
 * 다음 터치/키 입력 때 한 번 더 한다.
 */
export function installBackGuard(onBack: (route: string[]) => void): () => void {
  let current = window.location.hash;
  let armed = false;

  const push = () => window.history.pushState(GUARD, '', current || window.location.href);
  const arm = () => {
    if (armed) return;
    push();
    armed = true;
  };
  const onHashChange = () => {
    current = window.location.hash;
  };
  const onPop = () => {
    // 원래 화면 주소로 되돌리면서 가드를 다시 쌓는다
    push();
    armed = false;
    onBack(parseRoute(current));
  };

  push();
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('popstate', onPop);
  window.addEventListener('pointerdown', arm, true);
  window.addEventListener('keydown', arm, true);
  return () => {
    window.removeEventListener('hashchange', onHashChange);
    window.removeEventListener('popstate', onPop);
    window.removeEventListener('pointerdown', arm, true);
    window.removeEventListener('keydown', arm, true);
  };
}
