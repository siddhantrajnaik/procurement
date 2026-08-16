import { ActivityType } from '../types';

const NOTIF_PREF_KEY = 'procure.notif.enabled';

export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

export function isNotificationEnabled(): boolean {
  if (!isNotificationSupported()) return false;
  return Notification.permission === 'granted' && localStorage.getItem(NOTIF_PREF_KEY) === '1';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === 'denied') return false;
  if (Notification.permission === 'granted') {
    localStorage.setItem(NOTIF_PREF_KEY, '1');
    return true;
  }
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    localStorage.setItem(NOTIF_PREF_KEY, '1');
    return true;
  }
  return false;
}

export function disableNotifications(): void {
  localStorage.removeItem(NOTIF_PREF_KEY);
}

const ACTIVITY_BODY: Record<ActivityType, string> = {
  created: 'New procurement request created',
  quote_added: 'A quotation was added',
  status_changed: 'Order status was updated',
  comment_added: 'New comment posted',
  pi_approved: 'PI approval granted',
  assigned: 'Assignment changed',
  delivery_recorded: 'Delivery was recorded',
};

export function showBrowserNotification(
  actorName: string,
  type: ActivityType,
  purchaseTitle: string,
  basePath: string,
): void {
  if (!isNotificationEnabled() || !document.hidden) return;
  try {
    const body = `${actorName}: ${ACTIVITY_BODY[type] ?? 'Activity update'} — "${purchaseTitle}"`;
    const n = new Notification('MB Lab', {
      body,
      icon: `${basePath}icon-192.png`,
      tag: 'mb-lab-activity',
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {}
}
