document.addEventListener('DOMContentLoaded', () => {
  const player = new Plyr('#audioPlayer', {
    controls: [
        'play', 
        'progress',    
        'current-time',
        'duration',    
        'volume',      
        'mute',        
        'settings',   
        'fullscreen'   
    ],
    autoplay: false,
    invertTime: false 
});
    addQueueNavButtons(player);
    checkIsApp();
	
	fetch(window.appUrl('/playlist'))
        .then(res => res.json())
        .then(data => {
            updatePlaylistUI(data.playlist || []);
        });
});


//  PREVIOUS / NEXT SONG BUTTONS IN THE PLYR CONTROLS
const QUEUE_NAV_ICONS = {
    prev: '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M3 3h2v12H3zM15 3v12L6.5 9z"/></svg>',
    next: '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M13 3h2v12h-2zM3 3v12l8.5-6z"/></svg>'
};
let queueNav = null; // { prev, next } once they are in the controls

// position of the song that is playing now inside the queue, -1 when it is not in it
function queueIndexOfCurrent() {
    const list = window.currentPlaylist || [];
    if (!window.currentFile || !list.length) return -1;
    // the server sends the name as it is in the queue, the browser may hand it back percent-encoded
    const raw = String(window.currentFile).split('/').pop();
    let decoded = raw;
    try { decoded = decodeURIComponent(raw); } catch (e) {}
    return list.findIndex(song => song === raw || song === decoded);
}

function queueNavTarget(delta) {
    const list = window.currentPlaylist || [];
    const idx = queueIndexOfCurrent();
    if (idx < 0) return -1;
    let target = idx + delta;
    if (target < 0) return -1;
    if (target >= list.length) {
        if (!window.queueLoop) return -1;
        target = 0;
    }
    return target;
}

function queueNavGo(delta) {
    const target = queueNavTarget(delta);
    if (target >= 0 && typeof window.skipTo === 'function') window.skipTo(target);
}

function setQueueNavEnabled(btn, enabled) {
    btn.disabled = !enabled;
    btn.setAttribute('aria-disabled', String(!enabled));
    btn.style.opacity = enabled ? '' : '0.35';
    btn.style.pointerEvents = enabled ? '' : 'none';
}

function refreshQueueNav() {
    if (!queueNav) return;
    setQueueNavEnabled(queueNav.prev, queueNavTarget(-1) >= 0);
    setQueueNavEnabled(queueNav.next, queueNavTarget(1) >= 0);
}

function makeQueueNavButton(kind, label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'plyr__controls__item plyr__control queue-nav-btn';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.innerHTML = QUEUE_NAV_ICONS[kind];
    btn.addEventListener('click', () => queueNavGo(kind === 'prev' ? -1 : 1));
    return btn;
}

function addQueueNavButtons(player) {
    function inject() {
        const controls = (player.elements && player.elements.controls) || document.querySelector('.plyr__controls');
        const play = controls && controls.querySelector('[data-plyr="play"]');
        if (!play || !play.parentNode) return false;
        if (queueNav && queueNav.prev.parentNode === play.parentNode) return true; // already there

        const prev = makeQueueNavButton('prev', 'Previous song');
        const next = makeQueueNavButton('next', 'Next song');
        play.parentNode.insertBefore(prev, play);
        play.parentNode.insertBefore(next, play.nextSibling);
        queueNav = { prev: prev, next: next };
        refreshQueueNav();
        return true;
    }

    inject();
    if (typeof player.on === 'function') player.on('ready', inject);

    
    setInterval(() => {
        if (!inject()) return;
        refreshQueueNav();
    }, 300);
}


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
	
}


let statusTimer = null;

function displayStatus(message, duration) {
    const statusElement = document.getElementById('status');
	clearTimeout(statusTimer);
	statusElement.style.display = '';
    statusElement.textContent = message;
	if (typeof duration === 'number') {
        statusTimer = setTimeout(() => {
            statusElement.textContent = '';
        }, duration);
    }
}

