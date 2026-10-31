-- Do not allow a settlement to exceed the caller's current net amount owed.
create or replace function public.record_settlement(
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
  v_payer_balance numeric;
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

  -- Serialize against edits/deletes that can change the net amount owed.
  perform t.id from public.transactions as t
    where t.book_id = p_book_id and t.deleted_at is null for update;
  perform s.id from public.settlements as s
    where s.book_id = p_book_id and s.deleted_at is null for update;

  select balances.balance into v_payer_balance
  from public.book_member_balances(p_book_id) as balances
  where balances.user_id = v_actor;
  if coalesce(v_payer_balance, 0) >= 0 then
    raise exception 'You do not currently owe a settlement amount' using errcode = '23514';
  end if;
  if v_amount > -v_payer_balance then
    raise exception 'Settlement amount exceeds your outstanding balance' using errcode = '23514';
  end if;

  insert into public.settlements (book_id, from_user, to_user, amount, entry_date, created_by)
  values (p_book_id, v_actor, p_to_user, v_amount, p_entry_date, v_actor)
  returning id into v_settlement_id;
  return v_settlement_id;
end;
$$;

revoke execute on function public.record_settlement(uuid, uuid, numeric, date) from public, anon;
grant execute on function public.record_settlement(uuid, uuid, numeric, date) to authenticated;
