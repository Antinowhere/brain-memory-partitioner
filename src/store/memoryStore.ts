import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CategoryType = 'work' | 'romance' | 'personal' | 'doom' | 'health' | 'creative' | 'social' | 'other';

export interface Category {
  id: CategoryType;
  name: string;
  color: string;
  icon: string;
}

export interface MemoryBox {
  id: string;
  title: string;
  category: CategoryType;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: string;
}

export interface HistorySnapshot {
  id: string;
  date: string;
  location?: string;
  boxes: MemoryBox[];
  timestamp: number;
}

interface MemoryStore {
  boxes: MemoryBox[];
  history: HistorySnapshot[];
  categories: Category[];
  
  addBox: (box: Omit<MemoryBox, 'id' | 'createdAt'>) => void;
  updateBox: (id: string, updates: Partial<MemoryBox>) => void;
  deleteBox: (id: string) => void;
  
  saveSnapshot: (location?: string) => void;
  loadSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
  
  clearCanvas: () => void;
}

export const defaultCategories: Category[] = [
  { id: 'work', name: 'Work', color: '#3B82F6', icon: 'Briefcase' },
  { id: 'romance', name: 'Romance', color: '#EF4444', icon: 'Heart' },
  { id: 'personal', name: 'Personal', color: '#22C55E', icon: 'User' },
  { id: 'doom', name: 'Doom', color: '#1F2937', icon: 'Skull' },
  { id: 'health', name: 'Health', color: '#F59E0B', icon: 'Activity' },
  { id: 'creative', name: 'Creative', color: '#A855F7', icon: 'Palette' },
  { id: 'social', name: 'Social', color: '#EC4899', icon: 'Users' },
  { id: 'other', name: 'Other', color: '#6B7280', icon: 'Circle' },
];

const generateId = () => Math.random().toString(36).substring(2, 15);

const formatDate = () => {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      boxes: [],
      history: [],
      categories: defaultCategories,

      addBox: (box) => {
        const newBox: MemoryBox = {
          ...box,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ boxes: [...state.boxes, newBox] }));
      },

      updateBox: (id, updates) => {
        set((state) => ({
          boxes: state.boxes.map((box) =>
            box.id === id ? { ...box, ...updates } : box
          ),
        }));
      },

      deleteBox: (id) => {
        set((state) => ({
          boxes: state.boxes.filter((box) => box.id !== id),
        }));
      },

      saveSnapshot: (location) => {
        const { boxes } = get();
        const snapshot: HistorySnapshot = {
          id: generateId(),
          date: formatDate(),
          location,
          boxes: [...boxes],
          timestamp: Date.now(),
        };
        set((state) => ({ history: [snapshot, ...state.history] }));
      },

      loadSnapshot: (id) => {
        const { history } = get();
        const snapshot = history.find((s) => s.id === id);
        if (snapshot) {
          set({ boxes: [...snapshot.boxes] });
        }
      },

      deleteSnapshot: (id) => {
        set((state) => ({
          history: state.history.filter((s) => s.id !== id),
        }));
      },

      clearCanvas: () => {
        set({ boxes: [] });
      },
    }),
    {
      name: 'brain-memory-storage',
    }
  )
);
