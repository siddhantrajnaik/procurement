-- Enable pg_net for HTTP requests from Postgres
create extension if not exists pg_net with schema extensions;

-- Table to store the Resend API key (set it once via SQL editor)
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

-- Insert placeholder — replace YOUR_RESEND_API_KEY after signing up at resend.com
insert into public.app_config (key, value) values
  ('resend_api_key', 'YOUR_RESEND_API_KEY'),
  ('notification_from', 'MB Lab <onboarding@resend.dev>')
on conflict (key) do nothing;

-- Function to send delivery email to all lab members
create or replace function public.notify_delivery(
  p_title text,
  p_quantity text,
  p_requester_name text
) returns void language plpgsql security definer as $$
declare
  api_key text;
  from_addr text;
  recipients jsonb;
begin
  select value into api_key from public.app_config where key = 'resend_api_key';
  select value into from_addr from public.app_config where key = 'notification_from';

  if api_key is null or api_key = 'YOUR_RESEND_API_KEY' then
    return; -- not configured yet, skip silently
  end if;

  -- Collect all user emails (skip nulls and guest)
  select jsonb_agg(email)
  into recipients
  from public.profiles
  where email is not null and role != 'guest';

  if recipients is null then return; end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', from_addr,
      'to', recipients,
      'subject', '📦 Delivered: ' || p_title,
      'html', '<div style="font-family:sans-serif;max-width:480px">'
        || '<h2 style="color:#FF6B4A">📦 Order Delivered</h2>'
        || '<p><strong>' || p_title || '</strong> (' || p_quantity || ') has been marked as delivered.</p>'
        || '<p style="color:#888">Requested by ' || p_requester_name || '</p>'
        || '<hr style="border:none;border-top:1px solid #eee">'
        || '<p style="font-size:12px;color:#aaa">MB Lab Procurement</p>'
        || '</div>'
    )
  );
end;
$$;
