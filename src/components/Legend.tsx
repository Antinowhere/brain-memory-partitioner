'use client';

import { useMemoryStore, defaultCategories, CategoryType } from '@/store/memoryStore';
import * as LucideIcons from 'lucide-react';
import { useMemo } from 'react';

interface LegendProps {
  canvasSize: { width: number; height: number };
}

export default function Legend({ canvasSize }: LegendProps) {
  const { boxes } = useMemoryStore();

  const stats = useMemo(() => {
    const totalCanvasArea = canvasSize.width * canvasSize.height;
    const categoryAreas: Record<CategoryType, number> = {
      work: 0,
      romance: 0,
      personal: 0,
      doom: 0,
      health: 0,
      creative: 0,
      social: 0,
      other: 0,
    };

    let totalBoxArea = 0;

    boxes.forEach((box) => {
      const boxArea = box.width * box.height;
      categoryAreas[box.category] += boxArea;
      totalBoxArea += boxArea;
    });

    const percentages = defaultCategories.map((category) => {
      const area = categoryAreas[category.id];
      const percentage = totalCanvasArea > 0 ? (area / totalCanvasArea) * 100 : 0;
      return {
        ...category,
        area,
        percentage,
        count: boxes.filter((b) => b.category === category.id).length,
      };
    });

    const freeSpace = totalCanvasArea > 0 
      ? ((totalCanvasArea - totalBoxArea) / totalCanvasArea) * 100 
      : 100;

    return {
      percentages: percentages.filter((p) => p.count > 0).sort((a, b) => b.percentage - a.percentage),
      allCategories: percentages,
      totalItems: boxes.length,
      freeSpace: Math.max(0, freeSpace),
      mentalLoad: Math.min(100, 100 - freeSpace),
    };
  }, [boxes, canvasSize]);

  return (
    <div className="absolute top-4 right-4 w-64 bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-zinc-800 p-4 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Mental Load</span>
      </div>

      {/* Mental load bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-2xl font-bold text-white font-mono">
            {stats.mentalLoad.toFixed(1)}%
          </span>
          <span className="text-xs text-zinc-500">occupied</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${stats.mentalLoad}%`,
              background: stats.mentalLoad > 80 
                ? 'linear-gradient(90deg, #EF4444, #DC2626)' 
                : stats.mentalLoad > 50 
                  ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                  : 'linear-gradient(90deg, #22C55E, #16A34A)',
            }}
          />
        </div>
      </div>

      {/* Category breakdown */}
      <div className="space-y-2 mb-4">
        {stats.percentages.length === 0 ? (
          <p className="text-xs text-zinc-600 italic text-center py-4">
            Click canvas to add thoughts
          </p>
        ) : (
          stats.percentages.map((cat) => {
            const IconComponent = LucideIcons[cat.icon as keyof typeof LucideIcons] as React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
            return (
              <div key={cat.id} className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${cat.color}20` }}
                >
                  {IconComponent && <IconComponent size={16} style={{ color: cat.color }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-300 truncate">{cat.name}</span>
                    <span className="text-sm font-mono text-zinc-400">{cat.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mt-1">
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, cat.percentage * 2)}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      <div className="pt-3 border-t border-zinc-800 flex justify-between text-xs text-zinc-500">
        <span>{stats.totalItems} item{stats.totalItems !== 1 ? 's' : ''}</span>
        <span>{stats.freeSpace.toFixed(0)}% free</span>
      </div>
    </div>
  );
}
