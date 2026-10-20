import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import { cn } from '@/lib/cn';
import { useLoginSplashStore, type LogoBox } from '@/stores/loginSplashStore';

// Thời lượng từng chặng: logo lướt ra giữa → thanh tải 2 giây → nền trắng mờ dần
const FLY_DURATION_MS = 700;
const LOADING_DURATION_MS = 2000;
const FADE_DURATION_MS = 500;

type SplashPhase = 'flying' | 'loading' | 'fading';

// Độ lệch để đặt ảnh (đang ở vị trí cuối) trùng lại vị trí ban đầu trên khung đăng nhập
function transformFromOrigin(origin: LogoBox, element: HTMLElement): string {
  const target = element.getBoundingClientRect();
  const offsetX = origin.left - target.left;
  const offsetY = origin.top - target.top;
  const scale = origin.width / target.width;
  return `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

// Màn chuyển cảnh sau khi đăng nhập thành công — gắn ở App, nằm trên mọi route để trang trong tải phía dưới
export default function LoginSplash(): JSX.Element | null {
  const isPlaying = useLoginSplashStore(state => state.isPlaying);
  if (!isPlaying) return null;
  return <LoginSplashScreen />;
}

function LoginSplashScreen(): JSX.Element {
  const origin = useLoginSplashStore(state => state.origin);
  const finish = useLoginSplashStore(state => state.finish);
  const iconRef = useRef<HTMLImageElement>(null);
  const textRef = useRef<HTMLImageElement>(null);
  const [phase, setPhase] = useState<SplashPhase>('flying');
  const [iconStyle, setIconStyle] = useState<CSSProperties>({ opacity: 0 });
  const [textStyle, setTextStyle] = useState<CSSProperties>({ opacity: 0 });

  // Đặt logo trùng vị trí trên khung đăng nhập, khung hình kế tiếp mới cho lướt về giữa
  useLayoutEffect(() => {
    const icon = iconRef.current;
    const text = textRef.current;
    if (!origin || !icon || !text) {
      setIconStyle({});
      setTextStyle({});
      return;
    }
    setIconStyle({ transform: transformFromOrigin(origin.icon, icon), transition: 'none' });
    setTextStyle({ transform: transformFromOrigin(origin.text, text), transition: 'none' });
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        setIconStyle({});
        setTextStyle({});
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [origin]);

  // Chuyển chặng theo thời gian, hết chặng mờ dần thì gỡ màn chuyển cảnh
  useEffect(() => {
    const loadingTimer = setTimeout(() => setPhase('loading'), FLY_DURATION_MS);
    const fadingTimer = setTimeout(() => setPhase('fading'), FLY_DURATION_MS + LOADING_DURATION_MS);
    const finishTimer = setTimeout(finish, FLY_DURATION_MS + LOADING_DURATION_MS + FADE_DURATION_MS);
    return () => {
      clearTimeout(loadingTimer);
      clearTimeout(fadingTimer);
      clearTimeout(finishTimer);
    };
  }, [finish]);

  const logoTransitionClass = 'origin-top-left transition-transform duration-700 ease-out motion-reduce:transition-none';

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-500 ease-out',
        phase === 'fading' && 'pointer-events-none opacity-0',
      )}
      role="status"
      aria-label="Đang vào hệ thống"
    >
      {/* Logo xếp dọc ở giữa: icon trên, chữ dưới, thanh tải bên dưới */}
      <div className="flex flex-col items-center gap-4">
        <img
          ref={iconRef}
          src="/Logo_SCare_Icon.png"
          alt=""
          style={iconStyle}
          className={cn('h-20 w-20 rounded-2xl object-cover shadow-card', logoTransitionClass)}
        />
        <img
          ref={textRef}
          src="/Logo_SCare_Text.png"
          alt="SwiftletCare"
          style={textStyle}
          className={cn('h-12 w-[210px] object-contain', logoTransitionClass)}
        />
        <div
          className={cn(
            'mt-2 h-1 w-40 overflow-hidden rounded-full bg-warmGray/15 transition-opacity duration-300',
            phase === 'flying' ? 'opacity-0' : 'opacity-100',
          )}
          aria-hidden
        >
          <div
            className={cn(
              'h-full rounded-full bg-accent-700 transition-[width] ease-in-out motion-reduce:transition-none',
              phase === 'flying' ? 'w-0' : 'w-full',
            )}
            style={{ transitionDuration: `${LOADING_DURATION_MS}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
