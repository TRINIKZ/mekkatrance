// Read the soundtrack locally. Tab capture is opt-in for embedded players.
export function createSoundMeter(audio, canvas, button, status) {
  const paint = canvas.getContext('2d');
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const samples = new Float32Array(1024);
  let engine, analyser, fileSource, input, capture;
  let mode = null, revision = 0, frame = 0, lastPaint = 0;
  const devices = navigator.mediaDevices;
  let handle;
  if (devices?.setCaptureHandleConfig && window.top === window && window.isSecureContext) {
    try {
      const token = crypto.randomUUID();
      devices.setCaptureHandleConfig({ handle: token, permittedOrigins: [location.origin] });
      handle = token;
    } catch { /* Some browsers expose only part of the capture API. */ }
  }

  function flat() {
    paint.clearRect(0, 0, canvas.width, canvas.height);
    paint.fillStyle = '#777c82';
    paint.fillRect(0, canvas.height / 2, canvas.width, 1);
  }

  function stopDrawing() {
    cancelAnimationFrame(frame);
    frame = 0;
    flat();
  }

  function draw(now) {
    frame = 0;
    if (!input || document.hidden || (mode === 'file' && audio.paused)) return flat();
    if (now - lastPaint >= 32) {
      lastPaint = now;
      analyser.getFloatTimeDomainData(samples);
      const w = canvas.width, h = canvas.height;
      paint.clearRect(0, 0, w, h);
      paint.beginPath();
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        // Compress the display range so a quiet table mix still has a readable shape.
        const amplitude = Math.sign(sample) * Math.min(1, Math.sqrt(Math.abs(sample)) * 1.5);
        const x = w * i / (samples.length - 1);
        const y = h * (.5 - .47 * amplitude);
        if (i === 0) paint.moveTo(x, y);
        else paint.lineTo(x, y);
      }
      paint.strokeStyle = '#ff4165';
      paint.lineWidth = 2;
      paint.stroke();
    }
    if (!reducedMotion.matches) frame = requestAnimationFrame(draw);
  }

  function refresh() {
    stopDrawing();
    if (input && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function prepare() {
    if (!engine) {
      engine = new AudioEngine();
      analyser = engine.createAnalyser();
      analyser.fftSize = samples.length;
    }
    return engine.state === 'running' ? Promise.resolve() : engine.resume();
  }

  function detach() {
    if (input) input.disconnect(analyser);
    input = null;
    capture?.getTracks().forEach(track => track.stop());
    capture = null;
    stopDrawing();
  }

  function controls() {
    button.disabled = false;
    button.hidden = !AudioEngine || !mode || (mode === 'file' && Boolean(input)) ||
      (mode === 'tab' && !devices?.getDisplayMedia);
    button.textContent = capture ? 'Desativar ondas' : mode === 'file' ? 'Ativar ondas' : 'Ativar ondas da aba';
    canvas.hidden = !input;
  }

  async function listenToFile() {
    if (mode !== 'file' || !AudioEngine) return;
    const current = revision;
    try {
      await prepare();
      if (current !== revision || mode !== 'file' || input) return;
      if (!fileSource) {
        fileSource = engine.createMediaElementSource(audio);
        fileSource.connect(engine.destination);
      }
      input = fileSource;
      input.connect(analyser);
      status.textContent = '';
      controls();
      refresh();
    } catch {
      if (current === revision) status.textContent = 'Ative as ondas para visualizar o som.';
    }
  }

  async function listenToTab() {
    const current = revision;
    let stream;
    button.disabled = true;
    status.textContent = 'Escolha esta aba e marque a opção de compartilhar o áudio.';
    try {
      const ready = prepare().then(() => true, () => false);
      const selection = devices.getDisplayMedia({
        video: { displaySurface: 'browser' }, audio: { suppressLocalAudioPlayback: false, restrictOwnAudio: false },
        preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'exclude', surfaceSwitching: 'exclude'
      }).then(result => {
        stream = result;
        return result;
      });
      await selection;
      if (current !== revision) return;
      const video = stream.getVideoTracks()[0];
      const sound = stream.getAudioTracks()[0];
      if (!sound || video?.getSettings().displaySurface !== 'browser' ||
          (handle && video.getCaptureHandle && video.getCaptureHandle()?.handle !== handle)) {
        status.textContent = 'Selecione a aba da mesa com o áudio habilitado.';
        return;
      }
      // Discard the required video track immediately; only audio reaches the analyser.
      video.stop();
      if (!await ready) throw new Error('Web Audio indisponível.');
      if (current !== revision || sound.readyState !== 'live') return;
      input = engine.createMediaStreamSource(new MediaStream([sound]));
      input.connect(analyser);
      capture = stream;
      sound.addEventListener('ended', () => {
        if (capture === stream) { detach(); controls(); }
      }, { once: true });
      status.textContent = '';
      refresh();
    } catch {
      if (current === revision) status.textContent = 'Para ver as ondas, compartilhe o áudio desta aba.';
    } finally {
      if (stream !== capture) stream?.getTracks().forEach(track => track.stop());
      if (current === revision) controls();
    }
  }

  button.addEventListener('click', () => {
    if (capture) { detach(); controls(); }
    else if (mode === 'file') listenToFile();
    else if (mode === 'tab') listenToTab();
  });
  audio.addEventListener('playing', () => { listenToFile(); refresh(); });
  audio.addEventListener('pause', () => { if (mode === 'file') stopDrawing(); });
  document.addEventListener('visibilitychange', refresh);
  reducedMotion.addEventListener('change', refresh);
  window.addEventListener('pagehide', () => { revision++; detach(); controls(); });

  return {
    setTrack(next) {
      revision++;
      detach();
      mode = next;
      status.textContent = next === 'tab' && (!devices?.getDisplayMedia || !AudioEngine)
        ? 'Ondas da aba indisponíveis neste navegador.' : '';
      controls();
    }
  };
}
