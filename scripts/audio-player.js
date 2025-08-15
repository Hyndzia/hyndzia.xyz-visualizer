document.addEventListener('DOMContentLoaded', () => {
  const player = new Plyr('#audioPlayer', {
    controls: [
        'play', 
        'progress',    
        //'current-time',
        'duration',    
        'volume',      
        'mute',        
        'settings',    
        'fullscreen'   
    ],
    autoplay: false,
    invertTime: false 
});
});

window.audio = document.getElementById('audioPlayer');
window.status = document.getElementById('status');

function displayStatus(message, duration) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
	    if (typeof duration === 'number') {
        setTimeout(() => {
            statusElement.textContent = '';
        }, duration);
    }
}
function displayStatusHTML(message, duration) {
    const statusEl = document.getElementById('status');
    statusEl.innerHTML = message; 
    statusEl.style.display = 'block';

    if (duration) {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, duration);
    }
}
(function(){
	
  const audio = document.getElementById('audioPlayer');
  const canvas = document.getElementById('vis');
  const ctx = canvas.getContext('2d');

  const barsCheckbox = document.getElementById('bars');
  const waveCheckbox = document.getElementById('wave');
  const circularWaveCheckbox = document.getElementById('circularWave');
  window.isRadioPlaying = false;
  window.isPlaylistPlaying = false;
async function playRadio() {
    const url = "https://radio.shinpu.top/radio.ogg";
    window.audio.src = url;
    window.audio.volume = 0.65;

    // Stworzenie AudioContext po interakcji
    if (!window.audioCtx) {
        window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Wznowienie AudioContext, jeśli wstrzymany
    if (window.audioCtx.state === 'suspended') {
        await window.audioCtx.resume();
    }

    // Podłączenie analysera dopiero teraz
    if (!window.source) {
        window.source = window.audioCtx.createMediaElementSource(window.audio);
        window.analyser = window.audioCtx.createAnalyser();
        window.source.connect(window.analyser);
        window.analyser.connect(window.audioCtx.destination);
    }

    try {
        await window.audio.play();
        window.isRadioPlaying = true;
        window.isPlaylistPlaying = false;
        displayStatus("Now playing: Hikineet radio!", 5000);
    } catch (e) {
        displayStatus("Hikineet radio is offline... Try adding a mp3 file!", 5000);
    }
}
  
	async function playRadio() {
    let url = "https://radio.shinpu.top/radio.ogg";
	
	const ua = navigator.userAgent.toLowerCase(); 
	const isIntelMac = ua.includes("intel mac os x");

    if (isIntelMac) {
        url = "https://radio.shinpu.top/radio";
    }
    window.audio.src = url;
    window.audio.volume = 0.65;
	
    if (window.audioCtx.state === 'suspended') {
        await window.audioCtx.resume();
    }
    connectAudio();

    try {
        await window.audio.play();
        window.isRadioPlaying = true;
        window.isPlaylistPlaying = false;
        displayStatus("Now playing: Hikineet radio!", 5000);
    } catch (e) {
        displayStatus("Hikineet radio is offline... Try adding a mp3 file!", 5000);
    }
}
	async function checkRadio(){
		const url = "https://radio.shinpu.top/radio.ogg";
		try {
			const res = await fetch(url, {method: 'GET'});
			if (!res.ok) throw new Error('Radio offline');
			await playRadio();
			//applySawModulation();
			//applyDelay(0.17, 0.1);
			//applyBitcrusher(16, 0.1);
			//applyBassBoost();
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

async function playFile(src) {
    if (!src) {
        displayStatus('No files uploaded.', 5000);
        window.audio.src = '';
        return;
    }

    window.audio.src = src;
    window.audio.volume = 0.65;

    if (window.audioCtx.state === 'suspended') {
        await window.audioCtx.resume();
    }
    connectAudio();

    try {
        await window.audio.play();
        window.isRadioPlaying = false;
        window.isPlaylistPlaying = true;
        displayStatus('Now playing: ' + src.split('/').pop());
    } catch (e) {
        displayStatus('Unable to play audio automatically. Click to start.', 5000);
    }
}

let lastTitle = "";
let flag = 0;

async function updateRadioTrack() {
	if (!window.isRadioPlaying) {
		return; 
	}
    try {
        const res = await fetch('https://radio.shinpu.top/status-json.xsl');
        const data = await res.json();

		const sizeInBytes = new TextEncoder().encode(JSON.stringify(data)).length;
		console.log("Przybliżony rozmiar JSON w pamięci:", sizeInBytes, "bajtów");

        let mount = data.icestats.source;
        if (Array.isArray(mount)) {
            mount = mount.find(m => m.listenurl.endsWith('/radio.ogg'));
        }

        const title = mount && mount.title ? mount.title : "No info";
		
		if (!window.audio || window.audio.paused) {
            return; 
        }
		
         if (title !== lastTitle) {
			lastTitle = title;
			displayStatusHTML('Now playing: [ <a href="https://radio.shinpu.top" target="_blank">radio.shinpu.top</a> ] - ' + title, 5000000);
			}
    } catch (err) {
        console.error("Failed to fetch Icecast metadata:", err);
    }
}

updateRadioTrack();

setInterval(updateRadioTrack, 10000);


async function playNext() {
    if (window.currentFile) {
        // delete previous file from backend
        await fetch('/visualizer/remove/' + encodeURIComponent(window.currentFile), { method: 'POST' });
    }

    //request data from /next
    const res = await fetch('/visualizer/next');
    const data = await res.json();
    updatePlaylistUI(data.playlist);

    if (data.file) {
        await playFile(data.file); 
    } else {
        window.audio.src = '';
        window.currentFile = null;
        displayStatus('No files uploaded.', 5000);
    }
}

window.playFile = playFile;
  // Resume audio context on user gesture (autoplay policy)
  function resumeAudioCtx() {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    document.removeEventListener('click', resumeAudioCtx);
  }
  document.addEventListener('click', resumeAudioCtx);

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
    if (nextData.file != window.currentFile) {
        await playFile(nextData.file);
        window.currentFile = nextData.file;
        displayStatus("Now playing: " + nextData.file.split('/').pop());
    } else {
        window.currentFile = null;
        window.audio.pause();
        window.audio.currentTime = 0;
        window.audio.src = '';  
        window.audio.load();    
        displayStatus('Playlist finished.', 5000);
    }

    if (previousFile) {
        const fileName = previousFile.split('/').pop();
        fetch('/visualizer/remove/' + encodeURIComponent(fileName), { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    window.updatePlaylistUI(data.playlist);
                }
            });
    }
});

function applySawModulation() {
    if (!window.audioCtx) {
        window.audioCtx = new AudioContext();
    }

    if (!window.source) {
        window.source = window.audioCtx.createMediaElementSource(window.audio);
    }

    // Gain node for final volume
    const volumeGain = window.audioCtx.createGain();
    volumeGain.gain.value = 0.5; // Base volume

    const modulationGain = window.audioCtx.createGain();
    const oscillator = window.audioCtx.createOscillator();
	
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 50; // Hz, modulation speed

    // Map oscillator output (-1 to +1) to a usable gain range (0 to 1)
    const modDepth = window.audioCtx.createGain();
    modDepth.gain.value = 1.0; // Depth of modulation
    oscillator.connect(modDepth).connect(modulationGain.gain);
    window.source.connect(modulationGain).connect(volumeGain).connect(window.audioCtx.destination);

    oscillator.start();
}

function applyBassBoost() {
    if (!window.audioCtx) {
        window.audioCtx = new AudioContext();
    }
    if (!window.source) {
        window.source = window.audioCtx.createMediaElementSource(window.audio);
    }
    if (window.bassApplied) return; // 

    const bassFilter = window.audioCtx.createBiquadFilter();
    bassFilter.type = "lowshelf";
    bassFilter.frequency.value = 200; // under 200 Hz
    bassFilter.gain.value = 7; // dB values

    window.source.connect(bassFilter).connect(window.audioCtx.destination);
    window.bassApplied = true;
}

function applyDelay(time = 0.3, feedbackGain = 0.4) {
    if (!window.audioCtx) {
        window.audioCtx = new AudioContext();
    }
    if (!window.source) {
        window.source = window.audioCtx.createMediaElementSource(window.audio);
    }
    if (window.delayApplied) return;

    const delayNode = window.audioCtx.createDelay();
    delayNode.delayTime.value = time; // delay time in seconds

    const feedback = window.audioCtx.createGain();
    feedback.gain.value = feedbackGain; // feedback recieved

    // Połączenie: input -> delay -> feedback -> delay -> output
    delayNode.connect(feedback);
    feedback.connect(delayNode);

    window.source.connect(delayNode);
    delayNode.connect(window.audioCtx.destination);
	
    // normal track played at the same time
    window.source.connect(window.audioCtx.destination);

    window.delayApplied = true;
}

function applyPhaser() {
    if (!window.audioCtx) {
        window.audioCtx = new AudioContext();
    }
    if (!window.source) {
        window.source = window.audioCtx.createMediaElementSource(window.audio);
    }
    if (window.phaserApplied) return;

    const filters = [];
    for (let i = 0; i < 4; i++) {
        const filter = window.audioCtx.createBiquadFilter();
        filter.type = 'allpass';
        filter.frequency.value = 1000 * (i + 1); // różne pasma
        filters.push(filter);
    }

    for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
    }

    const lfo = window.audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.5; // waving

    const lfoGain = window.audioCtx.createGain();
    lfoGain.gain.value = 500; //  (Hz)

    lfo.connect(lfoGain);
    lfoGain.connect(filters[0].frequency); 

    window.source.connect(filters[0]);
    filters[filters.length - 1].connect(window.audioCtx.destination);

    lfo.start();

    window.phaserApplied = true;
}

function applyBitcrusher(bits = 4, normFreq = 0.05) {
    if (!window.audioCtx) {
        window.audioCtx = new AudioContext();
    }

    const audioCtx = window.audioCtx;

    if (!window.source) {
        window.source = audioCtx.createMediaElementSource(window.audio);
    }
		//delete if already exists
    if (window.bitcrusherNode) {
        window.bitcrusherNode.disconnect();
    }

    const bufferSize = 4096;
    const node = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    const step = Math.pow(0.5, bits);
    let phaser = 0;
    let last = 0;

    node.onaudioprocess = function(e) {
        const input = e.inputBuffer.getChannelData(0);
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < input.length; i++) {
            phaser += normFreq;
            if (phaser >= 1.0) {
                phaser -= 1.0;
                last = step * Math.floor(input[i] / step + 0.5);
            }
            output[i] = last;
        }
    };

    window.bitcrusherNode = node;
    // source -> bitcrusher -> analyser -> destination
    window.source.disconnect();
    window.source.connect(window.bitcrusherNode);
    window.bitcrusherNode.connect(window.analyser);
    window.analyser.connect(audioCtx.destination);
}

})();