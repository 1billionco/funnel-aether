-- M2: Brand Voice (RAG). Documents, chunks with pgvector embeddings, retrieval,
-- usage telemetry for AI/embedding calls, and the private upload bucket.

create type public.document_status as enum ('uploading', 'queued', 'processing', 'ready', 'failed');
create type public.document_source as enum ('upload', 'paste', 'url');

-- Document types and their weights come from the original backend's quality scoring.
create table public.brand_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  doc_type text not null default 'past_content' check (doc_type in (
    'guidelines', 'tone_examples', 'past_content', 'website_copy',
    'social_posts', 'email_templates', 'ad_copy', 'blog_posts')),
  source public.document_source not null,
  source_url text check (char_length(source_url) <= 2000),
  filename text check (char_length(filename) <= 255),
  mime text check (char_length(mime) <= 120),
  size_bytes integer check (size_bytes >= 0 and size_bytes <= 10485760),
  storage_path text,
  keep_original boolean not null default false,
  status public.document_status not null default 'uploading',
  error text,
  char_count integer not null default 0,
  chunk_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  processed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brand_documents_brand_idx on public.brand_documents (brand_id, created_at desc) where deleted_at is null;
create trigger brand_documents_touch before update on public.brand_documents
  for each row execute function private.touch_updated_at();

create table public.brand_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  document_id uuid not null references public.brand_documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer not null default 0,
  embedding extensions.vector(1024) not null,
  -- Mock and real vectors are not comparable: retrieval always filters on the current model.
  embedding_model text not null,
  created_at timestamptz not null default now()
);
create index brand_chunks_brand_model_idx on public.brand_chunks (brand_id, embedding_model);
create index brand_chunks_document_idx on public.brand_chunks (document_id);
create index brand_chunks_embedding_hnsw on public.brand_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- Telemetry for every AI and embedding call, including mock ones (spec §6.6).
create table public.usage_events (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  feature text not null,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cached_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  est_cost_usd numeric(12, 6) not null default 0,
  latency_ms integer,
  is_mock boolean not null default false,
  router_reason text,
  ref_id uuid,
  at timestamptz not null default now()
);
create index usage_events_org_at_idx on public.usage_events (org_id, at);
create index usage_events_at_idx on public.usage_events (at);

alter table public.brand_documents enable row level security;
alter table public.brand_chunks enable row level security;
alter table public.usage_events enable row level security;

-- Members see their brand's documents; creation and processing go through the server.
create policy brand_documents_select on public.brand_documents for select to authenticated
  using (private.is_org_member(org_id));
create policy brand_documents_update on public.brand_documents for update to authenticated
  using (private.has_org_role(org_id, '{owner,editor}'))
  with check (private.has_org_role(org_id, '{owner,editor}'));
revoke insert, update, delete on public.brand_documents from authenticated, anon;
grant update (title, doc_type, keep_original, deleted_at) on public.brand_documents to authenticated;

create policy brand_chunks_select on public.brand_chunks for select to authenticated
  using (private.is_org_member(org_id));
revoke insert, update, delete on public.brand_chunks from authenticated, anon;

-- usage_events: founder-only via service role.
revoke all on public.usage_events from authenticated, anon;

-- ---------------------------------------------------------------- retrieval
-- Top-k chunks for a brand by cosine similarity, filtered to one embedding
-- model. pgvector 0.8 iterative index scans keep returning rows until k
-- matches pass the brand/model filter (plain HNSW + WHERE can return fewer).
-- SECURITY INVOKER: RLS applies for user-scoped callers.
create or replace function public.match_brand_chunks(
  p_brand uuid,
  p_query extensions.vector(1024),
  p_model text,
  p_k integer default 20
)
returns table (id uuid, document_id uuid, content text, similarity double precision)
language sql
stable
set search_path = public, extensions
set hnsw.iterative_scan = 'relaxed_order'
as $$
  select m.id, m.document_id, m.content, m.similarity
  from (
    select c.id, c.document_id, c.content, 1 - (c.embedding <=> p_query) as similarity
    from public.brand_chunks c
    where c.brand_id = p_brand and c.embedding_model = p_model
    order by c.embedding <=> p_query
    limit greatest(1, least(p_k, 100))
  ) m
  -- relaxed_order can return slightly out-of-order rows; re-sort.
  order by m.similarity desc;
$$;
grant execute on function public.match_brand_chunks(uuid, extensions.vector, text, integer) to authenticated, service_role;

-- Mean embedding of a brand's chunks (for the brand-match score, spec §6.4).
create or replace function public.brand_centroid(p_brand uuid, p_model text)
returns extensions.vector
language sql
stable
set search_path = public, extensions
as $$
  select avg(embedding) from public.brand_chunks where brand_id = p_brand and embedding_model = p_model;
$$;
grant execute on function public.brand_centroid(uuid, text) to authenticated, service_role;

-- Fresh counts straight from the tables (fixes the old backend's stale-count bug,
-- which read counts before the new rows were flushed).
create or replace function public.brand_document_stats(p_brand uuid)
returns table (document_count integer, chunk_count integer, doc_types text[])
language sql
stable
set search_path = ''
as $$
  select count(*)::integer,
         coalesce(sum(d.chunk_count), 0)::integer,
         coalesce(array_agg(distinct d.doc_type), '{}')
  from public.brand_documents d
  where d.brand_id = p_brand and d.status = 'ready' and d.deleted_at is null;
$$;
grant execute on function public.brand_document_stats(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- storage
-- Private bucket; uploads go browser → Storage via signed upload URLs
-- created by the server. Path: {org_id}/{brand_id}/{document_id}/{filename}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-docs', 'brand-docs', false, 10485760,
  array['application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'text/markdown', 'text/csv']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Members may read and delete their own org's files (e.g. "keep original");
-- nobody can write directly. Writes use server-issued signed upload URLs.
create policy brand_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'brand-docs'
         and private.is_org_member(((storage.foldername(name))[1])::uuid));
create policy brand_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'brand-docs'
         and private.has_org_role(((storage.foldername(name))[1])::uuid, '{owner,editor}'));

-- ---------------------------------------------------------------- model prices
-- Per-model prices in USD per million tokens (spec §6.6). Editable in admin;
-- never hard-coded in app code. NULL = unknown (cost recorded as 0 and
-- flagged in admin). Seeded from Anthropic's published rates (Oct 2026);
-- `verified_at` stays NULL until Joshua confirms them on the pricing pages.
create table public.model_prices (
  model text primary key,
  provider text not null,
  input_per_mtok numeric(10, 4),
  output_per_mtok numeric(10, 4),
  cache_read_per_mtok numeric(10, 4),
  cache_write_per_mtok numeric(10, 4),
  notes text,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.model_prices enable row level security;
revoke all on public.model_prices from authenticated, anon;

insert into public.model_prices (model, provider, input_per_mtok, output_per_mtok, cache_read_per_mtok, cache_write_per_mtok, notes) values
  ('claude-haiku-5-5', 'anthropic', 0.10, 0.50, 0.01, 0.125,
   'Prompts up to 100K tokens. Cache read/write derived from the documented 0.1x / 1.25x multipliers - verify.'),
  ('claude-sonnet-5-5', 'anthropic', 2.00, 10.00, 0.20, 2.50,
   'Cache write derived from the documented 1.25x multiplier - verify.'),
  ('voyage-4-lite', 'voyage', null, null, null, null,
   'Fill in from Voyage pricing. Embeddings are logged but not charged as credits.'),
  ('mock', 'mock', 0, 0, 0, 0, 'Deterministic local generator/embedder.')
on conflict (model) do nothing;
