import { useEffect, useRef } from 'react';

interface MatrixAnimationProps {
  className?: string;
}

export function MatrixAnimation({ className = '' }: MatrixAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const fontSize = 14;
    const chars = "01";

    // Safe reference to context to avoid null checks
    const ctx = context;

    const resizeCanvas = () => {
      const { offsetWidth, offsetHeight } = canvas;
      canvas.width = offsetWidth;
      canvas.height = offsetHeight;
      return Math.ceil(offsetWidth / fontSize);
    };

    let columns = resizeCanvas();
    const drops: number[] = Array(columns).fill(1);

    const handleResize = () => {
      columns = resizeCanvas();
      drops.length = columns;
      drops.fill(1);
    };

    window.addEventListener('resize', handleResize);

    function draw() {
      const width = canvas.width;
      const height = canvas.height;

      if (width === 0 || height === 0) {
        console.warn('Canvas dimensions are zero');
        return;
      }

      try {
        // Create fade effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, width, height);

        // Set text properties
        ctx.fillStyle = '#a855f7';
        ctx.font = `${fontSize}px monospace`;
        ctx.textAlign = 'center';

        // Update and draw drops
        for (let i = 0; i < drops.length; i++) {
          const text = chars[Math.floor(Math.random() * chars.length)];
          const x = i * fontSize + fontSize / 2;
          const y = drops[i] * fontSize;

          ctx.fillText(text, x, y);

          // Reset drop when it reaches bottom
          if (y > height && Math.random() > 0.975) {
            drops[i] = 0;
          } else {
            drops[i]++;
          }
        }
      } catch (error) {
        console.error('[MatrixAnimation] Error in animation:', error);
      }
    }

    console.log('[MatrixAnimation] Starting animation');
    const interval = setInterval(draw, 33);

    return () => {
      console.log('[MatrixAnimation] Cleaning up');
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%' }}
      aria-label="Matrix animation background"
    />
  );
}
