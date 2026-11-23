// Web Audio playback for the game. Files are decoded once and played as buffers:
// phones cap how many <audio> elements a page may hold and drop the music when a
// rapid-fire game goes over it, and an <audio> loop leaves a gap at every repeat.
const MUSIC_VOLUME = 0.3;
const SILENCE = 0.002;

/** `files` are names under `base`; `musicFile` loops for as long as music is wanted. */
export function createSound(base, files, musicFile) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const buffers = {};
  let music = null;
  let wantMusic = false;

  // A file that fails to load just stays silent
  for (const file of new Set([...files, musicFile])) {
    fetch(`${base}/${file}`)
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        buffers[file] = buffer;
        if (file === musicFile && wantMusic) startMusic();
      })
      .catch(() => {});
  }

  // mp3 encoders pad both ends with silence; looping over it would be heard as a gap
  function loopBounds(buffer) {
    const data = buffer.getChannelData(0);
    let first = 0;
    let last = data.length - 1;
    while (first < last && Math.abs(data[first]) < SILENCE) first++;
    while (last > first && Math.abs(data[last]) < SILENCE) last--;
    return [first / buffer.sampleRate, (last + 1) / buffer.sampleRate];
  }

  function startMusic() {
    wantMusic = true;
    const buffer = buffers[musicFile];
    if (!buffer || music) return;
    const gain = ctx.createGain();
    gain.gain.value = MUSIC_VOLUME;
    gain.connect(master);
    music = ctx.createBufferSource();
    music.buffer = buffer;
    music.loop = true;
    [music.loopStart, music.loopEnd] = loopBounds(buffer);
    music.connect(gain);
    music.start(0, music.loopStart);
  }

  function stopMusic() {
    wantMusic = false;
    music?.stop();
    music = null;
  }

  return {
    /** Play a sound effect; `seconds` cuts a long file short. */
    play(file, volume = 1, seconds = 0) {
      const buffer = buffers[file];
      if (!buffer || ctx.state !== "running") return;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      gain.connect(master);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.start();
      if (seconds && seconds < buffer.duration) {
        // Fade the tail so the cut does not click
        const end = ctx.currentTime + seconds;
        gain.gain.setValueAtTime(volume, end - 0.04);
        gain.gain.linearRampToValueAtTime(0, end);
        source.stop(end);
      }
    },
    /** Start the music from the top. */
    restartMusic() {
      stopMusic();
      startMusic();
    },
    stopMusic,
    setMuted: (muted) => (master.gain.value = muted ? 0 : 1),
    // Browsers only let audio start from a tap, so `resume` is called from the start button
    resume: () => ctx.resume(),
    suspend: () => ctx.suspend(),
    close: () => ctx.close(),
  };
}
