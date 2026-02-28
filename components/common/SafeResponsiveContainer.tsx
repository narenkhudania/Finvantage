import React, { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';

type SafeResponsiveContainerProps = React.PropsWithChildren<{
  className?: string;
  debounce?: number;
  minReadyWidth?: number;
  minReadyHeight?: number;
}>;

const SafeResponsiveContainer: React.FC<SafeResponsiveContainerProps> = ({
  children,
  className,
  debounce = 80,
  minReadyWidth = 8,
  minReadyHeight = 8,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = host.getBoundingClientRect();
        const canRender = rect.width >= minReadyWidth && rect.height >= minReadyHeight;
        setReady(canRender);
      });
    };

    measure();

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(host);
    window.addEventListener('resize', measure);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [minReadyWidth, minReadyHeight]);

  return (
    <div ref={hostRef} className={className} style={{ width: '100%', height: '100%' }}>
      {ready ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={debounce}>
          {children}
        </ResponsiveContainer>
      ) : (
        <div style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  );
};

export default SafeResponsiveContainer;
