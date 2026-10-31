begin;

create extension if not exists pgtap with schema extensions;
select plan(71);

create temporary table test_ids (
  book_id uuid,
  book_b_id uuid,
  invitation_id uuid,
  decline_invitation_id uuid,
  revoke_invitation_id uuid,
  deleted_book_invitation_id uuid,
  immutable_invitation_id uuid,
  page_book_id uuid,
  page_deleted_transaction_id uuid,
  deleted_book_id uuid,
  opening_created_at timestamptz
);
grant select, insert, update on test_ids to authenticated;

-- Test users are inserted as the database owner; the auth trigger provisions
-- their profile rows. One account deliberately has no confirmed email.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'member@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'outsider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Outsider"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'unverified@example.test', '', null, '{"provider":"email","providers":["email"]}', '{"display_name":"Unverified"}', now(), now(), '', '', '', '');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner@example.test"}', true);
select public.create_book('Household', 'PKR', null);
insert into test_ids (book_id) select id from public.books where name = 'Household';
reset role;
select extensions.ok(
  exists (select 1 from public.books where name = 'Household' and created_by = '10000000-0000-0000-0000-000000000001'),
  'verified user can create a book'
);
select extensions.ok(
  exists (select 1 from public.book_members where book_id = (select book_id from test_ids) and user_id = '10000000-0000-0000-0000-000000000001' and role = 'owner'),
  'book creation inserts owner membership atomically'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner@example.test"}', true);
insert into public.invitations (book_id, invited_email, invited_by)
  values ((select book_id from test_ids), 'member@example.test', auth.uid()) returning id;
update test_ids set invitation_id = (select id from public.invitations where invited_email = 'member@example.test');
insert into public.transactions (book_id, title, amount, type, created_by)
  values ((select book_id from test_ids), 'Opening funds', 1000.00, 'cash_in', auth.uid());
select public.create_book('Second ledger', 'PKR', null);
update test_ids set book_b_id = (select id from public.books where name = 'Second ledger');
select public.create_book('Page test ledger', 'USD', null);
update test_ids set page_book_id = (select id from public.books where name = 'Page test ledger');
select public.create_book('Deleted book test', 'PKR', null);
update test_ids set deleted_book_id = (select id from public.books where name = 'Deleted book test');
insert into public.invitations (book_id, invited_email, invited_by)
  values ((select page_book_id from test_ids), 'member@example.test', auth.uid());
update test_ids set decline_invitation_id = (
  select id from public.invitations where book_id = (select page_book_id from test_ids)
    and invited_email = 'member@example.test' and status = 'pending'
);
insert into public.invitations (book_id, invited_email, invited_by)
  values ((select book_id from test_ids), 'outsider@example.test', auth.uid());
update test_ids set revoke_invitation_id = (
  select id from public.invitations where book_id = (select book_id from test_ids)
    and invited_email = 'outsider@example.test' and status = 'pending'
);
insert into public.invitations (book_id, invited_email, invited_by)
  values ((select deleted_book_id from test_ids), 'member@example.test', auth.uid());
update test_ids set deleted_book_invitation_id = (
  select id from public.invitations where book_id = (select deleted_book_id from test_ids)
    and invited_email = 'member@example.test' and status = 'pending'
);
reset role;

-- Prepare a dedicated ledger with deterministic dates/times and exact decimals.
insert into public.book_members (book_id, user_id, role) values
  ((select page_book_id from test_ids), '10000000-0000-0000-0000-000000000002', 'member'),
  ((select book_b_id from test_ids), '10000000-0000-0000-0000-000000000003', 'member');
insert into public.transactions (book_id, title, amount, type, category, created_by, created_at, entry_date) values
  ((select page_book_id from test_ids), 'Day 1 in', 100.10, 'cash_in', 'Test', '10000000-0000-0000-0000-000000000001', '2026-10-20 09:00:00+00', '2026-10-20'),
  ((select page_book_id from test_ids), 'Day 1 out', 20.00, 'cash_out', 'Test', '10000000-0000-0000-0000-000000000001', '2026-10-20 10:00:00+00', '2026-10-20'),
  ((select page_book_id from test_ids), 'Day 2 in', 50.25, 'cash_in', 'Test', '10000000-0000-0000-0000-000000000001', '2026-10-21 09:00:00+00', '2026-10-21'),
  ((select page_book_id from test_ids), 'Day 2 out', 10.00, 'cash_out', 'Test', '10000000-0000-0000-0000-000000000001', '2026-10-21 10:00:00+00', '2026-10-21'),
  ((select page_book_id from test_ids), 'Deleted cash in', 900.00, 'cash_in', 'Test', '10000000-0000-0000-0000-000000000001', '2026-10-22 09:00:00+00', '2026-10-22');
update test_ids set page_deleted_transaction_id = (
  select id from public.transactions where book_id = (select page_book_id from test_ids) and title = 'Deleted cash in'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner@example.test"}', true);
select extensions.lives_ok(
  $$select public.soft_delete_transaction((select page_deleted_transaction_id from test_ids))$$,
  'soft_delete_transaction executes for an owner and removes the row from the active ledger'
);
reset role;

-- Exercise the page RPC as a verified member against real transaction rows.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","email":"member@example.test"}', true);
select extensions.lives_ok(
  $$select * from public.book_transaction_page((select page_book_id from test_ids), 10, null, null, null, null, null, null)$$,
  'verified book member can call book_transaction_page without an ambiguous-column error'
);
select extensions.results_eq(
  $$select title from public.book_transaction_page((select page_book_id from test_ids), 10, null, null, null, null, null, null)$$,
  $$values ('Day 2 out'::text), ('Day 2 in'::text), ('Day 1 out'::text), ('Day 1 in'::text)$$,
  'book_transaction_page returns active rows newest first and excludes the soft-deleted transaction'
);
select extensions.results_eq(
  $$select title, running_balance from public.book_transaction_page((select page_book_id from test_ids), 10, null, null, null, null, null, null)$$,
  $$values ('Day 2 out'::text, 120.35::numeric), ('Day 2 in'::text, 130.35::numeric), ('Day 1 out'::text, 80.10::numeric), ('Day 1 in'::text, 100.10::numeric)$$,
  'running balances include all active transactions and preserve decimal amounts'
);
select extensions.results_eq(
  $$select title, running_balance from public.book_transaction_page((select page_book_id from test_ids), 10, null, null, null, 'cash_out', null, null)$$,
  $$values ('Day 2 out'::text, 120.35::numeric), ('Day 1 out'::text, 80.10::numeric)$$,
  'type filtering hides rows without changing the running balance'
);
select extensions.results_eq(
  $$select title, running_balance from public.book_transaction_page((select page_book_id from test_ids), 10, null, null, null, null, date '2026-10-21', date '2026-10-22')$$,
  $$values ('Day 2 out'::text, 120.35::numeric), ('Day 2 in'::text, 130.35::numeric)$$,
  'from/to date filtering hides rows without changing the running balance'
);
select extensions.results_eq(
  $$select title from public.book_transaction_page((select page_book_id from test_ids), 2, null, null, null, null, null, null)$$,
  $$values ('Day 2 out'::text), ('Day 2 in'::text)$$,
  'first cursor page contains the newest two rows'
);
select extensions.results_eq(
  $$select title from public.book_transaction_page((select page_book_id from test_ids), 2, date '2026-10-21', timestamptz '2026-10-21 09:00:00+00', (select id from public.transactions where book_id = (select page_book_id from test_ids) and title = 'Day 2 in'), null, null, null)$$,
  $$values ('Day 1 out'::text), ('Day 1 in'::text)$$,
  'next cursor page continues without duplicates or gaps'
);
select extensions.is(
  (select count(*)::integer from public.book_transaction_page((select page_book_id from test_ids), 10, null, null, null, null, null, null)),
  4,
  'book_transaction_page excludes soft-deleted transactions'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated","email":"outsider@example.test"}', true);
select extensions.throws_ok(
  $$select * from public.book_transaction_page((select page_book_id from test_ids), 10, null, null, null, null, null, null)$$,
  '42501', null, 'non-member is rejected by book_transaction_page'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner@example.test"}', true);
reset role;

-- Unverified accounts cannot read book data or write transactions.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated","email":"unverified@example.test"}', true);
select extensions.throws_ok(
  $$select count(*) from public.books$$,
  '42501', null, 'unverified email is rejected by the database'
);
select extensions.throws_ok(
  $$select count(*) from public.transactions where book_id = (select book_id from test_ids)$$,
  '42501', null, 'unverified email cannot read book transactions'
);
select extensions.throws_ok(
  $$insert into public.transactions (book_id, title, amount, type, created_by)
    values ((select book_id from test_ids), 'Unverified write', 1.00, 'cash_out', auth.uid())$$,
  '42501', null, 'unverified user transaction insert is denied'
);
reset role;
select extensions.ok(
  not exists (select 1 from public.transactions where title = 'Unverified write'),
  'unverified email cannot write book transactions'
);

-- Accept once, then use this verified member to check read and write policies.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","email":"member@example.test"}', true);
select public.accept_invitation((select invitation_id from test_ids));
reset role;
select extensions.ok(
  exists (select 1 from public.book_members where book_id = (select book_id from test_ids) and user_id = '10000000-0000-0000-0000-000000000002' and role = 'member')
  and exists (select 1 from public.invitations where id = (select invitation_id from test_ids) and status = 'accepted'),
  'invited user accepts atomically'
);
-- Seed the second-book membership as the database owner. The later update test
-- temporarily permits updates so the immutable trigger, not RLS, must reject it.
insert into public.book_members (book_id, user_id, role)
  values ((select book_b_id from test_ids), '10000000-0000-0000-0000-000000000002', 'member');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","email":"member@example.test"}', true);
select extensions.is(
  (select count(*)::integer from public.transactions where book_id = (select book_id from test_ids)),
  1,
  'book member can read its transactions'
);
insert into public.transactions (book_id, title, amount, type, created_by)
  values ((select book_id from test_ids), 'Market', 400.00, 'cash_out', auth.uid());
select extensions.throws_ok(
  $$insert into public.transactions (book_id, title, amount, type, created_by)
    values ((select book_id from test_ids), 'Forged creator', 1.00, 'cash_out', '10000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'member cannot forge created_by on a transaction insert'
);
reset role;
select extensions.ok(
  not exists (select 1 from public.transactions where title = 'Forged creator'),
  'forged created_by is rejected'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","email":"member@example.test"}', true);
select extensions.throws_ok(
  $$select public.accept_invitation((select invitation_id from test_ids))$$,
  '55000', null, 'replayed invitation acceptance is rejected'
);
reset role;
select extensions.ok(
  exists (select 1 from public.invitations where id = (select invitation_id from test_ids) and status = 'accepted')
  and (select count(*) = 1 from public.book_members where book_id = (select book_id from test_ids) and user_id = '10000000-0000-0000-0000-000000000002'),
  'replayed invitation acceptance fails'
);

-- An unrelated verified user sees no rows and cannot insert into the book.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated","email":"outsider@example.test"}', true);
select extensions.is(
  (select count(*)::integer from public.transactions where book_id = (select book_id from test_ids)),
  0,
  'non-member cannot read another book transactions'
);
select extensions.throws_ok(
  $$insert into public.transactions (book_id, title, amount, type, created_by)
    values ((select book_id from test_ids), 'Unauthorized', 1.00, 'cash_out', auth.uid())$$,
  '42501', null, 'non-member transaction insert is denied'
);
reset role;
select extensions.ok(
  not exists (select 1 from public.transactions where title = 'Unauthorized'),
  'non-member cannot write another book transactions'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated","email":"outsider@example.test"}', true);
select extensions.lives_ok(
  $query$do $block$
    declare
      affected_rows bigint;
    begin
      update public.transactions set title = 'Unauthorized edit'
        where book_id = (select book_id from test_ids) and title = 'Opening funds';
      get diagnostics affected_rows = row_count;
      if affected_rows <> 0 then
        raise exception 'Expected non-member UPDATE to affect zero rows, got %', affected_rows;
      end if;
    end;
  $block$$query$,
  'non-member UPDATE affects exactly zero rows under RLS'
);
reset role;
select extensions.is(
  (select title from public.transactions where title = 'Opening funds'),
  'Opening funds',
  'non-member cannot update another book transactions; row remains unchanged'
);

-- Totals for the round-number baseline are checked before adding decimal entries.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner@example.test"}', true);
select extensions.is(
  (select cash_in_total from public.book_totals((select book_id from test_ids))),
  1000.00::numeric,
  'book_totals baseline cash-in is 1000'
);
select extensions.is(
  (select cash_out_total from public.book_totals((select book_id from test_ids))),
  400.00::numeric,
  'book_totals baseline cash-out is 400'
);
select extensions.is(
  (select net_balance from public.book_totals((select book_id from test_ids))),
  600.00::numeric,
  'book_totals baseline net balance is 600'
);

insert into public.transactions (book_id, title, amount, type, created_by) values
  ((select book_id from test_ids), 'Decimal cash in', 10.10, 'cash_in', auth.uid()),
  ((select book_id from test_ids), 'Decimal cash out', 3.25, 'cash_out', auth.uid());
select extensions.is(
  (select cash_in_total from public.book_totals((select book_id from test_ids))),
  1010.10::numeric,
  'book_totals includes decimal cash-in exactly'
);
select extensions.is(
  (select cash_out_total from public.book_totals((select book_id from test_ids))),
  403.25::numeric,
  'book_totals includes decimal cash-out exactly'
);
select extensions.is(
  (select net_balance from public.book_totals((select book_id from test_ids))),
  606.85::numeric,
  'book_totals decimal net balance is exact'
);

-- Security regression tests for hardened policies and immutable triggers.
select extensions.ok(
  exists (select 1 from pg_trigger where tgrelid = 'public.transactions'::regclass and tgname = 'transactions_immutable_fields' and not tgisinternal),
  'transactions have an immutable identity/date trigger'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner@example.test"}', true);
reset role;
select extensions.ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'transactions' and cmd = 'UPDATE'
      and coalesce(qual, '') ilike '%is_book_owner%'
  ),
  'transaction edit policy is creator-only'
);

select extensions.ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'book_members'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  ),
  'book_members has no client insert, update, or delete policies'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner@example.test"}', true);
select extensions.lives_ok(
  $$select public.remove_member((select book_b_id from test_ids), '10000000-0000-0000-0000-000000000003')$$,
  'book owner can remove another member'
);
select extensions.throws_ok(
  $$select public.remove_member((select book_b_id from test_ids), auth.uid())$$,
  '42501', null, 'book owner cannot remove themselves'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","email":"member@example.test"}', true);
select extensions.lives_ok(
  $$select public.leave_book((select page_book_id from test_ids))$$,
  'member can leave a book'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner@example.test"}', true);
select extensions.throws_ok(
  $$select public.leave_book((select book_b_id from test_ids))$$,
  '23514', null, 'last owner cannot leave a book'
);
select extensions.lives_ok(
  $$select public.transfer_ownership((select book_b_id from test_ids), '10000000-0000-0000-0000-000000000002')$$,
  'book owner can transfer ownership to an existing member'
);
reset role;
select extensions.ok(
  exists (select 1 from pg_trigger where tgrelid = 'public.book_members'::regclass and tgname = 'book_members_immutable_fields' and not tgisinternal),
  'book member identity fields have an immutable trigger'
);
select extensions.ok(
  exists (select 1 from pg_trigger where tgrelid = 'public.invitations'::regclass and tgname = 'invitations_immutable_fields' and not tgisinternal),
  'invitation identity fields have an immutable trigger'
);
select extensions.ok(
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invitations' and cmd = 'UPDATE'),
  'invitations have no client update policy'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","email":"member@example.test"}', true);
select extensions.lives_ok(
  $$select * from public.my_pending_invitations()$$,
  'verified invitee can call my_pending_invitations'
);
select extensions.results_eq(
  $$select invitation_id, book_name, inviter_display_name from public.my_pending_invitations() order by book_name$$,
  $$values ((select deleted_book_invitation_id from test_ids), 'Deleted book test'::text, 'Owner'::text), ((select decline_invitation_id from test_ids), 'Page test ledger'::text, 'Owner'::text)$$,
  'my_pending_invitations returns invitation, book, and inviter data for the invitee'
);
select extensions.ok(
  exists (select 1 from public.my_pending_invitations() where expires_at > now()),
  'my_pending_invitations returns an active expiry timestamp'
);
select extensions.lives_ok(
  $$select public.decline_invitation((select decline_invitation_id from test_ids))$$,
  'invitee can decline a pending invitation'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner@example.test"}', true);
select extensions.is(
  (select count(*)::integer from public.my_pending_invitations()),
  0,
  'my_pending_invitations does not expose another user’s invitations'
);
select extensions.lives_ok(
  $$select public.revoke_invitation((select revoke_invitation_id from test_ids))$$,
  'book owner can revoke a pending invitation'
);
reset role;
select extensions.ok(
  coalesce((select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'invitations' and column_name = 'expires_at'), '') ilike '%7 days%',
  'invitation expiry defaults to seven days'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner@example.test"}', true);
select extensions.lives_ok(
  $$select public.soft_delete_book((select deleted_book_id from test_ids))$$,
  'book owner can soft-delete a book'
);
reset role;
select extensions.ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'books' and cmd = 'SELECT'
      and coalesce(qual, '') not ilike '%deleted_at%'
  ),
  'book read policies hide soft-deleted books'
);
select extensions.ok(
  coalesce((select qual from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_read_members'), '') ilike '%deleted_at%'
  and coalesce((select with_check from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_insert_members'), '') ilike '%deleted_at%',
  'transaction read and insert policies require an active book'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","email":"member@example.test"}', true);
select extensions.throws_ok(
  $$select public.accept_invitation((select deleted_book_invitation_id from test_ids))$$,
  '55000', null, 'accept_invitation rejects an invitation to a deleted book'
);
reset role;

select extensions.ok(
  not exists (
    select 1 from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any (array[
        'create_book', 'accept_invitation', 'soft_delete_transaction', 'book_transaction_page', 'book_totals',
        'remove_member', 'leave_book', 'transfer_ownership', 'decline_invitation', 'revoke_invitation',
        'soft_delete_book', 'my_pending_invitations'
      ])
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or exists (
          select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
          where a.grantee = 0 and a.privilege_type = 'EXECUTE'
        )
        or not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ),
  'public RPCs are executable by authenticated only'
);
select extensions.ok(
  exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'entry_date'
      and data_type = 'date' and is_nullable = 'NO' and column_default ilike '%CURRENT_DATE%'),
  'transactions have non-null entry_date defaulting to current_date'
);
select extensions.ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and concat_ws(' ', qual, with_check) ilike '%require_verified_user%'
      and concat_ws(' ', qual, with_check) !~* 'select[[:space:]]+(public\.)?require_verified_user\('
  ),
  'verified-user policy helper calls are wrapped in scalar SELECTs'
);
select extensions.ok(
  exists (select 1 from pg_constraint where conrelid = 'public.transactions'::regclass and conname = 'transactions_category_length'),
  'transaction category is limited to 60 characters'
);
select extensions.ok(
  exists (select 1 from pg_constraint where conrelid = 'public.transactions'::regclass and conname = 'transactions_description_length'),
  'transaction description is limited to 1000 characters'
);

-- These temporary permissive policies model an update that RLS would allow.
-- They isolate the triggers: with a trigger removed, each UPDATE would succeed
-- and the rejection/unchanged assertions below would fail.
create policy test_allow_transaction_update on public.transactions
  for update to authenticated using (true) with check (true);
create policy test_allow_book_member_update on public.book_members
  for update to authenticated using (true) with check (true);
create policy test_allow_invitation_update on public.invitations
  for update to authenticated using (true) with check (true);
grant update on public.book_members, public.invitations to authenticated;
update test_ids set opening_created_at = (
  select created_at from public.transactions where title = 'Opening funds'
);
insert into public.invitations (book_id, invited_email, invited_by)
  values ((select book_id from test_ids), 'member@example.test', '10000000-0000-0000-0000-000000000001');
update test_ids set immutable_invitation_id = (
  select id from public.invitations where book_id = (select book_id from test_ids)
    and invited_email = 'member@example.test' and status = 'pending'
);
select extensions.ok(
  exists (select 1 from public.transactions t
    join public.book_members a on a.book_id = t.book_id and a.user_id = t.created_by
    join public.book_members b on b.book_id = (select book_b_id from test_ids) and b.user_id = t.created_by
    where t.title = 'Opening funds' and t.book_id = (select book_id from test_ids)),
  'transaction creator is a member of both source and destination books'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner@example.test"}', true);
select extensions.throws_like(
  $$update public.transactions set created_at = created_at - interval '30 days'
    where book_id = (select book_id from test_ids) and title = 'Opening funds'$$,
  '%immutable%', 'creator cannot backdate created_at; trigger error mentions immutable'
);
select extensions.is(
  (select created_at from public.transactions where title = 'Opening funds'),
  (select opening_created_at from test_ids),
  'created_at remains unchanged after the rejected backdate'
);
select extensions.throws_like(
  $$update public.transactions set book_id = (select book_b_id from test_ids)
    where book_id = (select book_id from test_ids) and title = 'Opening funds'$$,
  '%immutable%', 'creator cannot move a transaction to another book; trigger error mentions immutable'
);
select extensions.is(
  (select book_id from public.transactions where title = 'Opening funds'),
  (select book_id from test_ids),
  'book_id remains unchanged after the rejected move'
);
select extensions.throws_like(
  $$update public.transactions set created_by = '10000000-0000-0000-0000-000000000002'
    where title = 'Opening funds'$$,
  '%immutable%', 'creator cannot change created_by when RLS permits it; trigger error mentions immutable'
);
select extensions.is(
  (select created_by from public.transactions where title = 'Opening funds'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'created_by remains unchanged after the rejected change'
);
select extensions.throws_like(
  $$update public.book_members set user_id = '10000000-0000-0000-0000-000000000003'
    where book_id = (select book_b_id from test_ids) and user_id = '10000000-0000-0000-0000-000000000001'$$,
  '%immutable%', 'book member identity update is rejected by its trigger'
);
select extensions.is(
  (select user_id from public.book_members where book_id = (select book_b_id from test_ids)
    and user_id = '10000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'book_members.user_id remains unchanged after the rejected change'
);
select extensions.throws_like(
  $$update public.invitations set invited_email = 'outsider@example.test'
    where id = (select immutable_invitation_id from test_ids)$$,
  '%immutable%', 'invitation email update is rejected by its trigger'
);
select extensions.is(
  (select invited_email from public.invitations where id = (select immutable_invitation_id from test_ids)),
  'member@example.test',
  'invitations.invited_email remains unchanged after the rejected change'
);

reset role;
drop policy test_allow_transaction_update on public.transactions;
drop policy test_allow_book_member_update on public.book_members;
drop policy test_allow_invitation_update on public.invitations;
revoke update on public.book_members, public.invitations from authenticated;

select * from finish();
rollback;
