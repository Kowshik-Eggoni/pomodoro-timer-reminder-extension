let audioCtx;

/**
 * Initializes and resumes the AudioContext.
 */
async function ensureCtx() {
  if (!audioCtx) {
    audioCtx = new (self.AudioContext || self.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a classic mechanical kitchen timer alarm sound
 */
async function kitchenTimerAlarm() {
  const ac = await ensureCtx();
  const now = ac.currentTime;

  // Kitchen timer parameters - pleasant yet noticeable
  const bellFreq = 1800; // Lower, more pleasant bell frequency (Hz)
  const hammerFreq = 12; // Slower, gentler ringing pattern
  const duration = 6; // Total duration in seconds
  const volume = 0.08; // Softer volume for comfort

  // Create main gain node
  const mainGain = ac.createGain();
  mainGain.gain.value = volume;
  mainGain.connect(ac.destination);

  // Create the bell tone (carrier)
  const bellOsc = ac.createOscillator();
  bellOsc.type = "triangle"; // Triangle wave for softer, more pleasant sound
  bellOsc.frequency.value = bellFreq;

  // Create the hammer/modulator for rapid on/off effect
  const modulator = ac.createOscillator();
  modulator.type = "square";
  modulator.frequency.value = hammerFreq;

  // Create gain node for amplitude modulation
  const modulatorGain = ac.createGain();
  modulatorGain.gain.value = 0.5; // Modulation depth

  // Connect modulator to control the bell's amplitude
  modulator.connect(modulatorGain);
  modulatorGain.connect(mainGain.gain);

  // Add a second bell tone for richness (slightly detuned)
  const bellOsc2 = ac.createOscillator();
  bellOsc2.type = "triangle"; // Match the softer wave type
  bellOsc2.frequency.value = bellFreq * 1.01; // Slight detune for richness

  // Connect everything
  bellOsc.connect(mainGain);
  bellOsc2.connect(mainGain);

  // Start all oscillators
  bellOsc.start(now);
  bellOsc2.start(now);
  modulator.start(now);

  // Stop after duration
  bellOsc.stop(now + duration);
  bellOsc2.stop(now + duration);
  modulator.stop(now + duration);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "beep") {
    kitchenTimerAlarm();
  }
});
