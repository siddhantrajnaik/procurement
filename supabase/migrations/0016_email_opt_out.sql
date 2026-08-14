-- Add email notification preference (default: subscribed)
alter table public.profiles add column if not exists email_notifications boolean default true;

-- Update notify_delivery to respect the preference
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
    return;
  end if;

  select jsonb_agg(email)
  into recipients
  from public.profiles
  where email is not null
    and role != 'guest'
    and email_notifications = true;

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
