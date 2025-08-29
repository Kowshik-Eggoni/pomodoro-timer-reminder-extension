const DEFAULTS = {
  reminders: [],
};

function el(id) {
  return document.getElementById(id);
}

async function load() {
  const { settings } = await chrome.storage.local.get("settings");
  const s = { ...DEFAULTS, ...(settings || {}) };
  renderReminders(s.reminders);
}

function renderReminders(list) {
  const wrap = el("reminders");
  wrap.innerHTML = "";
  for (const r of list) {
    const div = document.createElement("div");
    div.className = "reminder";
    div.innerHTML = `<input type="time" value="${r.time}"><span>${r.label}</span><button data-id="${r.id}">Delete</button>`;
    div.querySelector("button").onclick = async () => {
      const { settings } = await chrome.storage.local.get("settings");
      const next = (settings.reminders || []).filter((x) => x.id !== r.id);
      await chrome.storage.local.set({ settings: { ...settings, reminders: next } });
      chrome.runtime.sendMessage({ cmd: "refresh-reminders" });
      renderReminders(next);
    };
    div.querySelector("input").onchange = async (e) => {
      const { settings } = await chrome.storage.local.get("settings");
      const next = (settings.reminders || []).map((x) => (x.id === r.id ? { ...x, time: e.target.value } : x));
      await chrome.storage.local.set({ settings: { ...settings, reminders: next } });
      chrome.runtime.sendMessage({ cmd: "refresh-reminders" });
    };
    wrap.appendChild(div);
  }
}

el("add").onclick = async () => {
  const time = el("rTime").value;
  const label = el("rLabel").value.trim() || "Reminder";
  const { settings } = await chrome.storage.local.get("settings");
  const list = settings?.reminders || [];
  const id = crypto.randomUUID();
  const next = [...list, { id, time, label }];
  await chrome.storage.local.set({ settings: { ...settings, reminders: next } });
  chrome.runtime.sendMessage({ cmd: "refresh-reminders" });
  renderReminders(next);
};

el("save").onclick = async () => {
  const { settings } = await chrome.storage.local.get("settings");
  await chrome.storage.local.set({ settings });
  alert("Saved");
};

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.cmd === "render") load();
});

load();
