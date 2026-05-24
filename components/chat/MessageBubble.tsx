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
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 border-t border-neutral-200 pt-3">
            {message.sources.map((s, i) => (
              <SourceCard key={s.videoId + i} source={s} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
