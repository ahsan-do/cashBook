-- Provision profile names and avatars from the metadata keys used by both
-- email signups and Google OAuth. CREATE OR REPLACE preserves the function's
-- existing owner and execution grants.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    pg_catalog.left(
      coalesce(
        nullif(pg_catalog.regexp_replace(new.raw_user_meta_data ->> 'display_name', '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
        nullif(pg_catalog.regexp_replace(new.raw_user_meta_data ->> 'full_name', '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
        nullif(pg_catalog.regexp_replace(new.raw_user_meta_data ->> 'name', '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
        ''
      ),
      120
    ),
    coalesce(
      nullif(pg_catalog.regexp_replace(new.raw_user_meta_data ->> 'avatar_url', '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
      nullif(pg_catalog.regexp_replace(new.raw_user_meta_data ->> 'picture', '^[[:space:]]+|[[:space:]]+$', '', 'g'), '')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
