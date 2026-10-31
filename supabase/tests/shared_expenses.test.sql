begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

create temporary table shared_test_ids (
  book_id uuid,
  shared_transaction_id uuid,
  departed_transaction_id uuid,
  settlement_id uuid
);
grant select, insert, update on shared_test_ids to authenticated;

-- All RPC callers below are verified Auth users. Profile rows are provisioned
-- by the same trigger used for real signup.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'share-owner@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Avery"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'share-b@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Blair"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'share-c@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Casey"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'share-d@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Devon"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'share-e@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Emery"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'share-outsider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Finley"}', now(), now(), '', '', '', '');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","email":"share-owner@example.test"}', true);
select public.create_book('Shared expense tests', 'PKR', null);
insert into shared_test_ids (book_id)
  select b.id from public.books as b where b.name = 'Shared expense tests';
insert into public.transactions (book_id, title, amount, type, category, created_by, entry_date)
  values ((select book_id from shared_test_ids), 'Legacy unshared', 25.00, 'cash_out', 'Bills', auth.uid(), date '2026-10-29');
reset role;

insert into public.book_members (book_id, user_id, role) values
  ((select book_id from shared_test_ids), '30000000-0000-0000-0000-000000000002', 'member'),
  ((select book_id from shared_test_ids), '30000000-0000-0000-0000-000000000003', 'member'),
  ((select book_id from shared_test_ids), '30000000-0000-0000-0000-000000000004', 'member'),
  ((select book_id from shared_test_ids), '30000000-0000-0000-0000-000000000005', 'member');

