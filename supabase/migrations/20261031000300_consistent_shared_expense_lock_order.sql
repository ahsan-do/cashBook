-- Shared-ledger mutations acquire locks in this order:
-- book row, transaction rows, then settlement rows.

create or replace function public.edit_shared_transaction(
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

  perform 1 from public.books as b
    where b.id = p_book_id and b.deleted_at is null for update;
  if not found or not public.is_book_member(p_book_id) then
    raise exception 'Active book membership required' using errcode = '42501';
  end if;

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

create or replace function public.soft_delete_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_verified_user();
  v_book_id uuid;
  v_transaction public.transactions;
begin
  select t.book_id into v_book_id
  from public.transactions as t
  where t.id = p_transaction_id and t.deleted_at is null;
  if not found then
    raise exception 'Active transaction not found' using errcode = 'P0002';
  end if;

  perform 1 from public.books as b
    where b.id = v_book_id and b.deleted_at is null for update;
  if not found then
    raise exception 'Active book not found' using errcode = 'P0002';
  end if;

  select t.* into v_transaction
  from public.transactions as t
  where t.id = p_transaction_id and t.deleted_at is null
  for update;
  if not found then
    raise exception 'Active transaction not found' using errcode = 'P0002';
  end if;
  if not public.is_book_member(v_transaction.book_id) then
    raise exception 'Current book membership required' using errcode = '42501';
  end if;
  if v_transaction.created_by <> v_actor
     and not public.is_book_owner(v_transaction.book_id) then
    raise exception 'Only the creator or a book owner can delete this transaction' using errcode = '42501';
  end if;
  update public.transactions as t set deleted_at = now() where t.id = p_transaction_id;
end;
$$;

create or replace function public.soft_delete_settlement(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_verified_user();
  v_book_id uuid;
  v_settlement public.settlements;
begin
  select s.book_id into v_book_id
  from public.settlements as s
  where s.id = p_settlement_id and s.deleted_at is null;
  if not found then
    raise exception 'Active settlement not found' using errcode = 'P0002';
  end if;

  perform 1 from public.books as b
    where b.id = v_book_id and b.deleted_at is null for update;
  if not found then
    raise exception 'Active book not found' using errcode = 'P0002';
  end if;
  perform t.id from public.transactions as t
    where t.book_id = v_book_id and t.deleted_at is null for update;
  perform s.id from public.settlements as s
    where s.book_id = v_book_id and s.deleted_at is null for update;

  select s.* into v_settlement
  from public.settlements as s
  where s.id = p_settlement_id and s.deleted_at is null
  for update;
  if not found then
    raise exception 'Active settlement not found' using errcode = 'P0002';
  end if;
  if v_settlement.created_by <> v_actor
     and not public.is_book_owner(v_book_id) then
    raise exception 'Only the settlement creator or a book owner can delete it' using errcode = '42501';
  end if;
  update public.settlements as s set deleted_at = now() where s.id = p_settlement_id;
end;
$$;

revoke execute on function public.edit_shared_transaction(uuid, uuid, text, numeric, text, text, date, uuid, uuid[]) from public, anon;
revoke execute on function public.soft_delete_transaction(uuid) from public, anon;
revoke execute on function public.soft_delete_settlement(uuid) from public, anon;
grant execute on function public.edit_shared_transaction(uuid, uuid, text, numeric, text, text, date, uuid, uuid[]) to authenticated;
grant execute on function public.soft_delete_transaction(uuid) to authenticated;
grant execute on function public.soft_delete_settlement(uuid) to authenticated;
