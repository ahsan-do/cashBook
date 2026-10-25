-- Security hardening and ledger-date support. Keep the original migration
-- immutable so environments that already applied it can upgrade safely.

-- Ledger dates are business dates, independent of insertion timestamps.
alter table public.transactions
  add column entry_date date not null default current_date;

create index transactions_book_entry_date_idx
  on public.transactions (book_id, entry_date desc, id desc)
  where deleted_at is null;
create index transactions_book_type_entry_date_idx
  on public.transactions (book_id, type, entry_date desc, id desc)
  where deleted_at is null;

alter table public.transactions
  add constraint transactions_category_length
    check (category is null or char_length(category) <= 60),
  add constraint transactions_description_length
    check (description is null or char_length(description) <= 1000);

alter table public.invitations
  alter column expires_at set default (now() + interval '7 days');

create function public.prevent_transaction_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.book_id is distinct from old.book_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Transaction book, creator, and creation time are immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger transactions_immutable_fields
  before update on public.transactions
  for each row execute function public.prevent_transaction_identity_change();

create function public.prevent_book_member_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.book_id is distinct from old.book_id
     or new.user_id is distinct from old.user_id then
    raise exception 'Book member identity fields are immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger book_members_immutable_fields
  before update on public.book_members
  for each row execute function public.prevent_book_member_identity_change();

create function public.prevent_invitation_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.book_id is distinct from old.book_id
     or new.invited_email is distinct from old.invited_email
     or new.invited_by is distinct from old.invited_by then
    raise exception 'Invitation identity fields are immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger invitations_immutable_fields
  before update on public.invitations
  for each row execute function public.prevent_invitation_identity_change();

-- Membership changes happen only through these checked, atomic RPCs.
drop policy book_members_insert_owners on public.book_members;
drop policy book_members_update_owners on public.book_members;
drop policy book_members_delete_owners on public.book_members;

