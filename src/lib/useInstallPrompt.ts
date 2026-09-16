import { useCallback, useEffect, useState } from 'react';
import { readStored, writeStored } from './storage';

/**
 * Chrome's own "install this app" offer, surfaced as a button we control.
 *
 * Chrome stopped showing an automatic install banner years ago: unless a site
 * catches `beforeinstallprompt` and calls `prompt()` itself, the only way in is
 * the browser's three-dot menu, which nobody finds. So we catch the event, hold
 * it, and put a button where it will actually be seen.
 *
 * The event only fires on Chromium, only over https (or localhost), only once
 * the service worker is live, and never if the app is already installed — so
 * `canInstall` staying false is the normal case on iOS and on a second visit,
 * not a failure. Callers must render nothing when it is false.
 */

const DISMISSED_KEY = 'procure.install.dismissed';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => readStored(DISMISSED_KEY) === '1');

  useEffect(() => {
    // Already running as an installed app — there is nothing to offer.
    try {
      if (window.matchMedia('(display-mode: standalone)').matches) return;
    } catch {
      /* matchMedia is not worth failing over */
    }

    const onPrompt = (e: Event) => {
      // Without this Chrome may show its own UI at a moment of its choosing.
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* she closed it, or Chrome declined to show it */
    }
    // The event is single-use either way: Chrome will fire a fresh one on a
    // later visit if she did not install.
    setDeferred(null);
  }, [deferred]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    writeStored(DISMISSED_KEY, '1');
  }, []);

  return { canInstall: deferred !== null && !dismissed, install, dismiss };
}
