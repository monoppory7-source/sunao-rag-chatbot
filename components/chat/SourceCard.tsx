import type { Source } from '@/types/rag';

export function SourceCard({ source, index }: { source: Source; index: number }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 rounded-lg border border-neutral-200 bg-white p-3 transition hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded bg-neutral-100">
        {/* Using native img so we don't have to configure next/image domains. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={source.thumbnailUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
          {source.timestamp}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          参照 [{index + 1}]
        </p>
        <p className="line-clamp-2 text-sm font-medium text-neutral-900 group-hover:underline">
          {source.title}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">{source.timestamp} から再生</p>
      </div>
    </a>
  );
}
