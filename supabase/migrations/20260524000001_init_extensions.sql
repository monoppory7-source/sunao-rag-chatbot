-- Enable required Postgres extensions.
-- Run this first in the Supabase Dashboard SQL Editor.

create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists unaccent;
