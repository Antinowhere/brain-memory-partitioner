'use client';

import { useMemoryStore } from '@/store/memoryStore';
import { Clock, MapPin, Trash2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export default function History() {
  const { history, loadSnapshot, deleteSnapshot } = useMemoryStore();
  const [isExpanded, setIsExpanded] = useState(false);

  if (history.length === 0) return null;

  const visibleHistory = isExpanded ? history : history.slice(0, 3);

  return (
    <div className="absolute bottom-4 right-4 w-64 bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-zinc-500" />
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">History</span>
        </div>
        <span className="text-xs text-zinc-600">{history.length} saved</span>
      </div>

      {/* Snapshots */}
      <div className="max-h-64 overflow-y-auto">
        {visibleHistory.map((snapshot) => (
          <div 
            key={snapshot.id}
            className="p-3 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-300 truncate">{snapshot.date}</p>
                {snapshot.location && (
                  <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                    <MapPin size={10} />
                    {snapshot.location}
                  </p>
                )}
                <p className="text-xs text-zinc-600 mt-1">
                  {snapshot.boxes.length} item{snapshot.boxes.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => loadSnapshot(snapshot.id)}
                  className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400 transition-colors"
                  title="Load this snapshot"
                >
                  <RotateCcw size={12} />
                </button>
                <button
                  onClick={() => deleteSnapshot(snapshot.id)}
                  className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors"
                  title="Delete snapshot"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expand/Collapse */}
      {history.length > 3 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-2 flex items-center justify-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={12} />
              Show less
            </>
          ) : (
            <>
              <ChevronDown size={12} />
              Show {history.length - 3} more
            </>
          )}
        </button>
      )}
    </div>
  );
}
