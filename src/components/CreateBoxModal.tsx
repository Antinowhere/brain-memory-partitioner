'use client';

import { useState } from 'react';
import { useMemoryStore, defaultCategories, CategoryType } from '@/store/memoryStore';
import * as LucideIcons from 'lucide-react';
import { X } from 'lucide-react';

interface CreateBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}

export default function CreateBoxModal({ isOpen, onClose, position }: CreateBoxModalProps) {
  const { addBox } = useMemoryStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CategoryType>('work');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addBox({
      title: title.trim(),
      category,
      x: position.x,
      y: position.y,
      width: 150,
      height: 100,
    });

    setTitle('');
    setCategory('work');
    onClose();
  };

  const selectedCategory = defaultCategories.find((c) => c.id === category);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative bg-zinc-900 rounded-2xl border border-zinc-800 p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <h2 className="text-lg font-semibold text-white mb-6">What&apos;s on your mind?</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title input */}
          <div>
            <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Project deadline, Date night..."
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-colors"
              autoFocus
            />
          </div>

          {/* Category selector */}
          <div>
            <label className="block text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">
              Category
            </label>
            <div className="grid grid-cols-4 gap-2">
              {defaultCategories.map((cat) => {
                const IconComponent = LucideIcons[cat.icon as keyof typeof LucideIcons] as React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
                const isSelected = category === cat.id;
                
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                      isSelected 
                        ? 'border-transparent' 
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                    style={{
                      backgroundColor: isSelected ? `${cat.color}20` : 'transparent',
                      borderColor: isSelected ? cat.color : undefined,
                    }}
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${cat.color}30` }}
                    >
                      {IconComponent && <IconComponent size={16} style={{ color: cat.color }} />}
                    </div>
                    <span 
                      className="text-xs"
                      style={{ color: isSelected ? cat.color : '#a1a1aa' }}
                    >
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: selectedCategory?.color,
              color: category === 'doom' ? '#fff' : '#000',
            }}
          >
            Add to Mind
          </button>
        </form>
      </div>
    </div>
  );
}
