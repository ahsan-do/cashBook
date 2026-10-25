-- Fresh-start schema for Cashbook. Supabase Auth owns credentials; this schema
-- stores application profile and ledger data only.

create extension if not exists pgcrypto with schema extensions;

create type public.book_member_role as enum ('owner', 'member');
create type public.transaction_type as enum ('cash_in', 'cash_out');
create type public.invitation_status as enum ('pending', 'accepted', 'declined');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 120)
);

create table public.books (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  description text,
  currency_code text not null default 'PKR',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint books_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint books_currency_code_format check (currency_code ~ '^[A-Z]{3}$')
);

create table public.book_members (
  book_id uuid not null references public.books (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.book_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

create table public.transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  title text not null,
  amount numeric(14,2) not null,
  type public.transaction_type not null,
  category text not null default 'General',
  description text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint transactions_amount_positive check (amount > 0),
  constraint transactions_title_length check (char_length(btrim(title)) between 1 and 200)
);

create table public.invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  status public.invitation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint invitations_email_normalized check (invited_email = lower(btrim(invited_email)))
);

create unique index invitations_one_pending_per_book_email
  on public.invitations (book_id, invited_email)
  where status = 'pending';

create index book_members_user_book_idx on public.book_members (user_id, book_id);
create index transactions_book_date_id_idx on public.transactions (book_id, created_at desc, id desc)
  where deleted_at is null;
create index transactions_book_type_date_idx on public.transactions (book_id, type, created_at desc, id desc)
  where deleted_at is null;
create index invitations_email_status_idx on public.invitations (invited_email, status, created_at desc);
create index invitations_book_status_idx on public.invitations (book_id, status);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger books_set_updated_at before update on public.books
  for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger invitations_set_updated_at before update on public.invitations
  for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- All trusted user-facing RPCs require a confirmed Auth email. Enabling
-- Supabase's Confirm email setting is still required for the sign-up flow.
create function public.require_verified_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email_confirmed_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select u.email_confirmed_at into v_email_confirmed_at
    from auth.users as u where u.id = v_user_id;
  if v_email_confirmed_at is null then
    raise exception 'Verified email required' using errcode = '42501';
  end if;
  return v_user_id;
end;
$$;

create function public.is_book_member(p_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.book_members as bm
    where bm.book_id = p_book_id and bm.user_id = (select auth.uid())
  );
$$;

create function public.is_book_owner(p_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.book_members as bm
    where bm.book_id = p_book_id and bm.user_id = (select auth.uid()) and bm.role = 'owner'
  );
$$;

-- Create a book and its first owner membership in one transaction.
create function public.create_book(
  p_name text,
  p_currency_code text default 'PKR',
  p_description text default null
)
returns public.books
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := public.require_verified_user();
  v_book public.books;
begin
  insert into public.books (name, currency_code, description, created_by)
  values (btrim(p_name), upper(btrim(p_currency_code)), nullif(btrim(p_description), ''), v_user_id)
  returning * into v_book;

  insert into public.book_members (book_id, user_id, role)
  values (v_book.id, v_user_id, 'owner');

  return v_book;
end;
$$;

create function public.accept_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := public.require_verified_user();
  v_user_email text;
  v_invitation public.invitations;
begin
  select lower(u.email) into v_user_email from auth.users as u where u.id = v_user_id;
  select * into v_invitation from public.invitations
    where id = p_invitation_id for update;

  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  if v_invitation.invited_email <> v_user_email then
    raise exception 'Invitation belongs to another email' using errcode = '42501';
  end if;
  if v_invitation.status <> 'pending'
     or (v_invitation.expires_at is not null and v_invitation.expires_at <= now()) then
    raise exception 'Invitation is not pending or has expired' using errcode = '55000';
  end if;
  if exists (select 1 from public.book_members where book_id = v_invitation.book_id and user_id = v_user_id) then
    raise exception 'Already a member of this book' using errcode = '23505';
  end if;

  insert into public.book_members (book_id, user_id, role)
  values (v_invitation.book_id, v_user_id, 'member');
  update public.invitations set status = 'accepted' where id = v_invitation.id;
  return v_invitation.book_id;
end;
$$;

-- Soft deletion is performed by a privileged, ownership-aware RPC. The
-- transaction creator or a book owner may delete; repeated requests fail.
create function public.soft_delete_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := public.require_verified_user();
  v_transaction public.transactions;
begin
  select * into v_transaction from public.transactions
    where id = p_transaction_id and deleted_at is null for update;
  if not found then
    raise exception 'Active transaction not found' using errcode = 'P0002';
  end if;
  if v_transaction.created_by <> v_user_id
     and not public.is_book_owner(v_transaction.book_id) then
    raise exception 'Only the creator or a book owner can delete this transaction' using errcode = '42501';
  end if;
  update public.transactions set deleted_at = now() where id = v_transaction.id;
end;
$$;

