begin;

create extension if not exists pgtap with schema extensions;
select plan(60);

create temporary table test_ids (
  book_id uuid,
  book_b_id uuid,
  invitation_id uuid,
  immutable_invitation_id uuid,
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

-- Unverified accounts cannot read book data or write transactions.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated","email":"unverified@example.test"}', true);
select extensions.throws_ok(
  $$select count(*) from public.books$$,
  '42501', null, 'unverified email is rejected by the database'
);
select extensions.throws_ok(
  $$select count(*) from public.transactions where book_id = (select book_id from test_ids)$$,
  '42501', null, 'unverified email cannot read book transactions'
);
\set ON_ERROR_STOP off
savepoint unverified_insert_attempt;
insert into public.transactions (book_id, title, amount, type, created_by)
  values ((select book_id from test_ids), 'Unverified write', 1.00, 'cash_out', auth.uid());
\if :ERROR
  rollback to savepoint unverified_insert_attempt;
\else
  release savepoint unverified_insert_attempt;
\endif
reset role;
\set ON_ERROR_STOP on
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
select extensions.is(
  (select count(*)::integer from public.transactions where book_id = (select book_id from test_ids)),
  1,
  'book member can read its transactions'
);
insert into public.transactions (book_id, title, amount, type, created_by)
  values ((select book_id from test_ids), 'Market', 400.00, 'cash_out', auth.uid());
\set ON_ERROR_STOP off
savepoint forged_creator_insert_attempt;
insert into public.transactions (book_id, title, amount, type, created_by)
  values ((select book_id from test_ids), 'Forged creator', 1.00, 'cash_out', '10000000-0000-0000-0000-000000000001');
\if :ERROR
  rollback to savepoint forged_creator_insert_attempt;
\else
  release savepoint forged_creator_insert_attempt;
\endif
reset role;
\set ON_ERROR_STOP on
select extensions.ok(
  not exists (select 1 from public.transactions where title = 'Forged creator'),
  'forged created_by is rejected'
);
set local role authenticated;
\set ON_ERROR_STOP off
savepoint replay_invitation_attempt;
select public.accept_invitation((select invitation_id from test_ids));
\if :ERROR
  \set replay_failed true
  rollback to savepoint replay_invitation_attempt;
\else
  \set replay_failed false
  release savepoint replay_invitation_attempt;
\endif
reset role;
\set ON_ERROR_STOP on
select extensions.ok(
  :replay_failed::boolean
  and exists (select 1 from public.invitations where id = (select invitation_id from test_ids) and status = 'accepted')
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
\set ON_ERROR_STOP off
savepoint non_member_insert_attempt;
insert into public.transactions (book_id, title, amount, type, created_by)
  values ((select book_id from test_ids), 'Unauthorized', 1.00, 'cash_out', auth.uid());
\if :ERROR
  rollback to savepoint non_member_insert_attempt;
\else
  release savepoint non_member_insert_attempt;
\endif
reset role;
\set ON_ERROR_STOP on
select extensions.ok(
  not exists (select 1 from public.transactions where title = 'Unauthorized'),
  'non-member cannot write another book transactions'
);
set local role authenticated;
update public.transactions set title = 'Unauthorized edit'
  where book_id = (select book_id from test_ids) and title = 'Opening funds';
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

-- Security regression tests for the applied schema. These assertions are
-- intentionally added before the corrective migration.
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
select extensions.ok(to_regprocedure('public.remove_member(uuid,uuid)') is not null,
  'remove_member RPC exists');
select extensions.ok(to_regprocedure('public.leave_book(uuid)') is not null,
  'leave_book RPC exists');
select extensions.ok(to_regprocedure('public.transfer_ownership(uuid,uuid)') is not null,
  'transfer_ownership RPC exists');
select extensions.ok(
  exists (select 1 from pg_trigger where tgrelid = 'public.book_members'::regclass and tgname = 'book_members_immutable_fields' and not tgisinternal),
  'book member identity fields have an immutable trigger'
);
select extensions.ok(
  coalesce(pg_get_functiondef(to_regprocedure('public.remove_member(uuid,uuid)')), '') ilike '%is_book_owner%'
  and coalesce(pg_get_functiondef(to_regprocedure('public.remove_member(uuid,uuid)')), '') ilike '%auth.uid%',
  'remove_member checks owner authority and prevents self-removal'
);
select extensions.ok(
  coalesce(pg_get_functiondef(to_regprocedure('public.leave_book(uuid)')), '') ilike '%owner%'
  and coalesce(pg_get_functiondef(to_regprocedure('public.leave_book(uuid)')), '') ilike '%count%',
  'leave_book prevents the last owner from leaving'
);

select extensions.ok(
  exists (select 1 from pg_trigger where tgrelid = 'public.invitations'::regclass and tgname = 'invitations_immutable_fields' and not tgisinternal),
  'invitation identity fields have an immutable trigger'
);
select extensions.ok(
  not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invitations' and cmd = 'UPDATE'),
  'invitations have no client update policy'
);
select extensions.ok(to_regprocedure('public.decline_invitation(uuid)') is not null,
  'decline_invitation RPC exists');
select extensions.ok(to_regprocedure('public.revoke_invitation(uuid)') is not null,
  'revoke_invitation RPC exists');
select extensions.ok(
  coalesce((select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'invitations' and column_name = 'expires_at'), '') ilike '%7 days%',
  'invitation expiry defaults to seven days'
);

select extensions.ok(to_regprocedure('public.soft_delete_book(uuid)') is not null,
  'soft_delete_book RPC exists');
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
select extensions.ok(
  coalesce(pg_get_functiondef(to_regprocedure('public.accept_invitation(uuid)')), '') ilike '%deleted_at%',
  'accept_invitation rejects deleted books'
);

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
  exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'book_transaction_page' and prosrc ilike '%entry_date%'),
  'book_transaction_page orders, filters, and balances by entry_date'
);

