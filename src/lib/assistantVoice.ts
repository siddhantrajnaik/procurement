const KEY = 'procure.assistant.speak';

/** Whether the assistant reads its replies aloud. On unless turned off. */
export function isAssistantVoiceOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setAssistantVoiceOn(on: boolean): void {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage blocked */ }
}
