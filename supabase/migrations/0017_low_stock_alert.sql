-- Email low-stock alerts to Siddhant and Sudipto only
create or replace function public.notify_low_stock()
returns void language plpgsql security definer as $$
declare
  api_key text;
  from_addr text;
  items_html text;
  item_count int;
begin
  select value into api_key from public.app_config where key = 'resend_api_key';
  select value into from_addr from public.app_config where key = 'notification_from';

  if api_key is null or api_key = 'YOUR_RESEND_API_KEY' then
    return;
  end if;

  select count(*),
         string_agg(
           '<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">'
           || replace(replace(name, '&', '&amp;'), '<', '&lt;')
           || '</td><td style="padding:6px 12px;border-bottom:1px solid #eee;color:#e74c3c;font-weight:bold">'
           || quantity || ' ' || unit
           || '</td><td style="padding:6px 12px;border-bottom:1px solid #eee">'
           || low_stock_threshold || ' ' || unit
           || '</td><td style="padding:6px 12px;border-bottom:1px solid #eee">'
           || location
           || '</td></tr>',
           ''
         )
  into item_count, items_html
  from public.inventory_items
  where low_stock_threshold is not null
    and quantity <= low_stock_threshold;

  if item_count = 0 or items_html is null then return; end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || api_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', from_addr,
      'to', '["blz258027@bioschool.iitd.ac.in","blz258030@bioschool.iitd.ac.in"]'::jsonb,
      'subject', '⚠️ Low Stock Alert: ' || item_count || ' item(s)',
      'html', '<div style="font-family:sans-serif;max-width:560px">'
        || '<h2 style="color:#FF6B4A">⚠️ Low Stock Alert</h2>'
        || '<p>' || item_count || ' inventory item(s) are at or below their restock threshold:</p>'
        || '<table style="border-collapse:collapse;width:100%;font-size:14px">'
        || '<tr style="background:#f8f8f8"><th style="padding:8px 12px;text-align:left">Item</th>'
        || '<th style="padding:8px 12px;text-align:left">Current</th>'
        || '<th style="padding:8px 12px;text-align:left">Threshold</th>'
        || '<th style="padding:8px 12px;text-align:left">Location</th></tr>'
        || items_html
        || '</table>'
        || '<hr style="border:none;border-top:1px solid #eee;margin:16px 0">'
        || '<p style="font-size:12px;color:#aaa">MB Lab Procurement</p>'
        || '</div>'
    )
  );
end;
$$;