select extensions.ok(to_regprocedure('public.my_pending_invitations()') is not null,
  'my_pending_invitations RPC exists');
select extensions.ok(
  coalesce(pg_get_function_result(to_regprocedure('public.my_pending_invitations()')), '') ilike '%invitation_id%'
  and coalesce(pg_get_function_result(to_regprocedure('public.my_pending_invitations()')), '') ilike '%book_name%'
  and coalesce(pg_get_function_result(to_regprocedure('public.my_pending_invitations()')), '') ilike '%inviter_display_name%'
  and coalesce(pg_get_function_result(to_regprocedure('public.my_pending_invitations()')), '') ilike '%expires_at%',
  'pending invitation RPC returns the required fields'
);
select extensions.ok(
  coalesce(pg_get_functiondef(to_regprocedure('public.my_pending_invitations()')), '') ilike '%invited_email%'
  and (
    coalesce(pg_get_functiondef(to_regprocedure('public.my_pending_invitations()')), '') ilike '%auth.uid%'
    or coalesce(pg_get_functiondef(to_regprocedure('public.my_pending_invitations()')), '') ilike '%auth.jwt%'
  ),
  'pending invitations are scoped to the authenticated invitee'
);
select extensions.ok(
  coalesce(pg_get_functiondef(to_regprocedure('public.soft_delete_transaction(uuid)')), '') ilike '%is_book_member%',
  'transaction soft delete requires current book membership'
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
select extensions.ok(
  pg_get_functiondef('public.prevent_transaction_identity_change()'::regprocedure) ilike '%immutable%',
  'transaction trigger raises an immutable-fields error'
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
select extensions.ok(
  pg_get_functiondef('public.prevent_book_member_identity_change()'::regprocedure) ilike '%immutable%',
  'book member trigger raises an immutable-fields error'
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
select extensions.ok(
  pg_get_functiondef('public.prevent_invitation_identity_change()'::regprocedure) ilike '%immutable%',
  'invitation trigger raises an immutable-fields error'
);

reset role;
drop policy test_allow_transaction_update on public.transactions;
drop policy test_allow_book_member_update on public.book_members;
drop policy test_allow_invitation_update on public.invitations;
revoke update on public.book_members, public.invitations from authenticated;

select * from finish();
rollback;
