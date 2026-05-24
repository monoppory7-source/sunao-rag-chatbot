-- Master table for YouTube videos ingested from the Sunao Pharmaceutical channel.

create table public.videos (
  id              uuid primary key default gen_random_uuid(),
  youtube_id      text not null unique,
  title           text not null,
  description     text,
  channel_id      text not null,
  published_at    timestamptz not null,
  duration_sec    int,
  thumbnail_url   text,
  language        text default 'ja',
  view_count      bigint,
  is_active       boolean default true,
  ingested_at     timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_videos_published_at on public.videos (published_at desc);
create index idx_videos_channel on public.videos (channel_id);
create index idx_videos_is_active on public.videos (is_active) where is_active = true;

-- Trigger to keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_videos_updated_at
  before update on public.videos
  for each row execute function public.touch_updated_at();