-- The cursor is an opaque created_at/id pair represented as arguments. The
-- running balance is computed across every active transaction before date/type
-- filters hide rows, so filtering never changes displayed balance values.
create function public.book_transaction_page(
  p_book_id uuid,
  p_limit integer default 50,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_type public.transaction_type default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  id uuid,
  book_id uuid,
  title text,
  amount numeric(14,2),
  type public.transaction_type,
  category text,
  description text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  running_balance numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.require_verified_user();
  if not public.is_book_member(p_book_id) then
    raise exception 'Book membership required' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 100 then
    raise exception 'Page size must be between 1 and 100' using errcode = '22023';
  end if;

  return query
  with active as (
    select t.*, sum(case when t.type = 'cash_in' then t.amount else -t.amount end)
      over (order by t.created_at, t.id rows between unbounded preceding and current row) as running
    from public.transactions as t
    where t.book_id = p_book_id and t.deleted_at is null
  )
  select a.id, a.book_id, a.title, a.amount, a.type, a.category, a.description,
         a.created_by, a.created_at, a.updated_at, a.running
  from active as a
  where (p_type is null or a.type = p_type)
    and (p_from is null or a.created_at >= p_from)
    and (p_to is null or a.created_at < p_to)
    and (p_before_created_at is null or (a.created_at, a.id) < (p_before_created_at, p_before_id))
  order by a.created_at desc, a.id desc
  limit p_limit;
end;
$$;

create function public.book_totals(p_book_id uuid)
returns table (cash_in_total numeric, cash_out_total numeric, net_balance numeric)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.require_verified_user();
  if not public.is_book_member(p_book_id) then
    raise exception 'Book membership required' using errcode = '42501';
  end if;
  return query
    select coalesce(sum(t.amount) filter (where t.type = 'cash_in'), 0),
           coalesce(sum(t.amount) filter (where t.type = 'cash_out'), 0),
           coalesce(sum(case when t.type = 'cash_in' then t.amount else -t.amount end), 0)
    from public.transactions as t
    where t.book_id = p_book_id and t.deleted_at is null;
end;
$$;

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.book_members enable row level security;
alter table public.transactions enable row level security;
alter table public.invitations enable row level security;

-- Profile fields available through table reads contain no email or other auth data.
create policy profiles_read_self_or_shared_book on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.book_members mine
      join public.book_members theirs on theirs.book_id = mine.book_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy books_read_members on public.books
  for select to authenticated
  using (public.require_verified_user() is not null and public.is_book_member(id));
create policy books_update_owners on public.books
  for update to authenticated
  using (public.is_book_owner(id))
  with check (public.is_book_owner(id));
create policy books_delete_owners on public.books
  for delete to authenticated
  using (public.require_verified_user() is not null and public.is_book_owner(id));

create policy book_members_read_members on public.book_members
  for select to authenticated
  using (public.require_verified_user() is not null and public.is_book_member(book_id));
create policy book_members_insert_owners on public.book_members
  for insert to authenticated
  with check (public.require_verified_user() is not null and public.is_book_owner(book_id) and role = 'member');
create policy book_members_update_owners on public.book_members
  for update to authenticated
  using (public.require_verified_user() is not null and public.is_book_owner(book_id))
  with check (public.require_verified_user() is not null and public.is_book_owner(book_id) and role = 'member');
create policy book_members_delete_owners on public.book_members
  for delete to authenticated
  using (public.require_verified_user() is not null and public.is_book_owner(book_id) and role = 'member');

create policy transactions_read_members on public.transactions
  for select to authenticated
  using (public.require_verified_user() is not null and public.is_book_member(book_id) and deleted_at is null);
create policy transactions_insert_members on public.transactions
  for insert to authenticated
  with check (
    public.require_verified_user() = created_by
    and public.is_book_member(book_id)
    and amount > 0
  );
create policy transactions_update_creator_or_owner on public.transactions
  for update to authenticated
  using (deleted_at is null and (created_by = (select auth.uid()) or public.is_book_owner(book_id)))
  with check (
    public.is_book_member(book_id)
    and created_by = (select auth.uid())
    and deleted_at is null
  );
-- Clients cannot delete rows directly; use soft_delete_transaction RPC.

create policy invitations_read_invitee_or_owner on public.invitations
  for select to authenticated
  using (
    public.require_verified_user() is not null
    and (public.is_book_owner(book_id) or lower((select auth.jwt() ->> 'email')) = invited_email)
  );
create policy invitations_insert_owners on public.invitations
  for insert to authenticated
  with check (
    public.require_verified_user() = invited_by
    and public.is_book_owner(book_id)
    and invited_email = lower(btrim(invited_email))
    and status = 'pending'
  );
create policy invitations_update_owners on public.invitations
  for update to authenticated
  using (public.is_book_owner(book_id))
  with check (public.is_book_owner(book_id));

revoke all on public.profiles, public.books, public.book_members, public.transactions, public.invitations from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, update, delete on public.books to authenticated;
grant select, insert, update, delete on public.book_members to authenticated;
grant select, insert, update on public.transactions to authenticated;
grant select, insert, update on public.invitations to authenticated;
grant execute on function public.create_book(text, text, text) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.soft_delete_transaction(uuid) to authenticated;
grant execute on function public.book_transaction_page(uuid, integer, timestamptz, uuid, public.transaction_type, timestamptz, timestamptz) to authenticated;
grant execute on function public.book_totals(uuid) to authenticated;
grant execute on function public.require_verified_user() to authenticated;
grant execute on function public.is_book_member(uuid) to authenticated;
grant execute on function public.is_book_owner(uuid) to authenticated;

-- Auth profile trigger and RLS helper functions are not directly callable by clients.
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.require_verified_user() from public, anon;
revoke all on function public.is_book_member(uuid) from public, anon;
revoke all on function public.is_book_owner(uuid) from public, anon;

