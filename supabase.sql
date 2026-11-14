-- مانجا هب: إعداد قاعدة البيانات
-- شغّل الملف كله مرة واحدة في Supabase > SQL Editor

create extension if not exists pgcrypto;

-- ============ الجداول ============

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  announcement text,
  whatsapp text,
  site text,
  ship_fee numeric not null default 60,
  free_over numeric not null default 1000,
  hero_title text,
  hero_sub text
);

insert into public.settings (id, announcement, whatsapp, site, ship_fee, free_over, hero_title, hero_sub)
values (1,
  'شحن سريع لجميع المحافظات · الدفع عند الاستلام · اطلب أي مانجا متاح بالطلب',
  '01558647645', 'mangahub.eg', 60, 1000,
  'وجهتك لعالم المانجا',
  'مجلدات أصلية بالعربية والإنجليزية والفرنسية، وأي عنوان مش موجود عندنا نجيبهولك بالطلب.')
on conflict (id) do nothing;

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  author text,
  vol int not null default 0,
  genre text,
  lang text not null default 'ar' check (lang in ('ar', 'en', 'fr')),
  price numeric not null check (price >= 0),
  old_price numeric not null default 0,
  stock int not null default 0 check (stock >= 0),
  preorder boolean not null default false,
  featured boolean not null default false,
  active boolean not null default true,
  pal int not null default 0,
  img_path text
);

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  customer text not null,
  phone text not null,
  gov text not null,
  address text not null,
  note text,
  items jsonb not null,
  subtotal numeric not null,
  shipping numeric not null,
  total numeric not null,
  status text not null default 'new' check (status in ('new', 'confirmed', 'shipped', 'done', 'cancelled'))
);

create table if not exists public.requests (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  title text not null,
  lang text not null default 'ar',
  notes text,
  customer text,
  phone text,
  price numeric not null default 0,
  status text not null default 'new' check (status in ('new', 'quoted', 'agreed', 'arrived', 'cancelled'))
);

-- ============ الأمان (RLS) ============

alter table public.settings enable row level security;
alter table public.admins   enable row level security;
alter table public.products enable row level security;
alter table public.orders   enable row level security;
alter table public.requests enable row level security;

drop policy if exists "settings read" on public.settings;
create policy "settings read" on public.settings for select using (true);
drop policy if exists "settings admin write" on public.settings;
create policy "settings admin write" on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins read own" on public.admins;
create policy "admins read own" on public.admins for select to authenticated using (user_id = auth.uid());

drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products for select using (active or public.is_admin());
drop policy if exists "products admin write" on public.products;
create policy "products admin write" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- الطلبات: الزباين مايقدروش يقروا أو يكتبوا مباشرة، بيعدّوا من الدوال تحت بس
drop policy if exists "orders admin" on public.orders;
create policy "orders admin" on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "requests admin" on public.requests;
create policy "requests admin" on public.requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============ دوال الطلب (الأسعار والمخزون بتتحسب على السيرفر) ============

