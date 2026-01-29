'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useMemoryStore } from '@/store/memoryStore';
import MemoryBox from './MemoryBox';
import Legend from './Legend';
import History from './History';
import Toolbar from './Toolbar';
import CreateBoxModal from './CreateBoxModal';

export default function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { boxes } = useMemoryStore();
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const [modalOpen, setModalOpen] = useState(false);
  const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 });

  // Track canvas size
  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current) {
        setCanvasSize({
          width: canvasRef.current.offsetWidth,
          height: canvasRef.current.offsetHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Handle canvas click to create new box
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    
    // Don't trigger if clicking on a box, toolbar, legend, or history
    if (target.closest('.react-draggable') || 
        target.closest('[class*="bg-zinc-900"]') ||
        target.closest('button')) {
      return;
    }
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left - 75; // Center the box (150/2)
    const y = e.clientY - rect.top - 50;  // Center the box (100/2)

    setClickPosition({ 
      x: Math.max(0, Math.min(x, canvasSize.width - 150)),
      y: Math.max(0, Math.min(y, canvasSize.height - 100)),
    });
    setModalOpen(true);
  }, [canvasSize]);

  return (
    <>
      {/* Canvas area */}
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="relative w-full h-screen overflow-hidden cursor-crosshair"
        style={{
          background: `
            radial-gradient(ellipse at 20% 80%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(168, 85, 247, 0.06) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(20, 20, 20, 1) 0%, rgba(9, 9, 11, 1) 100%)
          `,
        }}
      >
        {/* Subtle grid pattern */}
        <div 
          className="canvas-bg absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />

        {/* Boxes */}
        {boxes.map((box) => (
          <MemoryBox key={box.id} box={box} canvasRef={canvasRef} />
        ))}

        {/* Empty state */}
        {boxes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-dashed border-zinc-700 rounded-lg" />
              </div>
              <p className="text-zinc-600 text-sm">Click anywhere to add a thought</p>
            </div>
          </div>
        )}

        {/* UI Overlays */}
        <Toolbar />
        <Legend canvasSize={canvasSize} />
        <History />
      </div>

      {/* Create box modal */}
      <CreateBoxModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        position={clickPosition}
      />
    </>
  );
}