create or replace function public.remove_member(p_book_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_target_role public.book_member_role;
  v_owner_count integer;
begin
  perform public.require_verified_user();
  perform 1 from public.books where id = p_book_id and deleted_at is null for update;
  if not found or not public.is_book_owner(p_book_id) then
    raise exception 'Active book owner required' using errcode = '42501';
  end if;
  if p_user_id = v_actor then
    raise exception 'Owners cannot remove themselves; transfer ownership or leave after transfer'
      using errcode = '42501';
  end if;
  select role into v_target_role from public.book_members
    where book_id = p_book_id and user_id = p_user_id for update;
  if not found then
    raise exception 'Book member not found' using errcode = 'P0002';
  end if;
  if v_target_role = 'owner' then
    select count(*) into v_owner_count from public.book_members
      where book_id = p_book_id and role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'Cannot remove the last owner' using errcode = '23514';
    end if;
  end if;
  delete from public.book_members where book_id = p_book_id and user_id = p_user_id;
end;
$$;

create or replace function public.leave_book(p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_verified_user();
  v_role public.book_member_role;
  v_owner_count integer;
begin
  perform 1 from public.books where id = p_book_id and deleted_at is null for update;
  if not found then
    raise exception 'Active book not found' using errcode = 'P0002';
  end if;
  select role into v_role from public.book_members
    where book_id = p_book_id and user_id = v_actor for update;
  if not found then
    raise exception 'Book membership required' using errcode = '42501';
  end if;
  if v_role = 'owner' then
    select count(*) into v_owner_count from public.book_members
      where book_id = p_book_id and role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'The last owner cannot leave the book' using errcode = '23514';
    end if;
  end if;
  delete from public.book_members where book_id = p_book_id and user_id = v_actor;
end;
$$;

create or replace function public.transfer_ownership(p_book_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_verified_user();
begin
  perform 1 from public.books where id = p_book_id and deleted_at is null for update;
  if not found or not public.is_book_owner(p_book_id) then
    raise exception 'Active book owner required' using errcode = '42501';
  end if;
  if p_new_owner_id = v_actor then
    raise exception 'Ownership is already held by this user' using errcode = '22023';
  end if;
  perform 1 from public.book_members
    where book_id = p_book_id and user_id = p_new_owner_id for update;
  if not found then
    raise exception 'The new owner must already be a book member' using errcode = 'P0002';
  end if;
  update public.book_members set role = 'owner'
    where book_id = p_book_id and user_id = p_new_owner_id;
  update public.book_members set role = 'member'
    where book_id = p_book_id and user_id = v_actor;
end;
$$;

create or replace function public.decline_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := public.require_verified_user();
  v_email text;
begin
  select lower(email) into v_email from auth.users where id = v_user_id;
  update public.invitations set status = 'declined'
    where id = p_invitation_id and invited_email = v_email
      and status = 'pending' and expires_at > now()
      and exists (select 1 from public.books b where b.id = invitations.book_id and b.deleted_at is null);
  if not found then
    raise exception 'Pending invitation for this account not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := public.require_verified_user();
begin
  update public.invitations i set status = 'declined'
    where i.id = p_invitation_id and i.status = 'pending'
      and exists (select 1 from public.books b where b.id = i.book_id and b.deleted_at is null)
      and public.is_book_owner(i.book_id);
  if not found then
    raise exception 'Pending invitation owned by this account not found' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.soft_delete_book(p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_verified_user();
  update public.books set deleted_at = now()
    where id = p_book_id and deleted_at is null and public.is_book_owner(id);
  if not found then
    raise exception 'Active book owner required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.accept_invitation(p_invitation_id uuid)
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
  if v_invitation.status <> 'pending' or v_invitation.expires_at <= now() then
    raise exception 'Invitation is not pending or has expired' using errcode = '55000';
  end if;
  perform 1 from public.books where id = v_invitation.book_id and deleted_at is null for update;
  if not found then
    raise exception 'Invitation book is deleted or unavailable' using errcode = '55000';
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

create or replace function public.soft_delete_transaction(p_transaction_id uuid)
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
  if not public.is_book_member(v_transaction.book_id) then
    raise exception 'Current book membership required' using errcode = '42501';
  end if;
  if v_transaction.created_by <> v_user_id
     and not public.is_book_owner(v_transaction.book_id) then
    raise exception 'Only the creator or a book owner can delete this transaction' using errcode = '42501';
  end if;
  update public.transactions set deleted_at = now() where id = v_transaction.id;
end;
$$;

drop function public.book_transaction_page(uuid, integer, timestamptz, uuid, public.transaction_type, timestamptz, timestamptz);
create function public.book_transaction_page(
  p_book_id uuid,
  p_limit integer default 50,
  p_before_entry_date date default null,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_type public.transaction_type default null,
  p_from date default null,
  p_to date default null
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
  entry_date date,
  running_balance numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.require_verified_user();
  if not public.is_book_member(p_book_id)
     or not exists (select 1 from public.books where id = p_book_id and deleted_at is null) then
    raise exception 'Active book membership required' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 100 then
    raise exception 'Page size must be between 1 and 100' using errcode = '22023';
  end if;
  return query
  with active as (
    select t.*, sum(case when t.type = 'cash_in' then t.amount else -t.amount end)
      over (order by t.entry_date, t.created_at, t.id rows between unbounded preceding and current row) as running
    from public.transactions t
    where t.book_id = p_book_id and t.deleted_at is null
  )
  select a.id, a.book_id, a.title, a.amount, a.type, a.category, a.description,
         a.created_by, a.created_at, a.updated_at, a.entry_date, a.running
    from active a
    where (p_type is null or a.type = p_type)
      and (p_from is null or a.entry_date >= p_from)
      and (p_to is null or a.entry_date < p_to)
      and (p_before_entry_date is null or (a.entry_date, a.created_at, a.id)
        < (p_before_entry_date, p_before_created_at, p_before_id))
    order by a.entry_date desc, a.created_at desc, a.id desc
    limit p_limit;
end;
$$;

create or replace function public.my_pending_invitations()
returns table (
  invitation_id uuid,
  book_name text,
  inviter_display_name text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
begin
  perform public.require_verified_user();
  select lower(email) into v_email from auth.users where id = v_user_id;
  return query
    select i.id, b.name, p.display_name, i.expires_at
    from public.invitations i
    join public.books b on b.id = i.book_id and b.deleted_at is null
    join public.profiles p on p.id = i.invited_by
    where i.invited_email = v_email and i.status = 'pending' and i.expires_at > now()
    order by i.created_at desc, i.id desc;
end;
$$;

-- Replace policies to make verified checks initPlans and hide soft-deleted books.
drop policy books_read_members on public.books;
create policy books_read_members on public.books
  for select to authenticated
  using ((select public.require_verified_user()) is not null
    and deleted_at is null and (select public.is_book_member(id)));

drop policy books_update_owners on public.books;
create policy books_update_owners on public.books
  for update to authenticated
  using (deleted_at is null and (select public.is_book_owner(id)))
  with check (deleted_at is null and (select public.is_book_owner(id)));
drop policy books_delete_owners on public.books;
revoke delete on public.books from authenticated;

drop policy book_members_read_members on public.book_members;
create policy book_members_read_members on public.book_members
  for select to authenticated
  using ((select public.require_verified_user()) is not null
    and exists (select 1 from public.books b where b.id = book_id and b.deleted_at is null)
    and (select public.is_book_member(book_id)));

drop policy transactions_read_members on public.transactions;
create policy transactions_read_members on public.transactions
  for select to authenticated
  using ((select public.require_verified_user()) is not null
    and deleted_at is null
    and exists (select 1 from public.books b where b.id = book_id and b.deleted_at is null)
    and (select public.is_book_member(book_id)));

drop policy transactions_insert_members on public.transactions;
create policy transactions_insert_members on public.transactions
  for insert to authenticated
  with check ((select public.require_verified_user()) = created_by
    and amount > 0
    and exists (select 1 from public.books b where b.id = book_id and b.deleted_at is null)
    and (select public.is_book_member(book_id)));

drop policy transactions_update_creator_or_owner on public.transactions;
create policy transactions_update_creator on public.transactions
  for update to authenticated
  using (deleted_at is null and created_by = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.deleted_at is null)
    and (select public.is_book_member(book_id)))
  with check (deleted_at is null and created_by = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.deleted_at is null)
    and (select public.is_book_member(book_id)));

drop policy invitations_read_invitee_or_owner on public.invitations;
create policy invitations_read_invitee_or_owner on public.invitations
  for select to authenticated
  using ((select public.require_verified_user()) is not null
    and ((select public.is_book_owner(book_id))
      or lower((select auth.jwt() ->> 'email')) = invited_email));

drop policy invitations_insert_owners on public.invitations;
create policy invitations_insert_owners on public.invitations
  for insert to authenticated
  with check ((select public.require_verified_user()) = invited_by
    and (select public.is_book_owner(book_id))
    and exists (select 1 from public.books b where b.id = book_id and b.deleted_at is null)
    and invited_email = lower(btrim(invited_email)) and status = 'pending');
drop policy invitations_update_owners on public.invitations;

-- No direct membership or invitation status edits; only checked RPCs can mutate them.
revoke insert, update, delete on public.book_members from authenticated;
revoke update on public.invitations from authenticated;

-- Keep SELECT access for active books and visible memberships/invitations.
grant select on public.book_members, public.invitations to authenticated;

-- PUBLIC is the default EXECUTE grantee in PostgreSQL. Explicitly clear it
-- (and anon) for every function in public, then grant only intended RPCs.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.create_book(text, text, text) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.soft_delete_transaction(uuid) to authenticated;
grant execute on function public.book_transaction_page(uuid, integer, date, timestamptz, uuid, public.transaction_type, date, date) to authenticated;
grant execute on function public.book_totals(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.leave_book(uuid) to authenticated;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;
grant execute on function public.decline_invitation(uuid) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.soft_delete_book(uuid) to authenticated;
grant execute on function public.my_pending_invitations() to authenticated;
grant execute on function public.require_verified_user() to authenticated;
grant execute on function public.is_book_member(uuid) to authenticated;
grant execute on function public.is_book_owner(uuid) to authenticated;