function displayStatusHTML(message, duration) {
    const statusEl = document.getElementById('status');
	clearTimeout(statusTimer);
	statusEl.style.display = '';
    statusEl.innerHTML = message; 

	if (typeof duration === 'number') {
		statusTimer = setTimeout(() => {
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
  document.addEventListener('DOMContentLoaded', initRadioOptionsUI);

  const RECENT_RADIOS_KEY = 'recentRadioUrls';
  const MAX_RECENT_RADIOS = 5;

  function getRecentRadioUrls() {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_RADIOS_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored
        .filter(url => typeof url === 'string' && url.trim())
        .map(url => url.trim())
        .slice(0, MAX_RECENT_RADIOS);
    } catch (e) {
      return [];
    }
  }

  function formatRecentRadioLabel(url) {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname === '/' ? '' : parsed.pathname;
      return parsed.host + path + parsed.search;
    } catch (e) {
      return url.replace(/^https?:\/\//, '');
    }
  }

  function renderRecentRadios() {
    const section = document.getElementById('recentRadiosSection');
    const list = document.getElementById('recentRadiosList');
    if (!section || !list) return;

    const urls = getRecentRadioUrls();
    list.textContent = '';
    section.hidden = urls.length === 0;

    urls.forEach(url => {
      const item = document.createElement('li');
      const button = document.createElement('button');

      button.type = 'button';
      button.textContent = formatRecentRadioLabel(url);
      button.title = url;
      button.setAttribute('aria-label', `Use recent radio: ${url}`);
      button.addEventListener('click', () => {
        const input = document.getElementById('radioUrl');
        if (!input) return;
        input.value = url;
        input.focus();
      });

      item.appendChild(button);
      list.appendChild(item);
    });
  }

  function saveRecentRadioUrl(url) {
    const normalized = (url || '').trim();
    if (!normalized) return;

    const recent = getRecentRadioUrls().filter(item => item !== normalized);
    recent.unshift(normalized);

    localStorage.setItem(RECENT_RADIOS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_RADIOS)));
    renderRecentRadios();
  }
  
	async function playRadio(force = false) {
    const url = localStorage.getItem('customRadioUrl') || "https://radio.shinpu.top/radio.ogg";

    if (!force && window.isRadioPlaying) return;

    // Fix .ogg URL for Intel Mac if needed
    const ua = navigator.userAgent.toLowerCase();
    const finalUrl = ua.includes("intel mac os x") && url.endsWith(".ogg") ? url.replace(".ogg", "") : url;

    window.audio.src = finalUrl;
    window.audio.volume = 1;

    if (window.audioCtx?.state === 'suspended') {
        await window.audioCtx.resume();
    }

    connectAudio();

    try {
        await window.audio.play();
        window.isRadioPlaying = true;
        window.isPlaylistPlaying = false;
        saveRecentRadioUrl(url);
        displayStatus("Now playing radio!", 4000);
        updateRadioTrack(); 
    } catch (e) {
        displayStatus("Unable to start radio...", 4000);
    }
}
	let isRecon = true;
	async function checkRadio(){
    const url = localStorage.getItem('customRadioUrl') || "https://radio.shinpu.top/radio.ogg";
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

	const playRadioOnLoad = sessionStorage.getItem('playRadioOnLoad') === '1';
	if (playRadioOnLoad) sessionStorage.removeItem('playRadioOnLoad');

	const radioStartDisabled = localStorage.getItem('radioStartDisabled') !== '0';
	if (!radioStartDisabled || playRadioOnLoad) {
		checkRadio();
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

async function getShinpuMetadata() {
    const res = await fetch('https://radio.shinpu.top/status-json.xsl');
    const data = await res.json();

    let mount = data.icestats.source;
    if (Array.isArray(mount)) {
        mount = mount.find(m => m.listenurl.endsWith('/radio.ogg'));
    }

    return {
        artist: mount?.artist || "No info",
        title: mount?.title || "No info"
    };
}

// async function getGenericStreamMetadata(streamUrl) {
    // try {
        // const res = await fetch(
            // `https://hyndzia.xyz/icy?url=${encodeURIComponent(streamUrl)}`
        // );

        // const data = await res.json();
        // return {
            // artist: data.artist || "No info",
            // title: data.title || "No info"
        // };
    // } catch (err) {
        // return { artist: "No info", title: "No info" };
    // }
// }


function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[char]);
}

function radioLinkHTML(streamUrl) {
    let href = streamUrl;
    let label = streamUrl;

    try {
        const parsed = new URL(streamUrl);
        if (parsed.hostname === 'radio.shinpu.top') {
            // jak wcześniej: link do strony radia, nie do pliku .ogg
            href = 'https://radio.shinpu.top';
            label = 'radio.shinpu.top';
        } else {
            const path = parsed.pathname === '/' ? '' : parsed.pathname;
            label = parsed.host + path;
        }
    } catch (e) {}

    return `<a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>`;
}

async function updateRadioTrack() {
    if (!window.isRadioPlaying || !window.audio) return;

    const streamUrl = window.audio.currentSrc || window.audio.src;

    if (!streamUrl) return;

    try {
        const res = await fetch(
            window.appUrl(
                '/api/radio/now-playing?url=' +
                encodeURIComponent(streamUrl)
            ),
            { cache: 'no-store' }
        );

        if (!res.ok) throw new Error('Metadata request failed');

        const data = await res.json();

        if (data.has_metadata && data.title) {
            // tytuł + pod spodem link do radia
            displayStatusHTML(
                `Now playing: 「 ${escapeHTML(data.title)} 」<br>${radioLinkHTML(data.stream_url || streamUrl)}`
            );
        } else {
            // brak metadanych: sam link jako "now playing"
            displayStatusHTML(
                `Now playing: ${radioLinkHTML(data.stream_url || streamUrl)}`
            );
        }

    } catch (err) {
        console.error('Failed to fetch radio metadata:', err);

        displayStatusHTML(
            `Radio: ${radioLinkHTML(streamUrl)}`
        );
    }
}



// async function updateRadioTrack() {
    // if (!window.isRadioPlaying) return;

    // try {
        // const res = await fetch('https://radio.shinpu.top/status-json.xsl');
        // const data = await res.json();

        // let mount = data.icestats.source;
        // if (Array.isArray(mount)) {
            // mount = mount.find(m => m.listenurl.endsWith('/radio.ogg'));
        // }

        // const title = mount?.title || "No info";
        // const artist = mount?.artist || "No info";

        // if (!window.audio || window.audio.paused) return;

        // displayStatusHTML(`Now playing: 「 ${artist} - ${title} 」  <a href="https://radio.shinpu.top" target="_blank"><br>radio.shinpu.top</a>`);

    // } catch (err) {
        // console.error("Failed to fetch Icecast metadata:", err);
    // }
// }

setInterval(updateRadioTrack, 10000);


async function playNext() {
    if (window.currentFile) {
        // delete previous file from backend
        await fetch(window.appUrl('/remove/' + encodeURIComponent(window.currentFile)), { method: 'POST' });
    }

    //request data from /next
    const res = await fetch(window.appUrl('/next'));
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
    const res = await fetch(window.appUrl('/current'));
    const data = await res.json();
    return data.file;
  }

  async function fetchNext() {
    const res = await fetch(window.appUrl('/next'));
    const data = await res.json();
    return data.file;
  }


audio.addEventListener('ended', async () => {
    if (window.queueLoop && window.currentFile && typeof window.loopNext === 'function') {
        try {
            if (await window.loopNext()) return;
        } catch (e) {
            console.error('Queue loop failed:', e);
        }
    }

    const previousFile = currentFile;

    const nextRes = await fetch(window.appUrl('/next'));
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
        displayStatus('Reconnecting to the radio...', 3000);
    }, 5500);
		setTimeout(() => {
        playRadio();
    }, 5800);
    }

    if (previousFile) {
        const fileName = previousFile.split('/').pop();
        fetch(window.appUrl('/remove/' + encodeURIComponent(fileName)), { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    window.updatePlaylistUI(data.playlist);
                }
            });
    }
});

