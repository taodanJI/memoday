-- ============================================
-- 念念日历 - Supabase 数据库 Schema
-- 在 Supabase Dashboard > SQL Editor 中运行此文件
-- ============================================

-- 房间表（每对共享的人一个房间）
create table if not exists rooms (
  id uuid default gen_random_uuid() primary key,
  pair_code text unique not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- 房间成员表
create table if not exists room_members (
  room_id uuid references rooms(id) on delete cascade,
  uid uuid references auth.users(id),
  name text not null,
  is_owner boolean default false,
  joined_at timestamptz default now(),
  primary key (room_id, uid)
);

-- 事件表（只存共享事件，个人事件留在本地）
create table if not exists events (
  id text primary key,
  room_id uuid references rooms(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

-- 自动更新 updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_updated_at on events;
create trigger events_updated_at before update on events
for each row execute function update_updated_at();

-- 通过邀请码查找事件（绕过 RLS，非成员也可通过邀请码加入）
create or replace function get_event_by_invite_code(code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  event_data jsonb;
begin
  select data into event_data from events where data->>'inviteCode' = code limit 1;
  if event_data is null then
    raise exception '邀请码无效';
  end if;
  return event_data;
end;
$$;

-- 通过配对码加入房间（绕过 RLS，非成员无法查询 rooms 表）
create or replace function join_room_by_code(target_pair_code text, user_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  select id into v_room_id from rooms where pair_code = target_pair_code;
  if v_room_id is null then
    raise exception '配对码无效';
  end if;
  insert into room_members (room_id, uid, name, is_owner)
  values (v_room_id, auth.uid(), user_name, false)
  on conflict (room_id, uid) do nothing;
  return v_room_id;
end;
$$;

-- ===== 辅助函数（security definer 绕过 RLS，避免递归）=====
create or replace function get_user_rooms()
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select room_id from room_members where uid = auth.uid();
end;
$$;

-- 用户资料表（头像 + 昵称）
create table if not exists profiles (
  uid uuid primary key references auth.users(id) on delete cascade,
  name text not null default '我',
  avatar_type text not null default 'emoji',
  avatar_data text not null default '😊',
  updated_at timestamptz default now()
);

-- profiles 自动更新 updated_at
drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at before update on profiles
for each row execute function update_updated_at();

-- ===== 行级安全策略 (RLS) =====
alter table rooms enable row level security;
alter table room_members enable row level security;
alter table events enable row level security;
alter table profiles enable row level security;

-- 房间：创建者可读 + 同房间成员可读
drop policy if exists "read rooms" on rooms;
create policy "read rooms" on rooms for select to authenticated using (
  created_by = auth.uid() or id in (select get_user_rooms())
);

-- 房间：已登录用户可创建
drop policy if exists "create rooms" on rooms;
create policy "create rooms" on rooms for insert to authenticated with check (created_by = auth.uid());

-- 成员：自己可读 + 同房间成员可读
drop policy if exists "read members" on room_members;
create policy "read members" on room_members for select to authenticated using (
  uid = auth.uid() or room_id in (select get_user_rooms())
);

-- 成员：可加入自己
drop policy if exists "insert member" on room_members;
create policy "insert member" on room_members for insert to authenticated with check (uid = auth.uid());

-- 事件：同房间成员可读
drop policy if exists "read events" on events;
create policy "read events" on events for select to authenticated using (
  room_id in (select get_user_rooms())
);

-- 事件：同房间成员可写
drop policy if exists "insert events" on events;
create policy "insert events" on events for insert to authenticated with check (
  room_id in (select get_user_rooms())
);

-- 事件：同房间成员可改
drop policy if exists "update events" on events;
create policy "update events" on events for update to authenticated using (
  room_id in (select get_user_rooms())
);

-- 事件：同房间成员可删
drop policy if exists "delete events" on events;
create policy "delete events" on events for delete to authenticated using (
  room_id in (select get_user_rooms())
);

-- 资料：用户只能读写自己的资料
drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles for select to authenticated using (uid = auth.uid());

drop policy if exists "insert own profile" on profiles;
create policy "insert own profile" on profiles for insert to authenticated with check (uid = auth.uid());

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update to authenticated using (uid = auth.uid());

-- 通过配对码查房间成员昵称头像（绕过 RLS，用于展示对方资料）
create or replace function get_room_profiles(target_room_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  select coalesce(json_agg(json_build_object(
    'uid', rm.uid,
    'name', coalesce(p.name, rm.name),
    'avatar_type', coalesce(p.avatar_type, 'emoji'),
    'avatar_data', coalesce(p.avatar_data, '😊'),
    'is_owner', rm.is_owner
  )), '[]'::json) into result
  from room_members rm
  left join profiles p on p.uid = rm.uid
  where rm.room_id = target_room_id;
  return result;
end;
$$;

-- 开启 Realtime（实时推送）
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table room_members;
