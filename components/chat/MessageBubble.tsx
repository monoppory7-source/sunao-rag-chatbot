import type { UiMessage } from '@/lib/chat/useRagChat';

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
        {message.content ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <span className="inline-flex gap-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400 [animation-delay:300ms]" />
          </span>
        )}

        {!isUser && message.cached && (
          <span className="ml-2 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
            キャッシュ済み
          </span>
        )}

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-neutral-200 pt-2">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
              参照元
            </p>
            <ul className="flex flex-col gap-1">
              {message.sources.map((s, i) => (
                <li key={s.videoId + i} className="text-xs">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-700 hover:text-neutral-900 hover:underline"
                  >
                    <span className="mr-1 inline-block min-w-[1.25rem] text-neutral-500">
                      [{i + 1}]
                    </span>
                    <span className="line-clamp-1 align-middle">
                      {s.title}
                    </span>
                    <span className="ml-1 text-neutral-500">{s.timestamp}〜</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
