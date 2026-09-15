/**
 * What the app does, for the launch showcase.
 *
 * Taken from the code rather than from memory: the five entries in `TAB_TITLES`
 * (App.tsx), the eleven tiles in ProfileView, and the areas that are neither —
 * visitor mode, the PI's own view, and the things that live inside a purchase.
 *
 * Icons match the ones each area already uses in the app, so the room sees the
 * same symbol on the slide and in the product.
 */
import {
  MessageSquare,
  Package,
  Search,
  History,
  UserRound,
  Store,
  Wrench,
  FlaskConical,
  CalendarClock,
  HelpCircle,
  ListChecks,
  Sparkles,
  Link2,
  NotebookPen,
  TestTube2,
  Beaker,
  IndianRupee,
  Receipt,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';

export interface Feature {
  icon: LucideIcon;
  name: string;
  blurb: string;
  /** Loose grouping, shown as an eyebrow above the name. */
  group: string;
}

export const FEATURES: Feature[] = [
  // ---- the five tabs
  {
    group: 'Procurement',
    icon: MessageSquare,
    name: 'Requests & Quotations',
    blurb:
      'Anyone raises a request. Quotes go on it side by side, one is chosen, and the order is tracked to the door.',
  },
  {
    group: 'Procurement',
    icon: Receipt,
    name: 'Invoices & Deliveries',
    blurb:
      'Photograph the invoice onto the purchase it belongs to. Record what actually arrived, and how much of it.',
  },
  {
    group: 'Procurement',
    icon: IndianRupee,
    name: 'Price Memory',
    blurb:
      'Adding a quote shows what the lab paid for the same thing last time, and to whom. No more guessing at a fair price.',
  },
  {
    group: 'Stock',
    icon: Package,
    name: 'Inventory',
    blurb:
      'What is on the shelf, where it lives, and what is running low — with an email when something crosses its threshold.',
  },
  {
    group: 'Everywhere',
    icon: Search,
    name: 'Search',
    blurb:
      'One box across every request, quotation and comment — and everything in stock — by name, vendor, category or person.',
  },
  {
    group: 'Everywhere',
    icon: History,
    name: 'Activity',
    blurb:
      'Who did what, newest first: every request raised, quote added, status changed and delivery recorded.',
  },
  {
    group: 'Everywhere',
    icon: UserRound,
    name: 'Profile',
    blurb: 'Your sign-in, your notification settings, and the door to everything below.',
  },

  // ---- the eleven tiles
  {
    group: 'The lab',
    icon: Wrench,
    name: 'Lab Equipment',
    blurb:
      'Every instrument with its status, service contact and warranty. Report a fault, follow the thread, close it when it is fixed.',
  },
  {
    group: 'The lab',
    icon: CalendarClock,
    name: 'Bookings',
    blurb: 'Reserve a shared instrument for a slot, with clashes caught before they happen.',
  },
  {
    group: 'The lab',
    icon: TestTube2,
    name: 'Sample Inventory',
    blurb: 'Boxes, samples and where each one sits, so nobody thaws a freezer looking.',
  },
  {
    group: 'The lab',
    icon: NotebookPen,
    name: 'Lab Notebook',
    blurb: 'Shared pages for protocols and notes, written once and readable by everyone.',
  },
  {
    group: 'The lab',
    icon: Store,
    name: 'Vendor Directory',
    blurb: 'Who to call, which person at which company, and what we have bought from them.',
  },
  {
    group: 'The lab',
    icon: ListChecks,
    name: 'Lists',
    blurb: 'Shared checklists for anything the lab needs to keep track of together.',
  },
  {
    group: 'The lab',
    icon: HelpCircle,
    name: 'Lost & Found',
    blurb: 'Post what went missing, and let whoever has it say so.',
  },
  {
    group: 'The lab',
    icon: Link2,
    name: 'Quick Links',
    blurb: 'Webmail, eAcademics, hood booking — the portals everyone needs, one tap away.',
  },
  {
    group: 'The lab',
    icon: Sparkles,
    name: 'Shubh Muhurat',
    blurb: 'The auspicious hours for the day, computed on the device.',
  },
  {
    group: 'The lab',
    icon: Wrench,
    name: 'SidLab Tools',
    blurb: 'The small calculations this lab does over and over, in one place.',
  },

  // ---- the parts that are not tiles
  {
    group: 'Visitors',
    icon: FlaskConical,
    name: 'Visitor Mode',
    blurb:
      'Researchers from outside get their own screen: the instruments, a one-tap usage log, and nothing else. No prices, no purchases.',
  },
  {
    group: 'Visitors',
    icon: Beaker,
    name: 'Visitor Log',
    blurb:
      'Who came, which instrument they ran, for how long, and anything they took away with them.',
  },
  {
    group: 'Oversight',
    icon: IndianRupee,
    name: 'The PI’s View',
    blurb:
      'A screen of her own: what the lab spent this month and this quarter, and how the instruments are being used.',
  },
  {
    group: 'Anywhere',
    icon: Smartphone,
    name: 'Install It',
    blurb:
      'Add it to the home screen and it opens like any other app — no address bar, no app store.',
  },
];
