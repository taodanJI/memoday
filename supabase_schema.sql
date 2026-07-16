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

-- ===== 行级安全策略 (RLS) =====
alter table rooms enable row level security;
alter table room_members enable row level security;
alter table events enable row level security;

-- 房间：成员可读
drop policy if exists "read rooms" on rooms;
create policy "read rooms" on rooms for select to authenticated using (
  exists (select 1 from room_members where room_members.room_id = rooms.id and room_members.uid = auth.uid())
);

-- 房间：已登录用户可创建
drop policy if exists "create rooms" on rooms;
create policy "create rooms" on rooms for insert to authenticated with check (created_by = auth.uid());

-- 成员：可读同房间成员
drop policy if exists "read members" on room_members;
create policy "read members" on room_members for select to authenticated using (
  uid = auth.uid() or exists (
    select 1 from room_members rm2 where rm2.room_id = room_members.room_id and rm2.uid = auth.uid()
  )
);

-- 成员：可加入自己
drop policy if exists "insert member" on room_members;
create policy "insert member" on room_members for insert to authenticated with check (uid = auth.uid());

-- 事件：同房间成员可读
drop policy if exists "read events" on events;
create policy "read events" on events for select to authenticated using (
  exists (select 1 from room_members where room_members.room_id = events.room_id and room_members.uid = auth.uid())
);

-- 事件：同房间成员可写
drop policy if exists "insert events" on events;
create policy "insert events" on events for insert to authenticated with check (
  exists (select 1 from room_members where room_members.room_id = events.room_id and room_members.uid = auth.uid())
);

-- 事件：同房间成员可改
drop policy if exists "update events" on events;
create policy "update events" on events for update to authenticated using (
  exists (select 1 from room_members where room_members.room_id = events.room_id and room_members.uid = auth.uid())
);

-- 事件：同房间成员可删
drop policy if exists "delete events" on events;
create policy "delete events" on events for delete to authenticated using (
  exists (select 1 from room_members where room_members.room_id = events.room_id and room_members.uid = auth.uid())
);

-- 开启 Realtime（实时推送）
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table room_members;
