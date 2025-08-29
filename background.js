// Pomodoro schedule: 25 focus, 5 break ×3, then 15 break on 4th; loop.
// We schedule the next phase via chrome.alarms; survive browser restarts; works offline.

const POMO_KEY = "pomo_state";
const SETTINGS_KEY = "settings";

// Default settings
const DEFAULTS = {
  sound: false, // notification sound is optional (popup can play)
  longBreakEvery: 4, // 4th interval long break
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  reminders: [], // [{id, label, time:"11:15"}]
};

// Utility: get today at HH:MM local Date
function todayAt(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// Utility: push a notification
async function notify(title, message) {
  console.log("[notify]", title, message);
  await ensureOffscreen();
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
    requireInteraction: true,
  });
  // Play a small beep
  playBeep();
}

async function ensureOffscreen() {
  const exists = await chrome.offscreen.hasDocument?.();
  if (exists) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play a short beep on timer and reminder notifications.",
  });
}

function playBeep() {
  // send to offscreen page - using default alarm settings
  chrome.runtime.sendMessage({ type: "beep" });
}


// Persist/retrieve state
async function getSettings() {
  const { [SETTINGS_KEY]: s } = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULTS, ...(s || {}) };
}

async function setSettings(patch) {
  const s = await getSettings();
  const merged = { ...s, ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}

async function getState() {
  const { [POMO_KEY]: st } = await chrome.storage.local.get(POMO_KEY);
  return st || null;
}

async function setState(st) {
  await chrome.storage.local.set({ [POMO_KEY]: st });
}

async function clearState() {
  await chrome.storage.local.remove(POMO_KEY);
}

// Phase scheduler
async function scheduleNext(reason) {
  const s = await getSettings();
  let st = await getState();
  if (!st) {
    st = { cycle: 0, phase: "idle" }; // phase: idle|focus|short|long
  }

  if (st.phase === "idle") {
    st.phase = "focus";
    st.cycle = 1;
    await setState(st);
    notify("Pomodoro started", "Focus for " + s.focusMinutes + " minutes.");
    chrome.alarms.create("pomo", { delayInMinutes: s.focusMinutes });
    return;
  }

  if (st.phase === "focus") {
    // decide next: short or long break
    const isLong = st.cycle % s.longBreakEvery === 0;
    st.phase = isLong ? "long" : "short";
    await setState(st);
    notify(isLong ? "Long break" : "Break", isLong ? `Relax for ${s.longBreakMinutes} minutes.` : `Relax for ${s.shortBreakMinutes} minutes.`);
    chrome.alarms.create("pomo", { delayInMinutes: isLong ? s.longBreakMinutes : s.shortBreakMinutes });
    return;
  }

  if (st.phase === "short" || st.phase === "long") {
    // back to focus, increment cycle only after short break
    const wasLong = st.phase === "long";
    st.phase = "focus";
    if (!wasLong) {
      st.cycle = st.cycle + 1;
    }
    await setState(st);
    notify("Back to focus", "Focus for " + s.focusMinutes + " minutes.");
    chrome.alarms.create("pomo", { delayInMinutes: s.focusMinutes });
    return;
  }
}

// Start today's cycle at workStart (or immediately if past that time)
async function ensureDailyStart() {
  // Auto-start functionality removed - no longer creates daily alarms
  // Function kept for compatibility but does nothing
  return;
}

// Clock-time reminders (local, daily at HH:MM)
async function refreshReminderAlarms() {
  const s = await getSettings();
  // Clear existing reminder alarms
  const alarms = await chrome.alarms.getAll();
  await Promise.all(alarms.filter((a) => a.name.startsWith("reminder:")).map((a) => chrome.alarms.clear(a.name)));

  for (const r of s.reminders) {
    const when = todayAt(r.time).getTime();
    chrome.alarms.create(`reminder:${r.id}`, { when, periodInMinutes: 24 * 60 });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await setSettings({}); // write defaults if missing
  await ensureOffscreen();
  await ensureDailyStart();
  await refreshReminderAlarms();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDailyStart();
  await ensureOffscreen();
  await refreshReminderAlarms();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log("[alarm]", alarm.name, new Date(alarm.scheduledTime).toLocaleString());
  if (alarm.name === "pomo") {
    await scheduleNext("alarm");
  } else if (alarm.name.startsWith("reminder:")) {
    const s = await getSettings();
    const id = alarm.name.split(":")[1];
    const match = (s.reminders || []).find((r) => r.id === id);
    const label = match ? match.label : "Reminder";
    await notify("Reminder", label);
  }
});

// Handle messages from popup/options
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("[message]", message);
  if (message.cmd === "schedule-next") {
    await scheduleNext("manual");
  } else if (message.cmd === "refresh-reminders") {
    await refreshReminderAlarms();
  } else if (message.cmd === "ensure-daily-start") {
    await ensureDailyStart();
  } else if (message.cmd === "test-sound") {
    await ensureOffscreen();
    playBeep();
  }
  return true;
});