const FX_BUTTON_IDS = {
    bassBoost: 'bassBoostBtn',
    bitcrusher: 'bitcrusherBtn',
    ringMod: 'ringModBtn',
    phaser: 'phaserBtn',
    delay: 'delayBtn',
    phaseVocoder: 'phaseVocoderBtn'
};

let fxRestoreTimer = null;

function showNowPlayingAgain() {
    if (window.isPlaylistPlaying && window.currentFile) {
        displayStatus('Now playing: ' + window.currentFile.split('/').pop());
    } else if (window.isRadioPlaying) {
        updateRadioTrack();
    }
}

function paintFxButton(btn, on) {
    btn.classList.toggle('active', on);
    btn.style.backgroundColor = on ? 'rgba(23, 143, 0, 0.6)' : '';
    btn.style.color = on ? '#121212' : '#a30000';
}

function initEffectButtons(fx) {
    const labels = {};
    fx.list().forEach(item => { labels[item.id] = item.label; });

    // Existing effect buttons, used as a template for the missing ones
    const existing = Object.values(FX_BUTTON_IDS)
        .map(id => document.getElementById(id))
        .filter(Boolean);
    const template = existing[0] || null;
    let anchor = existing.length
        ? existing.reduce((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? b : a)
        : null;

    // Effects with an adjustable value (phase vocoder pitch) get a "-" and "+" button
    // next to their button; they are visible only while the effect is on. They are hidden with
    // visibility (not display) so they keep their space and never shift the other buttons.
    const steppers = {};

    function showValue(id) {
        displayStatus(labels[id] + ': ' + fx.valueLabel(id), 2000);
        clearTimeout(fxRestoreTimer);
        fxRestoreTimer = setTimeout(showNowPlayingAgain, 2100);
    }

    function createStepper(id, btn) {
        const make = (text, delta, title) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = btn.className;
            b.textContent = text;
            b.title = title;
            b.style.visibility = 'hidden';
            b.addEventListener('click', () => {
                fx.adjust(id, delta);
                showValue(id);
            });
            return b;
        };
        const minus = make('−', -1, 'Pitch down by 1 semitone');
        const plus = make('+', 1, 'Pitch up by 1 semitone');
        btn.parentNode.insertBefore(minus, btn.nextSibling);
        minus.parentNode.insertBefore(plus, minus.nextSibling);
        steppers[id] = [minus, plus];
        anchor = plus;
    }

    function updateStepper(id, on) {
        if (steppers[id]) steppers[id].forEach(b => { b.style.visibility = on ? 'visible' : 'hidden'; });
    }

    // Hide buttons of effects this browser can't do
    Object.keys(FX_BUTTON_IDS).forEach(id => {
        if (!fx.has(id)) {
            const el = document.getElementById(FX_BUTTON_IDS[id]);
            if (el) el.style.display = 'none';
        }
    });

    fx.order.forEach(id => {
        const btnId = FX_BUTTON_IDS[id];
        let btn = document.getElementById(btnId);

        if (!btn && template && anchor) {
            btn = template.cloneNode(true);
            btn.id = btnId;
            btn.textContent = labels[id];
            btn.classList.remove('active');
            btn.style.backgroundColor = '';
            btn.style.color = '';
            anchor.parentNode.insertBefore(btn, anchor.nextSibling);
            anchor = btn;
        }
        if (!btn) return;

        paintFxButton(btn, fx.isOn(id));
        btn.addEventListener('click', () => fx.toggle(id));

        if (fx.hasStepper(id)) {
            createStepper(id, btn);
            updateStepper(id, fx.isOn(id));
        }
    });

    fx.onChange((id, on) => {
        const btn = document.getElementById(FX_BUTTON_IDS[id]);
        if (btn) paintFxButton(btn, on);

        updateStepper(id, on);

        const valueInfo = on && fx.hasStepper(id) ? ' (' + fx.valueLabel(id) + ')' : '';
        displayStatus(labels[id] + (on ? ' enabled' : ' disabled') + valueInfo, 2000);
        clearTimeout(fxRestoreTimer);
        fxRestoreTimer = setTimeout(showNowPlayingAgain, 2100);
    });
}

