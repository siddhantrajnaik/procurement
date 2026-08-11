-- Optional demo data. Run after 0001_init.sql if you want the feed populated
-- with example requests. Safe to skip on a real deployment — the app works fine
-- against an empty purchases table.
--
-- To wipe demo data later:  delete from public.purchases where id like 'b1000000%';

insert into public.purchases
  (id, title, description, quantity, category, priority, status, preferred_company,
   requested_by, assigned_to, requires_pi_approval, pi_approved, created_at)
values
  ('b1000000-0000-4000-8000-000000000001',
   'Ni-NTA Resin',
   'Need 100 mL for protein purification of His-tagged membrane proteins.',
   '100 mL', 'Resins & Media', 'urgent', 'waiting', 'Qiagen or Cytiva',
   'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000008',
   false, false, now() - interval '2 minutes'),

  ('b1000000-0000-4000-8000-000000000002',
   'Anti-His Antibody',
   'Monoclonal antibody for Western Blot experiments (1:1000 dilution).',
   '100 µL', 'Antibodies', 'normal', 'quotes', 'Cell Signaling / Abcam / Thermo',
   'a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000008',
   true, false, now() - interval '1 hour'),

  ('b1000000-0000-4000-8000-000000000003',
   'PCR Tips (10 µL)',
   'Sterile, filter tips for high-precision P10 pipettes.',
   '5 packs', 'Plasticware', 'normal', 'ordered', 'Eppendorf',
   'a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000008',
   false, false, now() - interval '3 hours'),

  ('b1000000-0000-4000-8000-000000000004',
   'LB Agar Plates',
   'Ready-to-use pre-poured LB Agar plates for bacterial transformations.',
   '2 sleeves', 'Reagents', 'low', 'delivered', 'HiMedia',
   'a1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000008',
   false, false, now() - interval '5 hours'),

  ('b1000000-0000-4000-8000-000000000005',
   'Ampicillin',
   'Analytical grade ampicillin sodium salt for selection media.',
   '5 g', 'Reagents', 'normal', 'waiting', 'HiMedia',
   'a1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000008',
   false, false, now() - interval '1 day'),

  ('b1000000-0000-4000-8000-000000000006',
   'CryoGrids (Quantifoil R1.2/1.3)',
   'Copper 300 mesh grids for high-resolution Cryo-EM screening.',
   '2 boxes', 'Consumables', 'urgent', 'ordered', 'Quantifoil Micro Tools',
   'a1000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000008',
   false, false, now() - interval '26 hours')
on conflict (id) do nothing;

insert into public.quotations
  (purchase_id, vendor, price, notes, file_name, is_approved, is_recommended, uploaded_by, created_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'Qiagen Biotech', 18500,
   'Includes 10% academic discount.', 'Qiagen_NiNTA_100ml_Quote.pdf',
   false, true, 'a1000000-0000-4000-8000-000000000001', now() - interval '10 minutes'),

  ('b1000000-0000-4000-8000-000000000002', 'Thermo Fisher Scientific', 30800,
   'Includes express cold-chain delivery.', 'Thermo_AntiHis_Quote.pdf',
   false, true, 'a1000000-0000-4000-8000-000000000008', now() - interval '45 minutes'),
  ('b1000000-0000-4000-8000-000000000002', 'Cell Signaling Technology', 32000,
   'High validation score in literature.', 'CST_AntiHis_Ref9991.pdf',
   false, false, 'a1000000-0000-4000-8000-000000000002', now() - interval '30 minutes'),
  ('b1000000-0000-4000-8000-000000000002', 'Abcam India', 34500,
   null, 'Abcam_Ab18184_Quotation.pdf',
   false, false, 'a1000000-0000-4000-8000-000000000008', now() - interval '20 minutes'),

  ('b1000000-0000-4000-8000-000000000003', 'Eppendorf Direct', 12400,
   null, 'Eppendorf_FilterTips_PO892.pdf',
   true, false, 'a1000000-0000-4000-8000-000000000008', now() - interval '2 hours'),

  ('b1000000-0000-4000-8000-000000000005', 'HiMedia Labs', 4200,
   null, 'HiMedia_Ampicillin_Quote.pdf',
   false, false, 'a1000000-0000-4000-8000-000000000008', now() - interval '18 hours'),

  ('b1000000-0000-4000-8000-000000000006', 'Electron Microscopy Sciences', 28200,
   'Lead time 4 business days.', 'EMS_Quantifoil_Grids.pdf',
   true, false, 'a1000000-0000-4000-8000-000000000008', now() - interval '1 day'),
  ('b1000000-0000-4000-8000-000000000006', 'TED PELLA Inc.', 29500,
   null, 'TedPella_CryoGrids_Quote.pdf',
   false, false, 'a1000000-0000-4000-8000-000000000008', now() - interval '1 day');

insert into public.comments (purchase_id, author_id, body, created_at) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'Need this urgently before Friday for the upcoming batch purification.', now() - interval '2 minutes'),
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000008',
   'Qiagen quotation uploaded. Checking if Cytiva has a better lead time.', now() - interval '1 minute'),

  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
   'Thermo quote looks most cost-effective at ₹30,800 with fast cold-chain delivery.', now() - interval '40 minutes'),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000008',
   'Since this is over ₹25,000 it needs PI signoff before we raise the PO.', now() - interval '30 minutes'),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003',
   'We also have secondary HRP conjugate in freezer stock.', now() - interval '5 minutes'),

  ('b1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000008',
   'PO released to EMS. Lead time 4 business days.', now() - interval '1 day'),
  ('b1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000001',
   'Great, my vitrification slot at the EM facility is on Tuesday.', now() - interval '20 hours');

insert into public.activities (purchase_id, purchase_title, actor_id, type, details, created_at) values
  ('b1000000-0000-4000-8000-000000000001', 'Ni-NTA Resin', 'a1000000-0000-4000-8000-000000000001',
   'quote_added', 'uploaded a quotation from Qiagen Biotech (₹18,500)', now() - interval '10 minutes'),
  ('b1000000-0000-4000-8000-000000000002', 'Anti-His Antibody', 'a1000000-0000-4000-8000-000000000008',
   'quote_added', 'uploaded a quotation from Thermo Fisher (₹30,800)', now() - interval '45 minutes'),
  ('b1000000-0000-4000-8000-000000000003', 'PCR Tips (10 µL)', 'a1000000-0000-4000-8000-000000000008',
   'status_changed', 'marked the request as Ordered', now() - interval '2 hours'),
  ('b1000000-0000-4000-8000-000000000004', 'LB Agar Plates', 'a1000000-0000-4000-8000-000000000005',
   'status_changed', 'marked the request as Delivered', now() - interval '5 hours'),
  ('b1000000-0000-4000-8000-000000000006', 'CryoGrids (Quantifoil R1.2/1.3)', 'a1000000-0000-4000-8000-000000000008',
   'status_changed', 'issued a purchase order to EMS (₹28,200)', now() - interval '1 day');
