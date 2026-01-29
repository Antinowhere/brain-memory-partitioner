'use client';

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with react-rnd
const Canvas = dynamic(() => import('@/components/Canvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-800 border-t-zinc-500 rounded-full animate-spin" />
    </div>
  ),
});

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <Canvas />
    </main>
  );
}