if (window.fx) {
    initEffectButtons(window.fx);
} else {
    window.addEventListener('fx-ready', () => initEffectButtons(window.fx), { once: true });
}

function initRadioOptionsUI() {
    const optionsBtn = document.getElementById('optionsBtn');
    const overlay = document.getElementById('optionsOverlay');
    const closeModal = document.getElementById('closeModal');
    const saveRadio = document.getElementById('saveRadio');
    const radioInput = document.getElementById('radioUrl');
    const startDisabledCheckbox = document.getElementById('radioStartDisabled');

    if (!optionsBtn) return;

    const syncStartDisabledCheckbox = () => {
        if (!startDisabledCheckbox) return;
        startDisabledCheckbox.checked = localStorage.getItem('radioStartDisabled') !== '0';
    };

    radioInput.value = localStorage.getItem('customRadioUrl') || '';
    syncStartDisabledCheckbox();
    renderRecentRadios();

    if (startDisabledCheckbox) {
        startDisabledCheckbox.addEventListener('change', () => {
            localStorage.setItem('radioStartDisabled', startDisabledCheckbox.checked ? '1' : '0');
        });
    }

    optionsBtn.onclick = () => {
        radioInput.value = localStorage.getItem('customRadioUrl') || '';
        syncStartDisabledCheckbox();
        renderRecentRadios();
        overlay.classList.remove('hidden');
    };
    closeModal.onclick = () => overlay.classList.add('hidden');

    overlay.onclick = e => {
        if (e.target === overlay) overlay.classList.add('hidden');
    };

    saveRadio.onclick = async () => {
        const url = radioInput.value.trim();
        if (url) {
            localStorage.setItem('customRadioUrl', url);
        } else {
            localStorage.removeItem('customRadioUrl');
        }

        localStorage.setItem(
            'radioStartDisabled',
            startDisabledCheckbox && !startDisabledCheckbox.checked ? '0' : '1'
        );

        overlay.classList.add('hidden');

        sessionStorage.setItem('playRadioOnLoad', '1');
        window.audio.pause();
        window.audio.currentTime = 0;
        window.audio.src = '';

        location.reload();
    };
}

})();
