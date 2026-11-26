// Web Audio playback for the game. Files are decoded once and played as buffers:
// phones cap how many <audio> elements a page may hold and drop the music when a
// rapid-fire game goes over it, and an <audio> loop leaves a gap at every repeat.
const MUSIC_VOLUME = 0.3;
const SILENCE = 0.002;

/**
 * `files` are effect names under `base`, loaded up front; music is loaded when first asked for.
 * `onLoad` is called as each effect is done loading, whether it loaded or not.
 */
export function createSound(base, files, onLoad = () => {}) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const buffers = {};
  const loading = {};
  let music = null;
  let wantedMusic = null;

  // A file that fails to load just stays silent
  function load(file) {
    loading[file] ??= fetch(`${base}/${file}`)
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => (buffers[file] = buffer))
      .catch(() => {});
    return loading[file];
  }
  files.forEach((file) => load(file).then(onLoad));

  // mp3 encoders pad both ends with silence; looping over it would be heard as a gap
  function loopBounds(buffer) {
    const data = buffer.getChannelData(0);
    let first = 0;
    let last = data.length - 1;
    while (first < last && Math.abs(data[first]) < SILENCE) first++;
    while (last > first && Math.abs(data[last]) < SILENCE) last--;
    return [first / buffer.sampleRate, (last + 1) / buffer.sampleRate];
  }

  function stopMusic() {
    wantedMusic = null;
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
    /** Loop `file`, replacing whatever other music was playing. Music already on is left to run. */
    async playMusic(file) {
      if (wantedMusic === file) return;
      stopMusic();
      wantedMusic = file;
      await load(file);
      // Stopped or switched while the file was still loading
      if (wantedMusic !== file || music || !buffers[file]) return;
      const gain = ctx.createGain();
      gain.gain.value = MUSIC_VOLUME;
      gain.connect(master);
      music = ctx.createBufferSource();
      music.buffer = buffers[file];
      music.loop = true;
      [music.loopStart, music.loopEnd] = loopBounds(buffers[file]);
      music.connect(gain);
      music.start(0, music.loopStart);
    },
    stopMusic,
    setMuted: (muted) => (master.gain.value = muted ? 0 : 1),
    // Browsers only let audio start from a tap, so `resume` is called from the start button
    resume: () => ctx.resume(),
    suspend: () => ctx.suspend(),
    close: () => ctx.close(),
  };
}
