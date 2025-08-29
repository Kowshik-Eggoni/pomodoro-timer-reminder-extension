// Simple live countdown based on alarms; UI-only. Not authoritative timer.

async function readState() {
  return new Promise((resolve) => chrome.storage.local.get(["pomo_state"], (r) => resolve(r.pomo_state || null)));
}

function updateUI(st) {
  const phaseEl = document.getElementById("phase");
  const phase = st ? st.phase : "idle";
  
  // Update phase text with proper display names
  const phaseNames = {
    idle: "Idle",
    focus: "Focus",
    short: "Short Break",
    long: "Long Break"
  };
  
  phaseEl.textContent = phaseNames[phase] || phase;
  
  // Remove all phase classes and add the current one
  phaseEl.className = "pill";
  if (phase) {
    phaseEl.classList.add(phase);
  }
  
  document.getElementById("cycle").textContent = st ? `#${st.cycle || 0}` : "#0";
}

async function startNow() {
  await chrome.storage.local.set({ pomo_state: { cycle: 0, phase: "idle" } });
  chrome.runtime.getBackgroundPage?.(() => {}); // no-op MV3; just to hint loading
  chrome.runtime.sendMessage({ cmd: "schedule-next" });
}

document.getElementById("start").addEventListener("click", startNow);

document.getElementById("stop").addEventListener("click", async () => {
  await chrome.storage.local.remove("pomo_state");
  const alarms = await chrome.alarms.getAll();
  for (const a of alarms) if (a.name === "pomo") await chrome.alarms.clear(a.name);
  updateUI(null);
});

document.getElementById("test-sound").addEventListener("click", async () => {
  chrome.runtime.sendMessage({ cmd: "test-sound" });
});

// Best-effort countdown (poll next alarm)
async function tick() {
  const alarms = await chrome.alarms.getAll();
  const pomo = alarms.find((a) => a.name === "pomo");
  if (!pomo) {
    document.getElementById("count").textContent = "—";
    const st = await readState();
    updateUI(st);
    setTimeout(tick, 1000);
    return;
  }
  const ms = Math.max(0, pomo.scheduledTime - Date.now());
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  document.getElementById("count").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const st = await readState();
  updateUI(st);
  setTimeout(tick, 250);
}

tick();
