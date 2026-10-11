(() => {
  const video = document.getElementById("backgroundVideo");
  const canvas = document.getElementById("videoVisualizer");
  if (!video || !canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let audioContext;
  let analyser;
  let source;
  let frequencyData;
  let width = 0;
  let height = 0;
  let running = true;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function connectAudio() {
    if (audioContext) {
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      audioContext = new AudioContextClass();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      source = audioContext.createMediaElementSource(video);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
      audioContext.resume().catch(() => {});
    } catch {
      analyser = null;
      frequencyData = null;
    }
  }

  function draw() {
    if (!running) return;
    if (!width || !height) resize();

    ctx.clearRect(0, 0, width, height);
    const count = 48;
    const gap = Math.max(2, width * 0.012);
    const barWidth = Math.max(1, (width - gap * (count - 1)) / count);
    const centerY = height / 2;
    const maxHeight = height * 0.32;
    const isPlaying = !video.paused && !video.ended;
    if (analyser && frequencyData) analyser.getByteFrequencyData(frequencyData);
    const averageEnergy = frequencyData && analyser
      ? frequencyData.reduce((sum, value) => sum + value, 0) / frequencyData.length
      : 0;
    const useAudio = Boolean(frequencyData && analyser && averageEnergy > 1.5);

    for (let i = 0; i < count; i += 1) {
      let level;
      if (useAudio) {
        const usableBins = Math.max(2, Math.floor(frequencyData.length * 0.9));
        const start = Math.max(1, Math.floor(Math.pow(usableBins, i / count)));
        const end = Math.min(usableBins, Math.max(start + 1, Math.floor(Math.pow(usableBins, (i + 1) / count))));
        let total = 0;
        let samples = 0;
        for (let bin = start; bin < end; bin += 1) {
          total += frequencyData[bin];
          samples += 1;
        }
        level = Math.pow((total / Math.max(1, samples)) / 255, 0.82);
      } else {
        const time = video.currentTime || 0;
        level = isPlaying
          ? 0.12 + 0.58 * Math.abs(Math.sin(time * 2.4 + i * 0.31) * Math.cos(time * 1.1 + i * 0.17))
          : 0.035 + 0.025 * Math.sin(i * 0.6);
      }

      const barHeight = Math.max(3, (0.025 + level * 0.58) * maxHeight * (isPlaying ? 1 : 0.18));
      const x = i * (barWidth + gap);
      const y = centerY - barHeight;
      ctx.shadowBlur = isPlaying ? 3 + level * 5 : 0;
      ctx.shadowColor = "rgba(255,255,255,.7)";
      ctx.fillStyle = "rgba(255,255,255," + (0.22 + level * 0.38).toFixed(3) + ")";
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight * 2, Math.min(barWidth / 2, 4));
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    requestAnimationFrame(draw);
  }

  document.addEventListener("pointerdown", connectAudio, { once: true });
  video.addEventListener("play", connectAudio);
  window.addEventListener("resize", resize);
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  resize();
  draw();
})();