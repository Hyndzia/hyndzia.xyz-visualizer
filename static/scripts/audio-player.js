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
    checkIsApp();
	
	fetch('/visualizer/playlist')
        .then(res => res.json())
        .then(data => {
            updatePlaylistUI(data.playlist || []);
        });
});

window.audio = document.getElementById('audioPlayer');
window.status = document.getElementById('status');

function checkIsApp(){
	const returnBtn = document.querySelector('.back-link');
    const ua = navigator.userAgent.toLowerCase();
    const isApp = ua.includes('visualizerapp'); 
	console.log(isApp);
	console.log(returnBtn);
	
    if (isApp) {
        returnBtn.style.display = 'none';
    }
	
	 if (!isApp) {
        const script = document.createElement('script');
        script.src = "https://hyndzia.xyz/scripts/rain.js";
        document.body.appendChild(script);
    }
}

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
	
	if (typeof duration === 'number') {
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
        displayStatus("Reconnecting to the radio...", 5000);
    }
}
	let isRecon = true;
	async function checkRadio(){
		const url = "https://radio.shinpu.top/radio.ogg";
		try {
			const res = await fetch(url, {method: 'GET'});
			if (!res.ok) throw new Error('Radio offline');
			await playRadio();

		} catch (e) {
			if(isRecon){
				displayStatus("Reconnecting to the hikineet radio network...", 2000);
			} else {
				isRecon = false;
				displayStatus("Hikineet radio is offline... try adding some mp3 files!", 5000);
			}
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
			displayStatusHTML('Now playing: 「 <a href="https://radio.shinpu.top" target="_blank">radio.shinpu.top</a> 」 - ' + title);
			}
    } catch (err) {
        console.error("Failed to fetch Icecast metadata:", err);
		if (lastTitle) {
            displayStatusHTML(
                'Now playing: 「 <a href="https://radio.shinpu.top" target="_blank">radio.shinpu.top</a> 」 - ' + lastTitle
            );
		}
    }
}

updateRadioTrack();

setInterval(updateRadioTrack, 5000);


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
		setTimeout(() => {
        displayStatus('Reconnecting to the radio...');
    }, 2000);
		setTimeout(() => {
        playRadio();
    }, 5000);
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

function applySquareModulation() {
    if (!window.audioCtx) {
        window.audioCtx = new AudioContext();
    }

    if (!window.source) {
        window.source = window.audioCtx.createMediaElementSource(window.audio);
    }

    const volumeGain = window.audioCtx.createGain();
    volumeGain.gain.value = 0.5; // Base volume

    const modulationGain = window.audioCtx.createGain();
    const oscillator = window.audioCtx.createOscillator();

    oscillator.type = 'square'; // 
    oscillator.frequency.value = 50; // Hz, modulation speed

    // Map oscillator output (-1 to +1) to usable gain range (0 to 1)
    const modDepth = window.audioCtx.createGain();
    modDepth.gain.value = 1.0; // Depth of modulation

    oscillator.connect(modDepth).connect(modulationGain.gain);
    window.source.connect(modulationGain).connect(volumeGain).connect(window.audioCtx.destination);

    oscillator.start();
}


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


function applyDelay(time = 0.2, feedbackGain = 0.8) {
    if (!window.audioCtx) window.audioCtx = new AudioContext();
    if (!window.source) window.source = window.audioCtx.createMediaElementSource(window.audio);

    const delayNode = window.audioCtx.createDelay();
    delayNode.delayTime.value = time;

    const feedback = window.audioCtx.createGain();
    feedback.gain.value = feedbackGain;

    delayNode.connect(feedback);
    feedback.connect(delayNode);

    return { delayNode, feedback };
}


