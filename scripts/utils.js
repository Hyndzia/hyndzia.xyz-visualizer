
window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
window.analyser = window.audioCtx.createAnalyser();
window.analyser.fftSize = 4096;
window.analyser.smoothingTimeConstant = 0.8;
window.source = null;

document.addEventListener('DOMContentLoaded', () => {
  const player = new Plyr('#audioPlayer');
  
});

window.audio = document.getElementById('audioPlayer');
window.status = document.getElementById('status');

function displayStatus(message, duration = 3000) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
	setTimeout(() => {
        statusElement.textContent = '';
    }, duration);
}

(function(){
	
  const audio = document.getElementById('audioPlayer');
  const canvas = document.getElementById('vis');
  const ctx = canvas.getContext('2d');

  const barsCheckbox = document.getElementById('bars');
  const waveCheckbox = document.getElementById('wave');
  const circularWaveCheckbox = document.getElementById('circularWave');
  const waveColor = "#A30000";
  const circularColor = "#23C91A";
  

	async function playRadio(){
	//const url = "https://shinpu.top/publicradio/radio";
	const url = "https://radio.shinpu.top/radio.ogg"; //switch to ogg
	window.audio.src = url;
	window.audio.volume = 0.65;
	if (window.audioCtx.state == 'suspended'){
		await window.audioCtx.resume();
	}
	connectAudio();
	try {
		await window.audio.play();
		//displayStatus("Now playing: Hikineet radio!");
		sessionStorage.setItem("radioPlayed", "true");
	} catch(e) {
		displayStatus("Hikineet radio is offline... Try adding a mp3 file!")
	}
}

	async function checkRadio(){
		const url = "https://radio.shinpu.top/radio.ogg";
		try {
			const res = await fetch(url, {method: 'GET'});
			if (!res.ok) throw new Error('Radio offline');
			await playRadio();
		} catch (e) {
			displayStatus("Hikineet radio is offline... try adding some mp3 files!", 5000);
		}
	}
	checkRadio();
	
  // Resize canvas
  function resize(){
    canvas.width = Math.min(window.innerWidth * 0.95, 1100);
    canvas.height = 420;
  }
  window.addEventListener('resize', resize);
  resize();

  // Connect audio element to audio context
 function connectAudio() {
    if (!window.source) {
        try {
            window.source = window.audioCtx.createMediaElementSource(window.audio);
            window.source.connect(window.analyser);
            window.analyser.connect(window.audioCtx.destination);
        } catch (e) {
            console.error("Error creating MediaElementSource:", e);
        }
    }
}

// Funkcja odtwarzania pliku z automatycznym wznowieniem AudioContext
async function playFile(src) {
    if (!src) {
        displayStatus('No files uploaded.');
        window.audio.src = '';
        return;
    }

    window.audio.src = src;
    window.audio.volume = 0.65;

    // Wznowienie AudioContext (Chrome autoplay policy)
    if (window.audioCtx.state === 'suspended') {
        await window.audioCtx.resume();
    }

    connectAudio();

    try {
        await window.audio.play();
    } catch (e) {
        console.warn('Play error:', e);
        displayStatus('Unable to play audio automatically. Click to start.');
        return;
    }

    displayStatus('Now playing: ' + src.split('/').pop());
    window.currentFile = src; // zapamiętujemy aktualny plik
}

// Odtwarzanie następnego utworu i usuwanie poprzedniego
async function playNext() {
    if (window.currentFile) {
        // Usuń poprzedni utwór z backendu
        await fetch('/visualizer/remove/' + encodeURIComponent(window.currentFile), { method: 'POST' });
    }

    // Pobierz następny plik
    const res = await fetch('/visualizer/next');
    const data = await res.json();
    updatePlaylistUI(data.playlist);

    if (data.file) {
        await playFile(data.file);  // <- używamy await
    } else {
        window.audio.src = '';
        window.currentFile = null;
        displayStatus('No files uploaded.');
    }
}

// eksport do innych skryptów
window.playFile = playFile;


  // Resume audio context on user gesture (autoplay policy)
  function resumeAudioCtx() {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    document.removeEventListener('click', resumeAudioCtx);
  }
  document.addEventListener('click', resumeAudioCtx);


// 1. Dynamiczna jasność (Brightness)
function getBarColorBrightness(value, hue) {
    const brightness = 40 + value * 60; // 40%..100%
    return `hsl(${hue} 80% ${brightness}%)`;
}

// 2. Dynamiczne nasycenie (Saturation)
function getBarColorSaturation(value, hue) {
    const saturation = 40 + value * 60; // 40%..100%
    return `hsl(${hue} ${saturation}% 60%)`;
}

// 3. Gradient kolorów
function getBarColorGradient(ctx, x, h, barHeight) {
    const grad = ctx.createLinearGradient(x, h, x, h - barHeight);
    grad.addColorStop(0, 'red');     // dół
    grad.addColorStop(1, 'yellow');  // góra
    return grad;
}

// 4. Pulsująca tęcza (Hue pulsacja w czasie)
function getBarColorPulse(value, hue) {
    const hueOffset = (Date.now() / 20) % 360;
    return `hsl(${(hue + hueOffset) % 360} 80% 60%)`;
}

// 5. Kolor wg wartości (Low / Mid / High)
function getBarColorByValue(value) {
    if (value < 0.3) return '#00f';      // niebieski niskie
    else if (value < 0.6) return '#0f0'; // zielony średnie
    else return '#f00';                   // czerwony wysokie
}

  // Draw visualizer
  const bufferLength = analyser.frequencyBinCount;
  const freqData = new Uint8Array(bufferLength);
  const timeData = new Uint8Array(bufferLength);
  const previousHeights = new Array(analyser.frequencyBinCount).fill(0);
  const barEffects = ['brightness', 'saturation', 'gradient', 'pulse', 'value'];
  const barColorMode = barEffects[Math.floor(Math.random() * barEffects.length)];
  console.log('Bars effect: ', barColorMode);
  

  function draw() {
    requestAnimationFrame(draw);

    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;


	if (barsCheckbox.checked) {
        const barCount = Math.min(128, bufferLength);
        const barWidth = w / barCount;
        const previousHeights = new Array(barCount).fill(0);

        for (let i = 0; i < barCount; i++) {
            const value = freqData[i] / 255;
            const targetHeight = value * h * 3;

            // płynna interpolacja
            if (targetHeight > previousHeights[i]) {
                previousHeights[i] += (targetHeight - previousHeights[i]) * 0.2;
            } else {
                previousHeights[i] *= 0.9;
            }

            const x = i * barWidth;
            const y = h - previousHeights[i];
            const hue = i / barCount * 360;
            let color;
			switch(barColorMode) {
                case 'brightness': color = getBarColorBrightness(value, hue); break;
                case 'saturation': color = getBarColorSaturation(value, hue); break;
                case 'gradient': color = getBarColorGradient(ctx, x, h, previousHeights[i]); break;
                case 'pulse': color = getBarColorPulse(value, hue); break;
                case 'value': color = getBarColorByValue(value); break;
                default: color = `hsl(${hue} 80% 60%)`;
            }

            ctx.fillStyle = color;
            ctx.fillRect(x, y, barWidth - 1, previousHeights[i]);
        }
    }
	
    if (waveCheckbox.checked) {
      // waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = waveColor;
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

	if (circularWaveCheckbox.checked) {
        const centerX = w / 2;
        const centerY = h / 2;
		const baseRadius = 50;
		
		//const pulse = Math.sin(Date.now()/500);
		let sum = 0;
		for (let i = 0; i < bufferLength; i++) {
			sum += freqData[i];
		}
		const avg = sum / bufferLength;
		//const scale = 1 + pulse * 0.2; scale for pulsing (breathing)
	    const scale = 1 + (avg*(2)/255)*1.3;
        ctx.beginPath();
        for (let i = 0; i < w; i++) {
            const idx = Math.floor(i * bufferLength / w);
            const v = (timeData[idx] - 128) / 128;
            const angle = (i / w) * Math.PI * 2;
            //const r = 100 + v * 50;
			const r = (baseRadius + v * 50) * scale;
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = circularColor;
        ctx.stroke();
    }
  }

  draw();

  // Backend playlist logic
  async function fetchCurrent() {
    const res = await fetch('/visualizer/current');
    const data = await res.json();
    return data.file;
  }

  async function fetchNext() {
    const res = await fetch('/visualizer/next');
    const data = await res.json();
    return data.file;
  }


audio.addEventListener('ended', async () => {
    const previousFile = currentFile;
    const nextRes = await fetch('/visualizer/next');
    const nextData = await nextRes.json();

    if (nextData.file && nextData.file != previousFile) {
        await playFile(nextData.file);
    } else {
        window.currentFile = null;
        window.audio.pause();       
        window.audio.currentTime = 0; 
        window.audio.src = '';      
        displayStatus('Playlist finished.');
    }

    // Usuwanie poprzedniego - tylko nazwa pliku
    if (previousFile) {
        const fileName = previousFile.split('/').pop(); // LUVORATORRRRRY.mp3
        fetch('/visualizer/remove/' + encodeURIComponent(fileName), { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
					window.updatePlaylistUI(data.playlist);
                }
            });
    }
});

})();