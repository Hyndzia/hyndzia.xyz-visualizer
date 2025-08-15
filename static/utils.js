document.addEventListener('DOMContentLoaded', () => {
  const player = new Plyr('#audioPlayer');
});

(function(){
  const audio = document.getElementById('audioPlayer');
  const canvas = document.getElementById('vis');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');
  const barsCheckbox = document.getElementById('bars');
  const waveCheckbox = document.getElementById('wave');
  
  audio.volume = 0.4;  // ściszamy dźwięk na stronie, ale nie wpływa to na analizę



  // Resize canvas
  function resize(){
    canvas.width = Math.min(window.innerWidth * 0.95, 1100);
    canvas.height = 420;
  }
  window.addEventListener('resize', resize);
  resize();

  // Audio context and analyser
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContext();
  let source;
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.8;

  // Connect audio element to audio context
  function connectAudio() {
    if (!source) {
      try {
        source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
      } catch (e) {
        console.error('Could not create MediaElementSource:', e);
      }
    }
  }
  // Resume audio context on user gesture (autoplay policy)
  function resumeAudioCtx() {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    document.removeEventListener('click', resumeAudioCtx);
  }
  document.addEventListener('click', resumeAudioCtx);

  // Draw visualizer
  const bufferLength = analyser.frequencyBinCount;
  const freqData = new Uint8Array(bufferLength);
  const timeData = new Uint8Array(bufferLength);

  function draw() {
    requestAnimationFrame(draw);

    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    if (waveCheckbox.checked) {
      // waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#61dafb';
      ctx.beginPath();
      const step = Math.max(1, Math.floor(bufferLength / w));
      for(let i = 0; i < w; i++) {
        const idx = Math.floor(i * bufferLength / w);
        const v = (timeData[idx] - 128) / 128; // -1..1
        const y = h/2 + v * (h/3);
        if(i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }
      ctx.stroke();
    }

    if (barsCheckbox.checked) {
      // bars
      const barCount = Math.min(128, bufferLength);
      const barWidth = w / barCount;
      for(let i = 0; i < barCount; i++) {
        const value = freqData[i] / 255; // 0..1
        const barHeight = value * h;
        const x = i * barWidth;
        const hue = i / barCount * 360;
        ctx.fillStyle = `hsl(${hue} 80% 60%)`;
        ctx.fillRect(x, h - barHeight, barWidth - 1, barHeight);
      }
    }
  }

  draw();

  // Backend playlist logic (jak wcześniej)
  async function fetchCurrent() {
    const res = await fetch('/current');
    const data = await res.json();
    return data.file;
  }

  async function fetchNext() {
    const res = await fetch('/next');
    const data = await res.json();
    return data.file;
  }

  async function playFile(src) {
    if (!src) {
      status.textContent = 'No files uploaded.';
      audio.src = '';
      return;
    }
    status.textContent = 'Now playing: ' + src.split('/').pop();
    audio.src = src;
    connectAudio();
    try {
      await audio.play();
    } catch(e) {
      console.warn('Play error:', e);
    }
  }

  fetchCurrent().then(playFile);

  audio.addEventListener('ended', async () => {
    const res = await fetch('/next');
    const data = await res.json();
    updatePlaylistUI(data.playlist);

    if (data.file) {
        playFile(data.file);
    } else {
        status.textContent = 'No files uploaded.';
        audio.src = '';
    }
});

})();