function applyPhaser() {
    if (!window.audioCtx) {
        window.audioCtx = new AudioContext();
    }
    if (!window.source) {
        window.source = window.audioCtx.createMediaElementSource(window.audio);
    }

    const filters = [];
    for (let i = 0; i < 4; i++) {
        const filter = window.audioCtx.createBiquadFilter();
        filter.type = 'allpass';
        filter.frequency.value = 1000 * (i + 1);
        filters.push(filter);
    }

    for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
    }

    const lfo = window.audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.5;

    const lfoGain = window.audioCtx.createGain();
    lfoGain.gain.value = 500;

    lfo.connect(lfoGain);
    lfoGain.connect(filters[0].frequency);

    window.source.connect(filters[0]);
    filters[filters.length - 1].connect(window.audioCtx.destination);

    lfo.start();
	
    return { filters, lfo, lfoGain };
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
	
	return node;
}

let bitcrusherNode = null; 

document.getElementById('bitcrusherBtn').addEventListener('click', () => {
    if (!bitcrusherNode) {
        bitcrusherNode = applyBitcrusher(16, 0.1);
        displayStatus('Bitcrusher włączony', 2000);
        document.getElementById('bitcrusherBtn').style.backgroundColor = 'green';
    } else {
        // Turn off effect: reconnect source directly to analyser -> destination
        window.bitcrusherNode.disconnect();
        window.source.disconnect();
        window.source.connect(window.analyser);
        window.analyser.connect(window.audioCtx.destination);

        bitcrusherNode = null;
        displayStatus('Bitcrusher wyłączony', 2000);
        document.getElementById('bitcrusherBtn').style.backgroundColor = '';
    }
});

let phaserNode = null;

document.getElementById('phaserBtn').addEventListener('click', () => {
    const btn = document.getElementById('phaserBtn');

    if (!phaserNode) {
        phaserNode = applyPhaser(); 
        displayStatus('Phaser włączony', 2000);
        btn.style.backgroundColor = 'green';
    } else {
        phaserNode.lfo.stop();
        phaserNode.filters.forEach(f => f.disconnect());
        window.source.disconnect();
        window.source.connect(window.analyser);
        window.analyser.connect(window.audioCtx.destination);

        phaserNode = null;
        displayStatus('Phaser wyłączony', 2000);
        btn.style.backgroundColor = '';
    }
});

let delayEffect = null;

document.getElementById('delayBtn').addEventListener('click', () => {
    const btn = document.getElementById('delayBtn');

    if (!delayEffect) {
        delayEffect = applyDelay();
        window.source.disconnect();
        window.source.connect(window.analyser);
        window.analyser.disconnect();
        window.analyser.connect(delayEffect.delayNode).connect(window.audioCtx.destination);

        displayStatus('Delay włączony', 2000);
        btn.style.backgroundColor = 'green';
    } else {
        window.analyser.disconnect();
        window.analyser.connect(window.audioCtx.destination);

        if (delayEffect.delayNode) delayEffect.delayNode.disconnect();
        if (delayEffect.feedback) delayEffect.feedback.disconnect();

        delayEffect = null;
        displayStatus('Delay wyłączony', 2000);
        btn.style.backgroundColor = '';
    }
});

let bassNode = null;
let bassGain = null;

document.getElementById('bassBoostBtn').addEventListener('click', () => {
    const btn = document.getElementById('bassBoostBtn');

    if (!bassNode) {
        bassNode = applyBassBoost();
        if (!bassGain) {
            bassGain = window.audioCtx.createGain();
            bassGain.gain.value = 0.8; // normalny poziom
        }
        window.source.disconnect();
		window.source.connect(window.analyser);
        window.source.connect(bassNode).connect(bassGain).connect(window.audioCtx.destination);

        displayStatus('Bass boost włączony', 2000);
        btn.style.backgroundColor = 'green';
    } else {
        window.source.disconnect();
        window.source.connect(bassGain).connect(window.audioCtx.destination);
		window.source.connect(window.analyser);
        bassNode.disconnect();
        bassNode = null;

        displayStatus('Bass boost wyłączony', 2000);
        btn.style.backgroundColor = '';
    }
});

function applyBassBoost() {
    const bassFilter = window.audioCtx.createBiquadFilter();
    bassFilter.type = "lowshelf";
    bassFilter.frequency.value = 200;
    bassFilter.gain.value = 7;
    return bassFilter;
}

})();