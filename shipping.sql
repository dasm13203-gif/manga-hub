-- أسعار الشحن حسب المحافظة (شركة الشحن: بارسيل)
-- شغّل الملف كله مرة واحدة في Supabase > SQL Editor (بعد supabase.sql)

alter table public.settings add column if not exists carrier text default 'بارسيل';
update public.settings set carrier = 'بارسيل' where id = 1 and carrier is null;

create table if not exists public.shipping_rates (
  gov text primary key,
  fee numeric not null default 0 check (fee >= 0),
  active boolean not null default true,
  confirmed boolean not null default false,
  sort int not null default 0
);

-- كل المحافظات بتبدأ بالسعر الافتراضي من الإعدادات، وبعدين تحط أسعار بارسيل الفعلية من لوحة التحكم
insert into public.shipping_rates (gov, fee, sort)
select t.g, coalesce((select ship_fee from public.settings where id = 1), 60), t.ord
from unnest(array[
  'القاهرة','الجيزة','الإسكندرية','القليوبية','الدقهلية','الشرقية','الغربية','المنوفية','البحيرة','كفر الشيخ',
  'دمياط','بورسعيد','الإسماعيلية','السويس','شمال سيناء','جنوب سيناء','الفيوم','بني سويف','المنيا','أسيوط',
  'سوهاج','قنا','الأقصر','أسوان','البحر الأحمر','الوادي الجديد','مطروح'
]) with ordinality as t(g, ord)
on conflict (gov) do nothing;

alter table public.shipping_rates enable row level security;
drop policy if exists "rates read" on public.shipping_rates;
create policy "rates read" on public.shipping_rates for select using (true);
drop policy if exists "rates admin write" on public.shipping_rates;
create policy "rates admin write" on public.shipping_rates for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- دالة الطلب بعد التعديل: سعر الشحن بيتحسب على السيرفر حسب المحافظة
create or replace function public.place_order(
  p_customer text, p_phone text, p_gov text, p_address text, p_note text, p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  it jsonb;
  pr public.products;
  st public.settings;
  rate public.shipping_rates;
  q int;
  sub numeric := 0;
  base numeric;
  ship numeric;
  lines jsonb := '[]'::jsonb;
  oid bigint;
begin
  if coalesce(trim(p_customer), '') = '' or length(p_customer) > 100 then raise exception 'invalid_customer'; end if;
  if p_phone is null or p_phone !~ '^(\+?20|0)?1[0125][0-9]{8}$' then raise exception 'invalid_phone'; end if;
  if coalesce(trim(p_gov), '') = '' or coalesce(trim(p_address), '') = '' or length(p_address) > 300 then raise exception 'invalid_address'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then raise exception 'invalid_items'; end if;

  select * into st from public.settings where id = 1;
  select * into rate from public.shipping_rates where gov = trim(p_gov);
  if found and not rate.active then raise exception 'gov_unavailable'; end if;
  base := coalesce(rate.fee, st.ship_fee, 0);

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

  ship := case
    when sub = 0 then 0
    when coalesce(st.free_over, 0) > 0 and sub >= st.free_over then 0
    else base end;

  insert into public.orders (customer, phone, gov, address, note, items, subtotal, shipping, total)
  values (trim(p_customer), trim(p_phone), trim(p_gov), trim(p_address), left(coalesce(p_note, ''), 300), lines, sub, ship, sub + ship)
  returning id into oid;

  return jsonb_build_object('id', oid, 'subtotal', sub, 'shipping', ship, 'total', sub + ship, 'items', lines);
end $$;

revoke all on function public.place_order(text, text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, text, jsonb) to anon, authenticated;
