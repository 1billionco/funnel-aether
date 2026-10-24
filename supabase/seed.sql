-- Local/dev only (supabase db reset). Demo personas are seeded by scripts/seed.ts.
insert into public.beta_invites (code, max_uses, note)
values ('LOCAL-DEV', 1000, 'Local development invite')
on conflict do nothing;
