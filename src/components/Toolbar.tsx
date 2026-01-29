'use client';

import { useState } from 'react';
import { useMemoryStore } from '@/store/memoryStore';
import { Save, Trash2, MapPin } from 'lucide-react';

export default function Toolbar() {
  const { saveSnapshot, clearCanvas, boxes } = useMemoryStore();
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [location, setLocation] = useState('');

  const handleSave = () => {
    if (boxes.length === 0) return;
    
    if (showLocationInput) {
      saveSnapshot(location.trim() || undefined);
      setLocation('');
      setShowLocationInput(false);
    } else {
      setShowLocationInput(true);
    }
  };

  const handleClear = () => {
    if (boxes.length === 0) return;
    if (confirm('Clear all items from canvas?')) {
      clearCanvas();
    }
  };

  return (
    <div className="absolute top-4 left-4 flex items-center gap-2">
      {/* Logo/Title */}
      <div className="bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-zinc-800 px-4 py-3 mr-2">
        <h1 className="text-sm font-semibold text-white tracking-tight">
          <span className="text-zinc-500">mind</span>map
        </h1>
      </div>

      {/* Save button with location input */}
      <div className="flex items-center bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-zinc-800 overflow-hidden">
        {showLocationInput && (
          <div className="flex items-center gap-2 px-3 border-r border-zinc-800">
            <MapPin size={14} className="text-zinc-500" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (optional)"
              className="w-32 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') {
                  setShowLocationInput(false);
                  setLocation('');
                }
              }}
            />
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={boxes.length === 0}
          className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-400 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Save snapshot"
        >
          <Save size={16} />
          <span className="hidden sm:inline">Save</span>
        </button>
      </div>

      {/* Clear button */}
      <button
        onClick={handleClear}
        disabled={boxes.length === 0}
        className="flex items-center gap-2 px-4 py-3 bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-zinc-800 text-sm text-zinc-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Clear canvas"
      >
        <Trash2 size={16} />
        <span className="hidden sm:inline">Clear</span>
      </button>
    </div>
  );
}
