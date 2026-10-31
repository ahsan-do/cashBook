-- Shared-expense ledger. Existing transactions retain paid_by = NULL and do
-- not participate in member balances.

alter table public.transactions
  add column paid_by uuid references public.profiles (id) on delete restrict;

alter table public.transactions
  add constraint transactions_paid_by_cash_out
  check (paid_by is null or type = 'cash_out');

create table public.transaction_splits (
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  share numeric(14,2) not null check (share >= 0),
  primary key (transaction_id, user_id)
);

create index transaction_splits_user_transaction_idx
  on public.transaction_splits (user_id, transaction_id);

create table public.settlements (
  id uuid primary key default extensions.gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  from_user uuid not null references public.profiles (id) on delete restrict,
  to_user uuid not null references public.profiles (id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  entry_date date not null default current_date,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint settlements_different_members check (from_user <> to_user),
  constraint settlements_creator_is_payer check (created_by = from_user)
);

create index settlements_book_date_idx
  on public.settlements (book_id, entry_date desc, created_at desc, id desc)
  where deleted_at is null;
create index settlements_from_user_idx
  on public.settlements (book_id, from_user, entry_date desc)
  where deleted_at is null;
create index settlements_to_user_idx
  on public.settlements (book_id, to_user, entry_date desc)
  where deleted_at is null;

alter table public.transaction_splits enable row level security;
alter table public.settlements enable row level security;

create policy transaction_splits_read_book_members on public.transaction_splits
  for select to authenticated
  using (
    (select public.require_verified_user()) is not null
    and exists (
      select 1
      from public.transactions as t
      join public.books as b on b.id = t.book_id
      where t.id = transaction_splits.transaction_id
        and t.deleted_at is null
        and b.deleted_at is null
        and (select public.is_book_member(t.book_id))
    )
  );

create policy settlements_read_book_members on public.settlements
  for select to authenticated
  using (
    (select public.require_verified_user()) is not null
    and deleted_at is null
    and exists (
      select 1 from public.books as b
      where b.id = settlements.book_id
        and b.deleted_at is null
        and (select public.is_book_member(b.id))
    )
  );

revoke all on public.transaction_splits, public.settlements from anon, authenticated;
grant select on public.transaction_splits, public.settlements to authenticated;

-- Deferred integrity check permits a shared transaction and all of its splits
-- to be created or rebuilt atomically in one RPC transaction.
create function public.check_transaction_split_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction_id uuid;
  v_book_id uuid;
  v_amount numeric(14,2);
  v_type public.transaction_type;
  v_paid_by uuid;
  v_share_total numeric;
begin
  if tg_table_name = 'transactions' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    v_transaction_id := new.id;
  else
    if tg_op = 'DELETE' then
      v_transaction_id := old.transaction_id;
    else
      v_transaction_id := new.transaction_id;
    end if;
  end if;

  select t.book_id, t.amount, t.type, t.paid_by
    into v_book_id, v_amount, v_type, v_paid_by
    from public.transactions as t
    where t.id = v_transaction_id;
  if not found then
    return null;
  end if;

  select coalesce(sum(s.share), 0)
    into v_share_total
    from public.transaction_splits as s
    where s.transaction_id = v_transaction_id;

  if v_paid_by is null then
    if exists (
      select 1 from public.transaction_splits as s
      where s.transaction_id = v_transaction_id
    ) then
      raise exception 'Transaction splits require a payer' using errcode = '23514';
    end if;
    return null;
  end if;

  if v_type <> 'cash_out' then
    raise exception 'Only cash-out transactions can have a payer or splits' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.book_members as bm
    where bm.book_id = v_book_id and bm.user_id = v_paid_by
  ) then
    raise exception 'Payer must be a current member of the book' using errcode = '23514';
  end if;
  if v_share_total <> v_amount then
    raise exception 'Transaction shares must sum exactly to the transaction amount' using errcode = '23514';
  end if;
  if exists (
    select 1
    from public.transaction_splits as s
    where s.transaction_id = v_transaction_id
      and not exists (
        select 1 from public.book_members as bm
        where bm.book_id = v_book_id and bm.user_id = s.user_id
      )
  ) then
    raise exception 'Every participant must be a current member of the book' using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger transactions_shared_split_integrity
  after insert or update on public.transactions
  deferrable initially deferred
  for each row execute function public.check_transaction_split_integrity();

