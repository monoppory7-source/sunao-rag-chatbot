'use client';

import { useRagChat } from '@/lib/chat/useRagChat';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';

export function ChatContainer() {
  const { messages, state, error, send, stop, reset } = useRagChat();
  const streaming = state === 'streaming';

  return (
    <section className="flex h-[70dvh] min-h-[480px] flex-col rounded-2xl border border-neutral-200 bg-neutral-50">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-medium text-neutral-700">チャット</h2>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={reset}
            disabled={streaming}
            className="text-xs text-neutral-500 hover:text-neutral-900 disabled:opacity-40"
          >
            新しい会話
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <MessageList messages={messages} />
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="border-t border-neutral-200 p-3">
        <ChatInput
          onSend={send}
          onStop={stop}
          disabled={streaming}
          streaming={streaming}
        />
      </div>
    </section>
  );
}