select extensions.ok(
  exists (select 1 from public.books as b join public.book_members as bm on bm.book_id = b.id
    where b.id = (select book_id from shared_test_ids) and bm.user_id = '30000000-0000-0000-0000-000000000001' and bm.role = 'owner'),
  'verified user created a book with its owner membership'
);
select extensions.results_eq(
  $$select t.title, t.amount, t.type from public.transactions as t where t.title = 'Legacy unshared'$$,
  $$values ('Legacy unshared'::text, 25.00::numeric, 'cash_out'::public.transaction_type)$$,
  'an existing unshared transaction retains its original ledger values'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","email":"share-owner@example.test"}', true);
select extensions.results_eq(
  $$select b.user_id, b.paid_total, b.share_total, b.settled_net, b.balance from public.book_member_balances((select book_id from shared_test_ids)) as b where b.user_id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003') order by b.user_id$$,
  $$values
    ('30000000-0000-0000-0000-000000000001'::uuid, 0::numeric, 0::numeric, 0::numeric, 0::numeric),
    ('30000000-0000-0000-0000-000000000002'::uuid, 0::numeric, 0::numeric, 0::numeric, 0::numeric),
    ('30000000-0000-0000-0000-000000000003'::uuid, 0::numeric, 0::numeric, 0::numeric, 0::numeric)$$,
  'unshared transactions are excluded from member balances'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000004","role":"authenticated","email":"share-d@example.test"}', true);
select extensions.lives_ok(
  $$select public.add_shared_transaction((select book_id from shared_test_ids), 'Devon only', 25.00, 'Other', null, date '2026-10-29', '30000000-0000-0000-0000-000000000004', array['30000000-0000-0000-0000-000000000004'::uuid])$$,
  'a verified member can add a shared expense paid and owed by themselves'
);
reset role;
update shared_test_ids set departed_transaction_id = (
  select t.id from public.transactions as t where t.book_id = (select book_id from shared_test_ids) and t.title = 'Devon only'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000004","role":"authenticated","email":"share-d@example.test"}', true);
select extensions.lives_ok(
  $$select public.leave_book((select book_id from shared_test_ids))$$,
  'a member with a zero balance can leave the book'
);
reset role;
select extensions.is(
  (select count(*)::integer from public.book_members as bm where bm.book_id = (select book_id from shared_test_ids) and bm.user_id = '30000000-0000-0000-0000-000000000004'),
  0,
  'the zero-balance member was removed from current membership'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","email":"share-owner@example.test"}', true);
select extensions.results_eq(
  $$select p.created_by_name, p.paid_by, p.paid_by_name, p.participants from public.book_transaction_page((select book_id from shared_test_ids), 50, null, null, null, null, null, null) as p where p.id = (select departed_transaction_id from shared_test_ids)$$,
  $$values ('Devon'::text, '30000000-0000-0000-0000-000000000004'::uuid, 'Devon'::text, '[{"user_id":"30000000-0000-0000-0000-000000000004","display_name":"Devon"}]'::jsonb)$$,
  'transaction page retains the payer and participant display names after they leave the book'
);
select extensions.lives_ok(
  $$select public.add_shared_transaction((select book_id from shared_test_ids), 'Shared meal', 100.00, 'Food', 'Dinner', date '2026-10-30', '30000000-0000-0000-0000-000000000001', array['30000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000002'::uuid, '30000000-0000-0000-0000-000000000003'::uuid])$$,
  'a verified book owner can create a three-person shared expense'
);
reset role;
update shared_test_ids set shared_transaction_id = (
  select t.id from public.transactions as t where t.book_id = (select book_id from shared_test_ids) and t.title = 'Shared meal'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","email":"share-owner@example.test"}', true);
select extensions.results_eq(
  $$select s.user_id, s.share from public.transaction_splits as s where s.transaction_id = (select shared_transaction_id from shared_test_ids) order by s.user_id$$,
  $$values
    ('30000000-0000-0000-0000-000000000001'::uuid, 33.34::numeric),
    ('30000000-0000-0000-0000-000000000002'::uuid, 33.33::numeric),
    ('30000000-0000-0000-0000-000000000003'::uuid, 33.33::numeric)$$,
  '100.00 is equally split with leftover paisa assigned by ascending user id'
);
select extensions.is(
  (select sum(s.share) from public.transaction_splits as s where s.transaction_id = (select shared_transaction_id from shared_test_ids)),
  100.00::numeric,
  'three participant shares sum exactly to the transaction amount'
);
select extensions.results_eq(
  $$select b.user_id, b.paid_total, b.share_total, b.settled_net, b.balance from public.book_member_balances((select book_id from shared_test_ids)) as b where b.user_id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003') order by b.user_id$$,
  $$values
    ('30000000-0000-0000-0000-000000000001'::uuid, 100.00::numeric, 33.34::numeric, 0::numeric, 66.66::numeric),
    ('30000000-0000-0000-0000-000000000002'::uuid, 0::numeric, 33.33::numeric, 0::numeric, -33.33::numeric),
    ('30000000-0000-0000-0000-000000000003'::uuid, 0::numeric, 33.33::numeric, 0::numeric, -33.33::numeric)$$,
  'book balances use exact numeric paid and share totals'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000002","role":"authenticated","email":"share-b@example.test"}', true);
select extensions.throws_like(
  $$select public.leave_book((select book_id from shared_test_ids))$$,
  '%non-zero balance%',
  'a non-owner member with a non-zero balance cannot leave the book'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","email":"share-owner@example.test"}', true);
select extensions.throws_like(
  $$select public.remove_member((select book_id from shared_test_ids), '30000000-0000-0000-0000-000000000002')$$,
  '%non-zero balance%',
  'an owner cannot remove a member with a non-zero balance'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000002","role":"authenticated","email":"share-b@example.test"}', true);
select extensions.throws_like(
  $$select public.record_settlement((select book_id from shared_test_ids), '30000000-0000-0000-0000-000000000001', 33.34, date '2026-10-30')$$,
  '%exceeds your outstanding balance%',
  'a member cannot settle more than their current outstanding balance'
);
select extensions.lives_ok(
  $$select public.record_settlement((select book_id from shared_test_ids), '30000000-0000-0000-0000-000000000001', 33.33, date '2026-10-30')$$,
  'a verified member can record a settlement payment to another current member'
);
reset role;
update shared_test_ids set settlement_id = (
  select s.id from public.settlements as s where s.book_id = (select book_id from shared_test_ids)
    and s.from_user = '30000000-0000-0000-0000-000000000002' and s.to_user = '30000000-0000-0000-0000-000000000001'
  order by s.created_at desc limit 1
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","email":"share-owner@example.test"}', true);
select extensions.results_eq(
  $$select b.user_id, b.settled_net, b.balance from public.book_member_balances((select book_id from shared_test_ids)) as b where b.user_id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003') order by b.user_id$$,
  $$values
    ('30000000-0000-0000-0000-000000000001'::uuid,  -33.33::numeric,   33.33::numeric),
    ('30000000-0000-0000-0000-000000000002'::uuid,   33.33::numeric,     0.00::numeric),
    ('30000000-0000-0000-0000-000000000003'::uuid,    0::numeric,     -33.33::numeric)$$,
  'a payment from B to A moves B toward zero and reduces A’s credit'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000002","role":"authenticated","email":"share-b@example.test"}', true);
select extensions.lives_ok(
  $$select public.leave_book((select book_id from shared_test_ids))$$,
  'the same member can leave after settling their balance to zero'
);
reset role;
insert into public.book_members (book_id, user_id, role)
  values ((select book_id from shared_test_ids), '30000000-0000-0000-0000-000000000002', 'member');

-- Run each denied write explicitly as the authenticated owner. Checking the
-- role here prevents a RESET ROLE from silently turning these into privileged
-- fixture writes; the failed statements must have SQLSTATE 42501.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","email":"share-owner@example.test"}', true);
select extensions.is(current_user::text, 'authenticated', 'direct-write checks run as authenticated');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","email":"share-owner@example.test"}', true);
select extensions.throws_ok(
  $$insert into public.transaction_splits (transaction_id, user_id, share)
    values ((select shared_transaction_id from shared_test_ids), '30000000-0000-0000-0000-000000000005', 0.00)$$,
  '42501', null, 'authenticated client cannot directly insert transaction splits'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","email":"share-owner@example.test"}', true);
select extensions.throws_ok(
  $$update public.transaction_splits set share = 33.35
    where transaction_id = (select shared_transaction_id from shared_test_ids)
      and user_id = '30000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'authenticated client cannot directly update transaction splits'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","email":"share-owner@example.test"}', true);
select extensions.throws_ok(
  $$insert into public.settlements (book_id, from_user, to_user, amount, entry_date, created_by)
    values ((select book_id from shared_test_ids), '30000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', 1.00, date '2026-10-30', '30000000-0000-0000-0000-000000000005')$$,
  '42501', null, 'authenticated client cannot directly insert settlements'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","email":"share-owner@example.test"}', true);
select extensions.throws_ok(
  $$update public.settlements set amount = 101.00 where id = (select settlement_id from shared_test_ids)$$,
  '42501', null, 'authenticated client cannot directly update settlements'
);
reset role;
select extensions.is(
  (select count(*)::integer from public.transaction_splits as s where s.transaction_id = (select shared_transaction_id from shared_test_ids) and s.user_id = '30000000-0000-0000-0000-000000000005'),
  0,
  'client insert into transaction_splits is rejected'
);
select extensions.is(
  (select s.share from public.transaction_splits as s where s.transaction_id = (select shared_transaction_id from shared_test_ids) and s.user_id = '30000000-0000-0000-0000-000000000001'),
  33.34::numeric,
  'client update of transaction_splits is rejected'
);
select extensions.ok(
  case when to_regclass('public.transaction_splits') is null then false
    else not has_table_privilege('authenticated', 'public.transaction_splits', 'INSERT')
      and not has_table_privilege('authenticated', 'public.transaction_splits', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.transaction_splits', 'DELETE') end,
  'authenticated clients have no direct transaction_splits write privileges'
);
select extensions.is(
  (select count(*)::integer from public.settlements as s where s.book_id = (select book_id from shared_test_ids) and s.from_user = '30000000-0000-0000-0000-000000000005'),
  0,
  'client insert into settlements is rejected'
);
select extensions.is(
  (select s.amount from public.settlements as s where s.id = (select settlement_id from shared_test_ids)),
  33.33::numeric,
  'client update of settlements is rejected'
);
select extensions.ok(
  case when to_regclass('public.settlements') is null then false
    else not has_table_privilege('authenticated', 'public.settlements', 'INSERT')
      and not has_table_privilege('authenticated', 'public.settlements', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.settlements', 'DELETE') end,
  'authenticated clients have no direct settlements write privileges'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000006","role":"authenticated","email":"share-outsider@example.test"}', true);
select extensions.results_eq(
  $$select s.transaction_id from public.transaction_splits as s where s.transaction_id = (select shared_transaction_id from shared_test_ids)$$,
  $$select null::uuid where false$$,
  'a non-member cannot read another book’s splits'
);
select extensions.throws_ok(
  $$select * from public.book_member_balances((select book_id from shared_test_ids))$$,
  '42501', null,
  'a non-member cannot read another book’s member balances'
);
select extensions.results_eq(
  $$select s.id from public.settlements as s where s.book_id = (select book_id from shared_test_ids)$$,
  $$select null::uuid where false$$,
  'a non-member cannot read another book’s settlements'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","email":"share-owner@example.test"}', true);
select extensions.throws_ok(
  $$select public.add_shared_transaction((select book_id from shared_test_ids), 'Bad payer', 10.00, 'Other', null, date '2026-10-30', '30000000-0000-0000-0000-000000000006', array['30000000-0000-0000-0000-000000000001'::uuid])$$,
  '42501', null,
  'a non-member cannot be named as payer'
);
select extensions.throws_ok(
  $$select public.add_shared_transaction((select book_id from shared_test_ids), 'Bad participant', 10.00, 'Other', null, date '2026-10-30', '30000000-0000-0000-0000-000000000001', array['30000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000006'::uuid])$$,
  '42501', null,
  'a non-member cannot be named as a participant'
);
select extensions.lives_ok(
  $$select public.edit_shared_transaction((select shared_transaction_id from shared_test_ids), (select book_id from shared_test_ids), 'Shared meal', 120.00, 'Food', 'Updated dinner', date '2026-10-31', '30000000-0000-0000-0000-000000000001', array['30000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000002'::uuid, '30000000-0000-0000-0000-000000000003'::uuid])$$,
  'the transaction creator can atomically edit a shared expense'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","email":"share-owner@example.test"}', true);
select extensions.results_eq(
  $$select s.user_id, s.share from public.transaction_splits as s where s.transaction_id = (select shared_transaction_id from shared_test_ids) order by s.user_id$$,
  $$values
    ('30000000-0000-0000-0000-000000000001'::uuid, 40.00::numeric),
    ('30000000-0000-0000-0000-000000000002'::uuid, 40.00::numeric),
    ('30000000-0000-0000-0000-000000000003'::uuid, 40.00::numeric)$$,
  'editing rebuilds splits atomically for the new amount'
);
select extensions.results_eq(
  $$select b.user_id, b.paid_total, b.share_total, b.settled_net, b.balance from public.book_member_balances((select book_id from shared_test_ids)) as b where b.user_id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003') order by b.user_id$$,
  $$values
    ('30000000-0000-0000-0000-000000000001'::uuid, 120.00::numeric, 40.00::numeric, -33.33::numeric, 46.67::numeric),
    ('30000000-0000-0000-0000-000000000002'::uuid, 0::numeric, 40.00::numeric, 33.33::numeric, -6.67::numeric),
    ('30000000-0000-0000-0000-000000000003'::uuid, 0::numeric, 40.00::numeric, 0::numeric, -40.00::numeric)$$,
  'edited transaction amount is reflected in member balances'
);
select extensions.results_eq(
  $$select p.created_by_name, p.paid_by, p.paid_by_name, p.participants from public.book_transaction_page((select book_id from shared_test_ids), 50, null, null, null, null, null, null) as p where p.id = (select shared_transaction_id from shared_test_ids)$$,
  $$values ('Avery'::text, '30000000-0000-0000-0000-000000000001'::uuid, 'Avery'::text, '[{"user_id":"30000000-0000-0000-0000-000000000001","display_name":"Avery"},{"user_id":"30000000-0000-0000-0000-000000000002","display_name":"Blair"},{"user_id":"30000000-0000-0000-0000-000000000003","display_name":"Casey"}]'::jsonb)$$,
  'book transaction page returns creator, payer, and participant display names'
);
select extensions.lives_ok(
  $$select public.soft_delete_transaction((select shared_transaction_id from shared_test_ids))$$,
  'soft deleting a shared transaction succeeds for its creator'
);
select extensions.results_eq(
  $$select b.user_id, b.paid_total, b.share_total, b.settled_net, b.balance from public.book_member_balances((select book_id from shared_test_ids)) as b where b.user_id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003') order by b.user_id$$,
  $$values
    ('30000000-0000-0000-0000-000000000001'::uuid, 0::numeric, 0::numeric, -33.33::numeric, -33.33::numeric),
    ('30000000-0000-0000-0000-000000000002'::uuid, 0::numeric, 0::numeric, 33.33::numeric, 33.33::numeric),
    ('30000000-0000-0000-0000-000000000003'::uuid, 0::numeric, 0::numeric, 0::numeric, 0::numeric)$$,
  'deleted shared expense splits no longer affect balances'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated","email":"share-c@example.test"}', true);
select extensions.throws_ok(
  $$select public.soft_delete_settlement((select settlement_id from shared_test_ids))$$,
  '42501', null,
  'a non-creator non-owner cannot delete a settlement'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","email":"share-owner@example.test"}', true);
select extensions.lives_ok(
  $$select public.soft_delete_settlement((select settlement_id from shared_test_ids))$$,
  'a book owner can soft delete a settlement'
);
select extensions.results_eq(
  $$select b.user_id, b.paid_total, b.share_total, b.settled_net, b.balance from public.book_member_balances((select book_id from shared_test_ids)) as b where b.user_id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003') order by b.user_id$$,
  $$values
    ('30000000-0000-0000-0000-000000000001'::uuid, 0::numeric, 0::numeric, 0::numeric, 0::numeric),
    ('30000000-0000-0000-0000-000000000002'::uuid, 0::numeric, 0::numeric, 0::numeric, 0::numeric),
    ('30000000-0000-0000-0000-000000000003'::uuid, 0::numeric, 0::numeric, 0::numeric, 0::numeric)$$,
  'soft-deleting a settlement removes its balance effect'
);
reset role;
select extensions.results_eq(
  $$select t.title, t.amount, t.type from public.transactions as t where t.id = (select id from public.transactions as t2 where t2.title = 'Legacy unshared')$$,
  $$values ('Legacy unshared'::text, 25.00::numeric, 'cash_out'::public.transaction_type)$$,
  'shared expense edits and deletions do not alter existing unshared transactions'
);

select * from finish();
rollback;
