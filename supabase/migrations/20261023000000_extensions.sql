-- M0: extensions required across the schema.
-- pgvector powers brand-voice retrieval (brand_chunks.embedding vector(1024), see M2).
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;
