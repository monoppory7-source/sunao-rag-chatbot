'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChatMessage, Source } from '@/types/rag';

export type UiMessage = ChatMessage & {
  id: string;
  sources?: Source[];
  cached?: boolean;
  pending?: boolean;
};

type SendState = 'idle' | 'sending' | 'error';

/**
 * Chat hook for the /api/chat endpoint (non-streaming JSON).
 */
export function useRagChat() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [state, setState] = useState<SendState>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setState('idle');
    setError(null);
  }, []);

  const send = useCallback(
    async (input: string) => {
      const trimmed = input.trim();
      if (!trimmed || state === 'sending') return;

      setError(null);
      const userMsg: UiMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
      };
      const assistantId = crypto.randomUUID();
      const assistantMsg: UiMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        pending: true,
      };

      const history = messages.map(({ role, content }) => ({ role, content }));
      setMessages((m) => [...m, userMsg, assistantMsg]);
      setState('sending');

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, history }),
          signal: ac.signal,
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
        }

        const data = (await res.json()) as {
          answer: string;
          sources: Source[];
          cached?: boolean;
        };

        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: data.answer,
                  sources: data.sources ?? [],
                  cached: data.cached ?? false,
                  pending: false,
                }
              : msg,
          ),
        );
        setState('idle');
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          setState('idle');
          return;
        }
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setMessages((m) =>
          m.map((x) =>
            x.id === assistantId
              ? { ...x, content: `エラーが発生しました: ${msg}`, pending: false }
              : x,
          ),
        );
        setState('error');
      }
    },
    [messages, state],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setState('idle');
  }, []);

  return { messages, state, error, send, stop, reset };
}
