'use client';

import { Rnd } from 'react-rnd';
import * as LucideIcons from 'lucide-react';
import { MemoryBox as MemoryBoxType, useMemoryStore, defaultCategories } from '@/store/memoryStore';
import { X } from 'lucide-react';
import { useState } from 'react';

interface MemoryBoxProps {
  box: MemoryBoxType;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export default function MemoryBox({ box, canvasRef }: MemoryBoxProps) {
  const { updateBox, deleteBox } = useMemoryStore();
  const [isHovered, setIsHovered] = useState(false);
  
  const category = defaultCategories.find((c) => c.id === box.category);
  const IconComponent = LucideIcons[category?.icon as keyof typeof LucideIcons] as React.ComponentType<{ size?: number; className?: string }>;
  
  const handleDragStop = (_e: unknown, d: { x: number; y: number }) => {
    updateBox(box.id, { x: d.x, y: d.y });
  };

  const handleResizeStop = (
    _e: unknown,
    _direction: unknown,
    ref: HTMLElement,
    _delta: unknown,
    position: { x: number; y: number }
  ) => {
    updateBox(box.id, {
      width: ref.offsetWidth,
      height: ref.offsetHeight,
      x: position.x,
      y: position.y,
    });
  };

  const isSmall = box.width < 120 || box.height < 80;
  const isTiny = box.width < 80 || box.height < 60;

  return (
    <Rnd
      position={{ x: box.x, y: box.y }}
      size={{ width: box.width, height: box.height }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      bounds="parent"
      minWidth={50}
      minHeight={50}
      className="group"
      enableResizing={{
        top: true,
        right: true,
        bottom: true,
        left: true,
        topRight: true,
        bottomRight: true,
        bottomLeft: true,
        topLeft: true,
      }}
    >
      <div
        className="relative w-full h-full rounded-xl overflow-hidden transition-all duration-200 cursor-move"
        style={{
          backgroundColor: `${category?.color}15`,
          border: `2px solid ${category?.color}`,
          boxShadow: isHovered 
            ? `0 0 30px ${category?.color}40, inset 0 0 30px ${category?.color}10`
            : `0 0 20px ${category?.color}20`,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteBox(box.id);
          }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 p-1 rounded-full hover:bg-white/20"
          style={{ color: category?.color }}
        >
          <X size={14} />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center justify-center h-full p-3 gap-1">
          {IconComponent && !isTiny && (
            <IconComponent 
              size={isSmall ? 20 : 28} 
              className="transition-all"
              style={{ color: category?.color }}
            />
          )}
          {!isTiny && (
            <span 
              className="font-medium text-center leading-tight transition-all"
              style={{ 
                color: category?.color,
                fontSize: isSmall ? '11px' : '13px',
              }}
            >
              {box.title}
            </span>
          )}
        </div>

        {/* Resize handles visual indicator */}
        <div 
          className="absolute bottom-1 right-1 w-3 h-3 opacity-30 group-hover:opacity-60 transition-opacity"
          style={{
            background: `linear-gradient(135deg, transparent 50%, ${category?.color} 50%)`,
          }}
        />
      </div>
    </Rnd>
  );
}