create constraint trigger transaction_splits_integrity
  after insert or update or delete on public.transaction_splits
  deferrable initially deferred
  for each row execute function public.check_transaction_split_integrity();

create function public.prevent_split_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.transaction_id is distinct from old.transaction_id
     or new.user_id is distinct from old.user_id then
    raise exception 'Transaction split identity fields are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger transaction_splits_immutable_identity
  before update on public.transaction_splits
  for each row execute function public.prevent_split_identity_change();

create function public.insert_equal_transaction_splits(
  p_transaction_id uuid,
  p_amount numeric,
  p_participants uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_cents bigint;
  v_base_cents bigint;
  v_remainder bigint;
  v_participant record;
begin
  perform public.require_verified_user();
  if p_participants is null or cardinality(p_participants) = 0
     or exists (
       select 1 from unnest(p_participants) as input(user_id)
       where input.user_id is null
     ) then
    raise exception 'At least one valid participant is required' using errcode = '22023';
  end if;
  if cardinality(p_participants) <> (
    select count(distinct input.user_id)::integer
    from unnest(p_participants) as input(user_id)
  ) then
    raise exception 'Participants must not contain duplicates' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Amount must be positive with no more than two decimal places' using errcode = '22023';
  end if;

  select count(*)::integer
    into v_count
    from (
      select distinct input.user_id
      from unnest(p_participants) as input(user_id)
    ) as participant
    join public.book_members as bm
      on bm.book_id = (
        select t.book_id from public.transactions as t where t.id = p_transaction_id
      )
     and bm.user_id = participant.user_id;
  if v_count <> cardinality(p_participants) then
    raise exception 'Every participant must be a current member of the book' using errcode = '42501';
  end if;

  v_cents := (p_amount * 100)::bigint;
  v_base_cents := v_cents / v_count;
  v_remainder := mod(v_cents, v_count);
  for v_participant in
    select input.user_id,
      row_number() over (order by input.user_id) as ordinal
    from unnest(p_participants) as input(user_id)
    order by input.user_id
  loop
    insert into public.transaction_splits (transaction_id, user_id, share)
    values (
      p_transaction_id,
      v_participant.user_id,
      (v_base_cents + case when v_participant.ordinal <= v_remainder then 1 else 0 end)::numeric / 100
    );
  end loop;
end;
$$;

-- Shared-expense RPCs are the only client write path for splits.
create function public.add_shared_transaction(
  p_book_id uuid,
  p_title text,
  p_amount numeric,
  p_category text,
  p_description text,
  p_entry_date date,
  p_paid_by uuid,
  p_participants uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_verified_user();
  v_transaction_id uuid;
  v_amount numeric(14,2);
begin
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Amount must be positive with no more than two decimal places' using errcode = '22023';
  end if;
  v_amount := p_amount::numeric(14,2);
  perform 1 from public.books as b
    where b.id = p_book_id and b.deleted_at is null for update;
  if not found or not public.is_book_member(p_book_id) then
    raise exception 'Active book membership required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.book_members as bm
    where bm.book_id = p_book_id and bm.user_id = p_paid_by
  ) then
    raise exception 'Payer must be a current member of the book' using errcode = '42501';
  end if;

  insert into public.transactions (
    book_id, title, amount, type, category, description, created_by, entry_date, paid_by
  ) values (
    p_book_id, p_title, v_amount, 'cash_out', p_category, p_description, v_actor, p_entry_date, p_paid_by
  ) returning id into v_transaction_id;

  perform public.insert_equal_transaction_splits(v_transaction_id, v_amount, p_participants);
  return v_transaction_id;
end;
$$;

create function public.edit_shared_transaction(
  p_transaction_id uuid,
  p_book_id uuid,
  p_title text,
  p_amount numeric,
  p_category text,
  p_description text,
  p_entry_date date,
  p_paid_by uuid,
  p_participants uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_verified_user();
  v_transaction public.transactions;
  v_amount numeric(14,2);
begin
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Amount must be positive with no more than two decimal places' using errcode = '22023';
  end if;
  v_amount := p_amount::numeric(14,2);

  select t.* into v_transaction
  from public.transactions as t
  where t.id = p_transaction_id and t.deleted_at is null
  for update;
  if not found then
    raise exception 'Active shared transaction not found' using errcode = 'P0002';
  end if;
  if v_transaction.created_by <> v_actor then
    raise exception 'Only the transaction creator can edit a shared expense' using errcode = '42501';
  end if;
  if v_transaction.book_id <> p_book_id or v_transaction.paid_by is null
     or v_transaction.type <> 'cash_out' then
    raise exception 'Transaction is not an active shared cash-out in this book' using errcode = '22023';
  end if;
  if not public.is_book_member(p_book_id)
     or not exists (select 1 from public.books as b where b.id = p_book_id and b.deleted_at is null) then
    raise exception 'Active book membership required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.book_members as bm
    where bm.book_id = p_book_id and bm.user_id = p_paid_by
  ) then
    raise exception 'Payer must be a current member of the book' using errcode = '42501';
  end if;

  update public.transactions as t
  set title = p_title,
      amount = v_amount,
      category = p_category,
      description = p_description,
      entry_date = p_entry_date,
      paid_by = p_paid_by
  where t.id = p_transaction_id;

  delete from public.transaction_splits as s where s.transaction_id = p_transaction_id;
  perform public.insert_equal_transaction_splits(p_transaction_id, v_amount, p_participants);
  return p_transaction_id;
end;
$$;

create function public.record_settlement(
  p_book_id uuid,
  p_to_user uuid,
  p_amount numeric,
  p_entry_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_verified_user();
  v_amount numeric(14,2);
  v_settlement_id uuid;
begin
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Settlement amount must be positive with no more than two decimal places' using errcode = '22023';
  end if;
  v_amount := p_amount::numeric(14,2);
  if p_to_user = v_actor then
    raise exception 'A settlement must be paid to another book member' using errcode = '22023';
  end if;
  perform 1 from public.books as b
    where b.id = p_book_id and b.deleted_at is null for update;
  if not found or not public.is_book_member(p_book_id) then
    raise exception 'Active book membership required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.book_members as bm
    where bm.book_id = p_book_id and bm.user_id = p_to_user
  ) then
    raise exception 'Settlement recipient must be a current member of the book' using errcode = '42501';
  end if;

  insert into public.settlements (book_id, from_user, to_user, amount, entry_date, created_by)
  values (p_book_id, v_actor, p_to_user, v_amount, p_entry_date, v_actor)
  returning id into v_settlement_id;
  return v_settlement_id;
end;
$$;

create function public.soft_delete_settlement(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_verified_user();
  v_settlement public.settlements;
begin
  select s.* into v_settlement from public.settlements as s
    where s.id = p_settlement_id and s.deleted_at is null for update;
  if not found then
    raise exception 'Active settlement not found' using errcode = 'P0002';
  end if;
  if v_settlement.created_by <> v_actor
     and not public.is_book_owner(v_settlement.book_id) then
    raise exception 'Only the settlement creator or a book owner can delete it' using errcode = '42501';
  end if;
  update public.settlements as s set deleted_at = now() where s.id = p_settlement_id;
end;
$$;

-- A positive balance means the member paid more than their share and is owed
-- money. Settlement effects therefore add payments made and subtract payments
-- received; this makes a debtor's balance move toward zero after paying.
create function public.book_member_balances(p_book_id uuid)
returns table (
  user_id uuid,
  display_name text,
  paid_total numeric,
  share_total numeric,
  settled_net numeric,
  balance numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_verified_user();
  if not public.is_book_member(p_book_id)
     or not exists (select 1 from public.books as b where b.id = p_book_id and b.deleted_at is null) then
    raise exception 'Active book membership required' using errcode = '42501';
  end if;

  return query
  with paid_totals as (
    select t.paid_by as member_id, sum(t.amount) as amount
    from public.transactions as t
    where t.book_id = p_book_id and t.deleted_at is null and t.paid_by is not null
    group by t.paid_by
  ), share_totals as (
    select s.user_id as member_id, sum(s.share) as amount
    from public.transaction_splits as s
    join public.transactions as t on t.id = s.transaction_id
    where t.book_id = p_book_id and t.deleted_at is null and t.paid_by is not null
    group by s.user_id
  ), settlement_totals as (
    select s.from_user as member_id, sum(s.amount) as amount, 'paid'::text as direction
    from public.settlements as s
    where s.book_id = p_book_id and s.deleted_at is null
    group by s.from_user
    union all
    select s.to_user as member_id, sum(s.amount) as amount, 'received'::text as direction
    from public.settlements as s
    where s.book_id = p_book_id and s.deleted_at is null
    group by s.to_user
  ), settlement_net_totals as (
    select st.member_id,
      sum(case when st.direction = 'paid' then st.amount else -st.amount end) as amount
    from settlement_totals as st
    group by st.member_id
  )
  select bm.user_id,
    p.display_name,
    coalesce(pt.amount, 0)::numeric,
    coalesce(sh.amount, 0)::numeric,
    coalesce(sn.amount, 0)::numeric,
    (coalesce(pt.amount, 0) - coalesce(sh.amount, 0) + coalesce(sn.amount, 0))::numeric
  from public.book_members as bm
  join public.profiles as p on p.id = bm.user_id
  left join paid_totals as pt on pt.member_id = bm.user_id
  left join share_totals as sh on sh.member_id = bm.user_id
  left join settlement_net_totals as sn on sn.member_id = bm.user_id
  where bm.book_id = p_book_id
  order by bm.user_id;
end;
$$;

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
  v_balance numeric;
begin
  perform public.require_verified_user();
  perform 1 from public.books as b where b.id = p_book_id and b.deleted_at is null for update;
  if not found or not public.is_book_owner(p_book_id) then
    raise exception 'Active book owner required' using errcode = '42501';
  end if;
  if p_user_id = v_actor then
    raise exception 'Owners cannot remove themselves; transfer ownership or leave after transfer'
      using errcode = '42501';
  end if;
  select bm.role into v_target_role from public.book_members as bm
    where bm.book_id = p_book_id and bm.user_id = p_user_id for update;
  if not found then
    raise exception 'Book member not found' using errcode = 'P0002';
  end if;
  if v_target_role = 'owner' then
    select count(*)::integer into v_owner_count from public.book_members as bm
      where bm.book_id = p_book_id and bm.role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'Cannot remove the last owner' using errcode = '23514';
    end if;
  end if;
  select balances.balance into v_balance
    from public.book_member_balances(p_book_id) as balances
    where balances.user_id = p_user_id;
  if coalesce(v_balance, 0) <> 0 then
    raise exception 'Member has a non-zero balance. Settle shared expenses before removing them.' using errcode = '23514';
  end if;
  delete from public.book_members as bm where bm.book_id = p_book_id and bm.user_id = p_user_id;
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
  v_balance numeric;
begin
  perform 1 from public.books as b where b.id = p_book_id and b.deleted_at is null for update;
  if not found then
    raise exception 'Active book not found' using errcode = 'P0002';
  end if;
  select bm.role into v_role from public.book_members as bm
    where bm.book_id = p_book_id and bm.user_id = v_actor for update;
  if not found then
    raise exception 'Book membership required' using errcode = '42501';
  end if;
  if v_role = 'owner' then
    select count(*)::integer into v_owner_count from public.book_members as bm
      where bm.book_id = p_book_id and bm.role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'The last owner cannot leave the book' using errcode = '23514';
    end if;
  end if;
  select balances.balance into v_balance
    from public.book_member_balances(p_book_id) as balances
    where balances.user_id = v_actor;
  if coalesce(v_balance, 0) <> 0 then
    raise exception 'You have a non-zero balance. Settle shared expenses before leaving this book.' using errcode = '23514';
  end if;
  delete from public.book_members as bm where bm.book_id = p_book_id and bm.user_id = v_actor;
end;
$$;

-- Replace the ledger RPC return shape. SECURITY DEFINER is required here so
-- members can still see display names for former members; access is explicitly
-- checked before the query, and profile rows contain only display metadata.
drop function public.book_transaction_page(uuid, integer, date, timestamptz, uuid, public.transaction_type, date, date);
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
  created_by_name text,
  created_at timestamptz,
  updated_at timestamptz,
  entry_date date,
  running_balance numeric,
  paid_by uuid,
  paid_by_name text,
  participants jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_verified_user();
  if not public.is_book_member(p_book_id)
     or not exists (
       select 1 from public.books as b
       where b.id = p_book_id and b.deleted_at is null
     ) then
    raise exception 'Active book membership required' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 100 then
    raise exception 'Page size must be between 1 and 100' using errcode = '22023';
  end if;

  return query
  with active as (
    select t.id as transaction_id,
      t.book_id as transaction_book_id,
      t.title as transaction_title,
      t.amount as transaction_amount,
      t.type as transaction_type,
      t.category as transaction_category,
      t.description as transaction_description,
      t.created_by as transaction_created_by,
      creator.display_name as creator_display_name,
      t.created_at as transaction_created_at,
      t.updated_at as transaction_updated_at,
      t.entry_date as transaction_entry_date,
      t.paid_by as transaction_paid_by,
      payer.display_name as payer_display_name,
      sum(case when t.type = 'cash_in' then t.amount else -t.amount end)
        over (order by t.entry_date, t.created_at, t.id rows between unbounded preceding and current row) as transaction_running_balance,
      coalesce((
        select jsonb_agg(
          jsonb_build_object('user_id', split.user_id, 'display_name', participant.display_name)
          order by split.user_id
        )
        from public.transaction_splits as split
        join public.profiles as participant on participant.id = split.user_id
        where split.transaction_id = t.id
      ), '[]'::jsonb) as transaction_participants
    from public.transactions as t
    left join public.profiles as creator on creator.id = t.created_by
    left join public.profiles as payer on payer.id = t.paid_by
    where t.book_id = p_book_id and t.deleted_at is null
  )
  select active.transaction_id,
    active.transaction_book_id,
    active.transaction_title,
    active.transaction_amount,
    active.transaction_type,
    active.transaction_category,
    active.transaction_description,
    active.transaction_created_by,
    active.creator_display_name,
    active.transaction_created_at,
    active.transaction_updated_at,
    active.transaction_entry_date,
    active.transaction_running_balance,
    active.transaction_paid_by,
    active.payer_display_name,
    active.transaction_participants
  from active
  where (p_type is null or active.transaction_type = p_type)
    and (p_from is null or active.transaction_entry_date >= p_from)
    and (p_to is null or active.transaction_entry_date < p_to)
    and (
      p_before_entry_date is null
      or (active.transaction_entry_date, active.transaction_created_at, active.transaction_id)
        < (p_before_entry_date, p_before_created_at, p_before_id)
    )
  order by active.transaction_entry_date desc, active.transaction_created_at desc, active.transaction_id desc
  limit p_limit;
end;
$$;

revoke execute on function public.check_transaction_split_integrity() from public, anon, authenticated;
revoke execute on function public.prevent_split_identity_change() from public, anon, authenticated;
revoke execute on function public.insert_equal_transaction_splits(uuid, numeric, uuid[]) from public, anon, authenticated;
revoke execute on function public.add_shared_transaction(uuid, text, numeric, text, text, date, uuid, uuid[]) from public, anon;
revoke execute on function public.edit_shared_transaction(uuid, uuid, text, numeric, text, text, date, uuid, uuid[]) from public, anon;
revoke execute on function public.record_settlement(uuid, uuid, numeric, date) from public, anon;
revoke execute on function public.soft_delete_settlement(uuid) from public, anon;
revoke execute on function public.book_member_balances(uuid) from public, anon;
revoke execute on function public.book_transaction_page(uuid, integer, date, timestamptz, uuid, public.transaction_type, date, date) from public, anon;

grant execute on function public.add_shared_transaction(uuid, text, numeric, text, text, date, uuid, uuid[]) to authenticated;
grant execute on function public.edit_shared_transaction(uuid, uuid, text, numeric, text, text, date, uuid, uuid[]) to authenticated;
grant execute on function public.record_settlement(uuid, uuid, numeric, date) to authenticated;
grant execute on function public.soft_delete_settlement(uuid) to authenticated;
grant execute on function public.book_member_balances(uuid) to authenticated;
grant execute on function public.book_transaction_page(uuid, integer, date, timestamptz, uuid, public.transaction_type, date, date) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.leave_book(uuid) to authenticated;

