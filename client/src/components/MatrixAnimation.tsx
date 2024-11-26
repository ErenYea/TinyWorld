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

    const resizeCanvas = () => {
      if (!canvas) return 0;
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
      if (!canvas || !context) {
        console.warn('Canvas or context not available');
        return;
      }

      const width = canvas.width;
      const height = canvas.height;

      if (width === 0 || height === 0) {
        console.warn('Canvas dimensions are zero');
        return;
      }

      try {
        // Create fade effect
        context.fillStyle = 'rgba(0, 0, 0, 0.05)';
        context.fillRect(0, 0, width, height);

        // Set text properties
        context.fillStyle = '#a855f7';
        context.font = `${fontSize}px monospace`;
        context.textAlign = 'center';

        // Update and draw drops
        for (let i = 0; i < drops.length; i++) {
          const text = chars[Math.floor(Math.random() * chars.length)];
          const x = i * fontSize + fontSize / 2;
          const y = drops[i] * fontSize;

          context.fillText(text, x, y);

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
