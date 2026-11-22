-- إشعارات تلجرام: كل طلب جديد أو طلب خاص جديد يوصلك رسالة على تلجرام
-- شغّل الملف كله في Supabase > SQL Editor (بعد supabase.sql)
-- بعدها شغّل آخر سطر فيه (insert) بالتوكن والـ chat id بتوعك

create extension if not exists pg_net with schema extensions;

-- جدول سري: RLS مفعّل ومفيش أي policy، يعني مفيش حد يقدر يقراه من الموقع
create table if not exists public.telegram_config (
  id int primary key default 1 check (id = 1),
  bot_token text not null,
  chat_id text not null
);
alter table public.telegram_config enable row level security;

create or replace function public.tg_send(p_text text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  c public.telegram_config;
begin
  select * into c from public.telegram_config where id = 1;
  if not found then return; end if;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || c.bot_token || '/sendMessage',
    body := jsonb_build_object('chat_id', c.chat_id, 'text', left(p_text, 3500))
  );
exception when others then
  null; -- لو تلجرام وقع، الطلب نفسه ما يتعطلش
end $$;
revoke all on function public.tg_send(text) from public, anon, authenticated;

create or replace function public.tg_on_order()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  lines text;
begin
  select string_agg('- ' || (e ->> 'title') || ' × ' || (e ->> 'qty') || case when (e ->> 'preorder')::boolean then ' (بالطلب)' else '' end, E'\n')
    into lines from jsonb_array_elements(new.items) e;
  perform public.tg_send(
    'طلب جديد #' || new.id || E'\n\n' ||
    'الاسم: ' || new.customer || E'\n' ||
    'الموبايل: ' || new.phone || E'\n' ||
    'المحافظة: ' || new.gov || E'\n' ||
    'العنوان: ' || new.address || E'\n\n' ||
    coalesce(lines, '') || E'\n\n' ||
    'الشحن: ' || new.shipping || ' ج.م' || E'\n' ||
    'الإجمالي: ' || new.total || ' ج.م (الدفع عند الاستلام)' ||
    case when coalesce(new.note, '') <> '' then E'\n\nملاحظات: ' || new.note else '' end
  );
  return new;
end $$;

create or replace function public.tg_on_request()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.tg_send(
    'طلب مانجا خاص #' || new.id || E'\n\n' ||
    'العنوان: ' || new.title || E'\n' ||
    'اللغة: ' || new.lang || E'\n' ||
    case when coalesce(new.notes, '') <> '' then 'ملاحظات: ' || new.notes || E'\n' else '' end ||
    'الاسم: ' || coalesce(new.customer, '') || E'\n' ||
    'الموبايل: ' || coalesce(new.phone, '')
  );
  return new;
end $$;

drop trigger if exists trg_tg_order on public.orders;
create trigger trg_tg_order after insert on public.orders for each row execute function public.tg_on_order();
drop trigger if exists trg_tg_request on public.requests;
create trigger trg_tg_request after insert on public.requests for each row execute function public.tg_on_request();

-- ============ شغّل السطر ده لوحده بعد ما تبدّل القيمتين ============
-- insert into public.telegram_config (id, bot_token, chat_id)
-- values (1, 'التوكن-من-BotFather', 'الـ-chat-id-بتاعك')
-- on conflict (id) do update set bot_token = excluded.bot_token, chat_id = excluded.chat_id;
