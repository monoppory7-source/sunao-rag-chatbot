import type { UiMessage } from '@/lib/chat/useRagChat';
import { SourceCard } from './SourceCard';

export function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-neutral-900 text-white'
            : 'bg-neutral-100 text-neutral-900'
        }`}
      >
        {message.content || (
          <span className="inline-flex gap-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400 [animation-delay:300ms]" />
          </span>
        )}
        {!isUser && message.cached && (
          <span className="ml-2 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
            cached
          </span>
        )}
        {/* Source cards intentionally hidden — text-only chat per UX request.
            Sources are still returned by the API; flip back on by re-rendering
            <SourceCard /> here if needed. */}
      </div>
    </div>
  );
}
