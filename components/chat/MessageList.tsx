'use client';

import { useEffect, useRef } from 'react';
import type { UiMessage } from '@/lib/chat/useRagChat';
import { MessageBubble } from './MessageBubble';

export function MessageList({ messages }: { messages: UiMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-sm text-neutral-500">
        <p className="text-base font-medium text-neutral-700">
          ご質問をどうぞ
        </p>
        <p>
          例：「乾燥肌に効くスキンケアの方法を教えて」<br />
          「最近の新製品について教えて」
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
