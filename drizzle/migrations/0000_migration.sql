
create type public.app_role as enum ('super_admin','accountant','sales_manager','hr','warehouse');
create type public.order_status as enum ('new','in_progress','awaiting_payment','paid','in_transit','at_warehouse','completed');
create type public.item_source as enum ('stock','supplier');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.has_any_role(_user_id uuid, _roles app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = any(_roles))
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

create policy "staff read profiles" on public.profiles for select to authenticated using (public.is_staff(auth.uid()) or id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid() or public.has_any_role(auth.uid(), array['super_admin','hr']::app_role[]));

create policy "read roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_any_role(auth.uid(), array['super_admin','hr']::app_role[]));
create policy "admin insert roles" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'super_admin') or (public.has_role(auth.uid(),'hr') and role <> 'super_admin'));
create policy "admin delete roles" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'super_admin') or (public.has_role(auth.uid(),'hr') and role <> 'super_admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email);
  if not exists (select 1 from public.user_roles where role = 'super_admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- directories
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null, inn text, phone text, email text, address text,
  created_at timestamptz not null default now()
);
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null, contact_person text, phone text, email text, country text,
  created_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique, name text not null, composition text, color text,
  width_cm numeric, sale_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create table public.stock_receipts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  meters numeric(12,2) not null check (meters > 0),
  remaining_meters numeric(12,2) not null,
  purchase_price numeric(12,2) not null default 0,
  received_at timestamptz not null default now(),
  received_by uuid,
  note text
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number serial unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  manager_id uuid not null default auth.uid(),
  status order_status not null default 'new',
  total numeric(14,2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  source item_source not null,
  product_id uuid not null references public.products(id) on delete restrict,
  receipt_id uuid references public.stock_receipts(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  meters numeric(12,2) not null check (meters > 0),
  price numeric(12,2) not null default 0
);
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status order_status, to_status order_status not null,
  changed_by uuid, changed_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  order_id uuid references public.orders(id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.clients, public.suppliers, public.products, public.stock_receipts, public.orders, public.order_items to authenticated;
grant select on public.order_status_history to authenticated;
grant select, update on public.notifications to authenticated;
grant all on public.clients, public.suppliers, public.products, public.stock_receipts, public.orders, public.order_items, public.order_status_history, public.notifications to service_role;
grant usage on sequence public.orders_number_seq to authenticated;

alter table public.clients enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.stock_receipts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.notifications enable row level security;

create policy "staff read" on public.clients for select to authenticated using (public.is_staff(auth.uid()));
create policy "sales write" on public.clients for all to authenticated using (public.has_any_role(auth.uid(), array['super_admin','sales_manager']::app_role[])) with check (public.has_any_role(auth.uid(), array['super_admin','sales_manager']::app_role[]));
create policy "staff read" on public.suppliers for select to authenticated using (public.is_staff(auth.uid()));
create policy "sup write" on public.suppliers for all to authenticated using (public.has_any_role(auth.uid(), array['super_admin','sales_manager','warehouse']::app_role[])) with check (public.has_any_role(auth.uid(), array['super_admin','sales_manager','warehouse']::app_role[]));
create policy "staff read" on public.products for select to authenticated using (public.is_staff(auth.uid()));
create policy "wh write" on public.products for all to authenticated using (public.has_any_role(auth.uid(), array['super_admin','warehouse']::app_role[])) with check (public.has_any_role(auth.uid(), array['super_admin','warehouse']::app_role[]));
create policy "staff read" on public.stock_receipts for select to authenticated using (public.is_staff(auth.uid()));
create policy "wh write" on public.stock_receipts for all to authenticated using (public.has_any_role(auth.uid(), array['super_admin','warehouse']::app_role[])) with check (public.has_any_role(auth.uid(), array['super_admin','warehouse']::app_role[]));
create policy "staff read" on public.orders for select to authenticated using (public.is_staff(auth.uid()));
create policy "sales create" on public.orders for insert to authenticated with check (public.has_any_role(auth.uid(), array['super_admin','sales_manager']::app_role[]) and manager_id = auth.uid());
create policy "ops update" on public.orders for update to authenticated using (public.has_any_role(auth.uid(), array['super_admin','sales_manager','accountant','warehouse']::app_role[]));
create policy "admin delete" on public.orders for delete to authenticated using (public.has_role(auth.uid(),'super_admin'));
create policy "staff read" on public.order_items for select to authenticated using (public.is_staff(auth.uid()));
create policy "sales write" on public.order_items for insert to authenticated with check (public.has_any_role(auth.uid(), array['super_admin','sales_manager']::app_role[]));
create policy "staff read" on public.order_status_history for select to authenticated using (public.is_staff(auth.uid()));
create policy "own notif" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notif upd" on public.notifications for update to authenticated using (user_id = auth.uid());

-- receipts: remaining = meters on insert
create or replace function public.receipt_defaults() returns trigger language plpgsql set search_path = public as $$
begin
  new.remaining_meters := new.meters;
  new.received_by := coalesce(new.received_by, auth.uid());
  return new;
end $$;
create trigger trg_receipt_defaults before insert on public.stock_receipts for each row execute function public.receipt_defaults();

-- order items: decrement stock, recompute total
create or replace function public.order_item_apply() returns trigger language plpgsql security definer set search_path = public as $$
declare rem numeric;
begin
  if new.source = 'stock' then
    if new.receipt_id is null then raise exception 'Для товара со склада нужно выбрать партию'; end if;
    select remaining_meters into rem from public.stock_receipts where id = new.receipt_id for update;
    if rem is null or rem < new.meters then raise exception 'Недостаточно остатка на складе (доступно % м)', coalesce(rem,0); end if;
    update public.stock_receipts set remaining_meters = remaining_meters - new.meters where id = new.receipt_id;
  elsif new.supplier_id is null then
    raise exception 'Для товара под заказ нужно выбрать поставщика';
  end if;
  update public.orders set total = total + new.meters * new.price where id = new.order_id;
  return new;
end $$;
create trigger trg_order_item_apply after insert on public.order_items for each row execute function public.order_item_apply();

-- status change: history + notifications
create or replace function public.status_label(s order_status) returns text language sql immutable as $$
  select case s when 'new' then 'Новый' when 'in_progress' then 'В работе' when 'awaiting_payment' then 'Ожидает оплаты'
    when 'paid' then 'Оплачен' when 'in_transit' then 'В пути' when 'at_warehouse' then 'На складе' else 'Завершён' end
$$;

create or replace function public.order_status_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare roles app_role[]; msg text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  new.updated_at := now();
  insert into public.order_status_history(order_id, from_status, to_status, changed_by)
    values (new.id, case when tg_op='UPDATE' then old.status end, new.status, auth.uid());
  roles := case new.status
    when 'new' then array['sales_manager']::app_role[]
    when 'in_progress' then array['warehouse']::app_role[]
    when 'awaiting_payment' then array['accountant']::app_role[]
    when 'paid' then array['warehouse','sales_manager']::app_role[]
    when 'in_transit' then array['warehouse']::app_role[]
    when 'at_warehouse' then array['warehouse','sales_manager']::app_role[]
    else array['accountant','sales_manager']::app_role[] end || array['super_admin']::app_role[];
  msg := 'Заказ №' || new.number || ': статус «' || public.status_label(new.status) || '»';
  insert into public.notifications(user_id, order_id, message)
    select distinct u, new.id, msg from (
      select user_id u from public.user_roles where role = any(roles)
      union select new.manager_id
    ) x where u is not null and u is distinct from auth.uid();
  return new;
end $$;
create trigger trg_order_status_ins after insert on public.orders for each row execute function public.order_status_notify();
create trigger trg_order_status_upd before update on public.orders for each row execute function public.order_status_notify();

alter publication supabase_realtime add table public.notifications;
