-- RETURNS TABLE names are PL/pgSQL variables. Qualify all table references in
-- these RPC bodies so output variables can never shadow column names.

create or replace function public.book_transaction_page(
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
     or not exists (
       select 1
       from public.books as b
       where b.id = p_book_id and b.deleted_at is null
     ) then
    raise exception 'Active book membership required' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 100 then
    raise exception 'Page size must be between 1 and 100' using errcode = '22023';
  end if;

  return query
  with active as (
    select
      t.id,
      t.book_id,
      t.title,
      t.amount,
      t.type,
      t.category,
      t.description,
      t.created_by,
      t.created_at,
      t.updated_at,
      t.entry_date,
      sum(case when t.type = 'cash_in' then t.amount else -t.amount end)
        over (
          order by t.entry_date, t.created_at, t.id
          rows between unbounded preceding and current row
        ) as running
    from public.transactions as t
    where t.book_id = p_book_id and t.deleted_at is null
  )
  select
    a.id,
    a.book_id,
    a.title,
    a.amount,
    a.type,
    a.category,
    a.description,
    a.created_by,
    a.created_at,
    a.updated_at,
    a.entry_date,
    a.running
  from active as a
  where (p_type is null or a.type = p_type)
    and (p_from is null or a.entry_date >= p_from)
    and (p_to is null or a.entry_date < p_to)
    and (
      p_before_entry_date is null
      or (a.entry_date, a.created_at, a.id)
        < (p_before_entry_date, p_before_created_at, p_before_id)
    )
  order by a.entry_date desc, a.created_at desc, a.id desc
  limit p_limit;
end;
$$;

create or replace function public.book_totals(p_book_id uuid)
returns table (
  cash_in_total numeric,
  cash_out_total numeric,
  net_balance numeric
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

  return query
  select
    coalesce(sum(t.amount) filter (where t.type = 'cash_in'), 0),
    coalesce(sum(t.amount) filter (where t.type = 'cash_out'), 0),
    coalesce(sum(case when t.type = 'cash_in' then t.amount else -t.amount end), 0)
  from public.transactions as t
  where t.book_id = p_book_id and t.deleted_at is null;
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
  select lower(u.email)
    into v_email
    from auth.users as u
    where u.id = v_user_id;

  return query
  select i.id, b.name, p.display_name, i.expires_at
  from public.invitations as i
  join public.books as b on b.id = i.book_id and b.deleted_at is null
  join public.profiles as p on p.id = i.invited_by
  where i.invited_email = v_email
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at desc, i.id desc;
end;
$$;

revoke all on function public.book_transaction_page(uuid, integer, date, timestamptz, uuid, public.transaction_type, date, date) from public, anon;
revoke all on function public.book_totals(uuid) from public, anon;
revoke all on function public.my_pending_invitations() from public, anon;
grant execute on function public.book_transaction_page(uuid, integer, date, timestamptz, uuid, public.transaction_type, date, date) to authenticated;
grant execute on function public.book_totals(uuid) to authenticated;
grant execute on function public.my_pending_invitations() to authenticated;
