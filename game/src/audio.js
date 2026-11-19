// All sound is synthesized with WebAudio — no audio files, no network.
// Three radio stations play looping synth patterns, plus engine hum,
// sirens, gunshots, punches, pickups and UI blips. Everything is guarded
// so the game still runs when audio is unavailable (headless screenshots).
import { RADIO_STATIONS } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let stationIndex = 0;
  let musicTimer = null;
  let step = 0;
  let enabled = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.22;
      musicGain.connect(master);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.5;
      sfxGain.connect(master);
      // Engine: two detuned sawtooths through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 30;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      engineOsc._twin = engineOsc2;
      // Siren: alternating two-tone triangle wave.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function note(midi, time, duration, type, gainValue, dest) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = midiToFreq(midi);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(gainValue, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain);
    gain.connect(dest || musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  // One bar of the current station: bass line + lead riff + hat noise.
  function playBar() {
    if (!ctx || !enabled) return;
    const station = RADIO_STATIONS[stationIndex];
    const beat = 60 / station.bpm;
    const now = ctx.currentTime + 0.05;
    const bar = step;
    step += 1;
    for (let b = 0; b < 4; b += 1) {
      const t = now + b * beat;
      const bassNote = station.root - 12 + station.scale[(bar + b) % station.scale.length];
      note(bassNote, t, beat * 0.9, 'triangle', 0.5);
      if ((bar + b) % 2 === 0) note(station.root + 12 + station.scale[(bar * 2 + b) % station.scale.length], t, beat * 0.45, 'square', 0.12);
      // Hi-hat: short filtered noise burst.
      const noise = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, 2205, 44100);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      noise.buffer = buffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6000;
      const ng = ctx.createGain();
      ng.gain.value = 0.08;
      noise.connect(hp);
      hp.connect(ng);
      ng.connect(musicGain);
      noise.start(t + beat / 2);
    }
    const barMs = beat * 4 * 1000;
    musicTimer = window.setTimeout(playBar, barMs);
  }

  function startMusic() {
    if (!ensure()) return;
    enabled = true;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!musicTimer) playBar();
  }

  function stopMusic() {
    enabled = false;
    if (musicTimer) { window.clearTimeout(musicTimer); musicTimer = null; }
  }

  function noiseBurst(duration, filterFreq, gainValue) {
    if (!ctx) return;
    const noise = ctx.createBufferSource();
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    noise.start();
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
      startMusic();
    },
    station() {
      return RADIO_STATIONS[stationIndex];
    },
    nextStation() {
      stationIndex = (stationIndex + 1) % RADIO_STATIONS.length;
      step = 0;
      if (musicTimer) { window.clearTimeout(musicTimer); musicTimer = null; }
      if (enabled) playBar();
      return RADIO_STATIONS[stationIndex];
    },
    setEngine(speedRatio, driving) {
      if (!ctx || !engineOsc) return;
      const target = driving ? 0.05 + speedRatio * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speedRatio * 160, ctx.currentTime, 0.1);
      if (engineOsc._twin) engineOsc._twin.frequency.setTargetAtTime(28 + speedRatio * 80, ctx.currentTime, 0.1);
    },
    setSiren(on, wanted) {
      if (!ctx || !sirenOsc) return;
      sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(wanted >= 3 ? 950 : 700, ctx.currentTime, 0.3);
    },
    sirenWail() {
      // Called per frame while wanted: alternate the siren tone.
      if (!ctx || !sirenOsc || sirenGain.gain.value < 0.01) return;
      const now = ctx.currentTime;
      sirenOsc.frequency.setTargetAtTime(Math.sin(now * 2.4) > 0 ? 950 : 700, now, 0.05);
    },
    gunshot() {
      if (!ensure()) return;
      noiseBurst(0.14, 1800, 0.6);
      note(90, ctx.currentTime, 0.08, 'square', 0.25, sfxGain);
    },
    punch() {
      if (!ensure()) return;
      noiseBurst(0.09, 500, 0.5);
    },
    crash(intensity) {
      if (!ensure()) return;
      noiseBurst(0.25, 900, Math.min(0.7, 0.2 + intensity * 0.4));
    },
    pickup() {
      if (!ensure()) return;
      note(88, ctx.currentTime, 0.12, 'sine', 0.4, sfxGain);
      note(93, ctx.currentTime + 0.09, 0.18, 'sine', 0.4, sfxGain);
    },
    cash() {
      if (!ensure()) return;
      note(84, ctx.currentTime, 0.1, 'triangle', 0.4, sfxGain);
      note(88, ctx.currentTime + 0.08, 0.1, 'triangle', 0.4, sfxGain);
      note(91, ctx.currentTime + 0.16, 0.2, 'triangle', 0.4, sfxGain);
    },
    blip() {
      if (!ensure()) return;
      note(76, ctx.currentTime, 0.07, 'sine', 0.3, sfxGain);
    },
    horn() {
      if (!ensure()) return;
      note(58, ctx.currentTime, 0.25, 'sawtooth', 0.25, sfxGain);
      note(62, ctx.currentTime, 0.25, 'sawtooth', 0.25, sfxGain);
    },
    missionComplete() {
      if (!ensure()) return;
      [72, 76, 79, 84].forEach((m, i) => note(m, ctx.currentTime + i * 0.12, 0.25, 'triangle', 0.4, sfxGain));
    },
    wantedUp() {
      if (!ensure()) return;
      note(65, ctx.currentTime, 0.2, 'square', 0.3, sfxGain);
      note(62, ctx.currentTime + 0.15, 0.3, 'square', 0.3, sfxGain);
    },
    stop() {
      stopMusic();
    },
  };
}