create or replace function public.place_order(
  p_customer text, p_phone text, p_gov text, p_address text, p_note text, p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  it jsonb;
  pr public.products;
  st public.settings;
  q int;
  sub numeric := 0;
  ship numeric;
  lines jsonb := '[]'::jsonb;
  oid bigint;
begin
  if coalesce(trim(p_customer), '') = '' or length(p_customer) > 100 then raise exception 'invalid_customer'; end if;
  if p_phone is null or p_phone !~ '^(\+?20|0)?1[0125][0-9]{8}$' then raise exception 'invalid_phone'; end if;
  if coalesce(trim(p_gov), '') = '' or coalesce(trim(p_address), '') = '' or length(p_address) > 300 then raise exception 'invalid_address'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then raise exception 'invalid_items'; end if;

  for it in select value from jsonb_array_elements(p_items) loop
    q := (it ->> 'qty')::int;
    if q is null or q < 1 or q > 20 then raise exception 'invalid_qty'; end if;
    select * into pr from public.products where id = (it ->> 'id')::uuid and active for update;
    if not found then raise exception 'unavailable'; end if;
    if not pr.preorder then
      if pr.stock < q then raise exception 'out_of_stock:%', pr.title; end if;
      update public.products set stock = stock - q where id = pr.id;
    end if;
    sub := sub + pr.price * q;
    lines := lines || jsonb_build_array(jsonb_build_object(
      'id', pr.id,
      'title', pr.title || case when pr.vol > 0 then ' #' || pr.vol else '' end,
      'qty', q, 'price', pr.price, 'preorder', pr.preorder));
  end loop;

  select * into st from public.settings where id = 1;
  ship := case
    when sub = 0 then 0
    when coalesce(st.free_over, 0) > 0 and sub >= st.free_over then 0
    else coalesce(st.ship_fee, 0) end;

  insert into public.orders (customer, phone, gov, address, note, items, subtotal, shipping, total)
  values (trim(p_customer), trim(p_phone), trim(p_gov), trim(p_address), left(coalesce(p_note, ''), 300), lines, sub, ship, sub + ship)
  returning id into oid;

  return jsonb_build_object('id', oid, 'subtotal', sub, 'shipping', ship, 'total', sub + ship, 'items', lines);
end $$;

create or replace function public.place_request(
  p_title text, p_lang text, p_notes text, p_customer text, p_phone text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_title), '') = '' or length(p_title) > 150 then raise exception 'invalid_title'; end if;
  if coalesce(trim(p_customer), '') = '' or length(p_customer) > 100 then raise exception 'invalid_customer'; end if;
  if p_phone is null or p_phone !~ '^(\+?20|0)?1[0125][0-9]{8}$' then raise exception 'invalid_phone'; end if;
  insert into public.requests (title, lang, notes, customer, phone)
  values (trim(p_title), case when p_lang in ('ar', 'en', 'fr') then p_lang else 'ar' end, left(coalesce(p_notes, ''), 300), trim(p_customer), trim(p_phone));
end $$;

-- تغيير حالة الطلب (للمدير فقط): الإلغاء بيرجّع الكميات للمخزون
create or replace function public.set_order_status(p_id bigint, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  it jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into o from public.orders where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if p_status not in ('new', 'confirmed', 'shipped', 'done', 'cancelled') then raise exception 'invalid_status'; end if;

  if p_status = 'cancelled' and o.status <> 'cancelled' then
    for it in select value from jsonb_array_elements(o.items) loop
      if not coalesce((it ->> 'preorder')::boolean, false) then
        update public.products set stock = stock + (it ->> 'qty')::int where id = (it ->> 'id')::uuid;
      end if;
    end loop;
  elsif o.status = 'cancelled' and p_status <> 'cancelled' then
    for it in select value from jsonb_array_elements(o.items) loop
      if not coalesce((it ->> 'preorder')::boolean, false) then
        update public.products set stock = greatest(0, stock - (it ->> 'qty')::int) where id = (it ->> 'id')::uuid;
      end if;
    end loop;
  end if;
  update public.orders set status = p_status where id = p_id;
end $$;

revoke all on function public.place_order(text, text, text, text, text, jsonb) from public;
revoke all on function public.place_request(text, text, text, text, text) from public;
revoke all on function public.set_order_status(bigint, text) from public;
grant execute on function public.place_order(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.place_request(text, text, text, text, text) to anon, authenticated;
grant execute on function public.set_order_status(bigint, text) to authenticated;

-- ============ صور الأغلفة (Storage) ============

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

drop policy if exists "covers public read" on storage.objects;
create policy "covers public read" on storage.objects for select using (bucket_id = 'covers');
drop policy if exists "covers admin insert" on storage.objects;
create policy "covers admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'covers' and public.is_admin());
drop policy if exists "covers admin update" on storage.objects;
create policy "covers admin update" on storage.objects for update to authenticated using (bucket_id = 'covers' and public.is_admin());
drop policy if exists "covers admin delete" on storage.objects;
create policy "covers admin delete" on storage.objects for delete to authenticated using (bucket_id = 'covers' and public.is_admin());

-- ============ بعد ما تعمل حساب المدير ============
-- Authentication > Users > Add user (بريدك وكلمة مرور قوية)، وبعدين شغّل السطر ده ببريدك:
-- insert into public.admins (user_id) select id from auth.users where email = 'YOUR-EMAIL@example.com';
