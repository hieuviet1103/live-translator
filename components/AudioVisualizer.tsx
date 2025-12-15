import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  color?: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, color = '#60A5FA' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simulate frequency data since we don't have direct analyzer node access in this simplified component
    // In a full production app, you'd pass the AnalyzerNode prop.
    const bars = 20;
    const barWidth = canvas.width / bars;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isActive) {
        // Draw a flat line
        ctx.fillStyle = '#374151'; // gray-700
        ctx.fillRect(0, canvas.height / 2, canvas.width, 2);
        return;
      }

      for (let i = 0; i < bars; i++) {
        // Generate pseudo-random height based on time for visual effect
        const time = Date.now() / 200;
        const heightMultiplier = Math.sin(time + i * 0.5) * 0.5 + 0.5;
        const height = heightMultiplier * (canvas.height * 0.8);
        
        const x = i * barWidth;
        const y = (canvas.height - height) / 2;

        ctx.fillStyle = color;
        // Rounded caps look
        ctx.beginPath();
        ctx.roundRect(x + 2, y, barWidth - 4, height, 4);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, color]);

  return (
    <canvas 
      ref={canvasRef} 
      width={200} 
      height={60} 
      className="w-full h-16 rounded-lg bg-gray-900/50 backdrop-blur-sm"
    />
  );
};

export default AudioVisualizer;
