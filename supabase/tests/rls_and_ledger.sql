-- Run after migrations against a disposable local Supabase database as the
-- postgres role. The script rolls back all fixtures at the end.
begin;

create temporary table test_ids (book_id uuid, invitation_id uuid);
grant select, insert, update on test_ids to authenticated;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new,
  recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'member@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Member"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'outsider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Outsider"}', now(), now(), '', '', '', '');

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","email":"owner@example.test"}', true);
select public.create_book('Household', 'PKR', null);
insert into test_ids (book_id)
  select id from public.books where name = 'Household';

do $$
declare
  v_book_id uuid;
begin
  select book_id into v_book_id from test_ids;
  if v_book_id is null then raise exception 'FAIL: create_book did not create a book'; end if;
  if not exists (select 1 from public.book_members where book_id = v_book_id and user_id = auth.uid() and role = 'owner') then
    raise exception 'FAIL: create_book did not create owner membership';
  end if;
  insert into public.invitations (book_id, invited_email, invited_by)
    values (v_book_id, 'member@example.test', auth.uid()) returning id into v_book_id;
  update test_ids set invitation_id = v_book_id;
  select book_id into v_book_id from test_ids;
  insert into public.transactions (book_id, title, amount, type, created_by)
    values (v_book_id, 'Opening cash', 100.00, 'cash_in', auth.uid());
end $$;

-- A member can read transactions, but cannot forge the creator identity.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","email":"member@example.test"}', true);
do $$
declare v_book_id uuid;
begin
  select book_id into v_book_id from test_ids;
  perform public.accept_invitation((select invitation_id from test_ids));
  if (select count(*) from public.transactions where book_id = v_book_id) <> 1 then
    raise exception 'FAIL: member cannot read book transactions';
  end if;
  begin
    insert into public.transactions (book_id, title, amount, type, created_by)
      values (v_book_id, 'Forged', 1.00, 'cash_out', '10000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: forged created_by was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Invitation acceptance is atomic and cannot be replayed.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated","email":"member@example.test"}', true);
do $$
declare v_invitation_id uuid;
begin
  select invitation_id into v_invitation_id from test_ids;
  begin
    perform public.accept_invitation(v_invitation_id);
    raise exception 'FAIL: replayed invitation acceptance succeeded';
  exception when sqlstate '55000' then null;
  end;
  if not exists (select 1 from public.book_members where user_id = auth.uid() and role = 'member') then
    raise exception 'FAIL: acceptance did not add membership';
  end if;
end $$;

-- Outsider cannot read or insert transactions in the book.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated","email":"outsider@example.test"}', true);
do $$
declare v_book_id uuid;
begin
  select book_id into v_book_id from test_ids;
  if exists (select 1 from public.transactions where book_id = v_book_id) then
    raise exception 'FAIL: non-member read transaction data';
  end if;
  begin
    insert into public.transactions (book_id, title, amount, type, created_by)
      values (v_book_id, 'Unauthorized', 1.00, 'cash_out', auth.uid());
    raise exception 'FAIL: non-member inserted a transaction';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
