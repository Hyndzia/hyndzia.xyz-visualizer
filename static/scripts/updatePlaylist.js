// ---------- queue state ----------
// Loop mode is remembered between visits (localStorage may be unavailable, so it is wrapped in try/catch)
window.queueLoop = (function () {
    try { return localStorage.getItem('queueLoop') === '1'; } catch (e) { return false; }
})();

// Copy of the playlist currently shown (array of file names, same order as on the server)
window.currentPlaylist = [];

function songBaseName(path) {
    const name = String(path || '').split('/').pop();
    try { return decodeURIComponent(name); } catch (e) { return name; }
}

function updatePlaylistUI(playlist) {
    const ul = document.getElementById('playlist');
    window.currentPlaylist = Array.isArray(playlist) ? playlist.slice() : [];
    initDragSort(ul);

    if (!playlist || playlist.length === 0) {
        ul.innerHTML = '';
        ul.style.display = 'none';
        return;
    }
    ul.style.display = 'block';
    ul.innerHTML = '';
    playlist.forEach((song, index) => {
        const li = document.createElement('li');
        li.dataset.index = index;

        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '☰';
        handle.title = 'Drag to change the order';

        const name = document.createElement('span');
        name.className = 'song-name';
        name.textContent = song;

        const group = document.createElement('div');
        group.className = 'btn-group';

        const playBtn = document.createElement('button');
        playBtn.textContent = 'Play';
        playBtn.addEventListener('click', () => skipTo(index));

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => removeSong(song));

        group.append(playBtn, removeBtn);
        li.append(handle, name, group);
        ul.appendChild(li);
    });
    addClearButton();
}

function addClearButton() {
    const ul = document.getElementById('playlist');
    const existing = ul.querySelector('.clear-all-btn-container');
    if (existing) existing.remove();

    const liClear = document.createElement('li');
    liClear.className = 'clear-all-btn-container';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'clear-all-btn';
    clearBtn.textContent = 'Clear playlist';
    clearBtn.addEventListener('click', clearPlaylist);

    const loopBtn = document.createElement('button');
    loopBtn.type = 'button';
    loopBtn.className = 'loop-btn' + (window.queueLoop ? ' active' : '');
    loopBtn.textContent = 'Loop';
    loopBtn.title = 'Loop the queue: songs stay in the queue and it starts over after the last one';
    loopBtn.setAttribute('aria-pressed', String(!!window.queueLoop));
    loopBtn.addEventListener('click', toggleQueueLoop);

    liClear.append(clearBtn, loopBtn);
    ul.appendChild(liClear);
}

// ---------- queue loop ----------
function toggleQueueLoop() {
    window.queueLoop = !window.queueLoop;
    try { localStorage.setItem('queueLoop', window.queueLoop ? '1' : '0'); } catch (e) {}

    const btn = document.querySelector('#playlist .loop-btn');
    if (btn) {
        btn.classList.toggle('active', window.queueLoop);
        btn.setAttribute('aria-pressed', String(window.queueLoop));
    }

    displayStatus('Queue loop ' + (window.queueLoop ? 'enabled' : 'disabled'), 2000);
    setTimeout(() => {
        if (window.isPlaylistPlaying && window.currentFile) {
            displayStatus('Now playing: ' + window.currentFile.split('/').pop());
        }
    }, 2100);
}

// Called by the 'ended' handler in player.js while loop is on:
// nothing is removed from the queue, the next song is played and after the last one it wraps to the first.
async function loopNext() {
    const list = window.currentPlaylist || [];
    if (!list.length) return false;

    // the server sends the file name as it is in the queue; the browser may hand it back percent-encoded
    const raw = String(window.currentFile || '').split('/').pop();
    const decoded = songBaseName(window.currentFile);
    const idx = list.findIndex(song => song === raw || song === decoded);
    await skipTo((idx + 1) % list.length); // idx -1 (unknown song) -> starts from the first one
    return true;
}

// ---------- drag & drop reordering ----------
// Pointer events, so it works with mouse, pen and touch. Dragging starts from the handle on the left of a row.
function initDragSort(ul) {
    if (ul._dragSortReady) return;
    ul._dragSortReady = true;

    let drag = null; // { li, from, slot, pointerId }

    function clearMarks() {
        ul.querySelectorAll('.drag-over-top, .drag-over-bottom')
            .forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
    }

    ul.addEventListener('pointerdown', (e) => {
        const handle = e.target.closest ? e.target.closest('.drag-handle') : null;
        if (!handle || (e.pointerType === 'mouse' && e.button !== 0)) return;

        const li = handle.closest('li');
        drag = { li: li, from: Number(li.dataset.index), slot: null, pointerId: e.pointerId };
        try { handle.setPointerCapture(e.pointerId); } catch (err) {}
        li.classList.add('dragging');
        e.preventDefault();
    });

    ul.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.pointerId) return;

        // scroll the list when the pointer is near its top/bottom edge
        const box = ul.getBoundingClientRect();
        if (e.clientY < box.top + 30) ul.scrollTop -= 10;
        else if (e.clientY > box.bottom - 30) ul.scrollTop += 10;

        const el = document.elementFromPoint(e.clientX, e.clientY);
        const over = el && el.closest ? el.closest('#playlist li[data-index]') : null;
        if (!over) return;

        const rect = over.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;

        clearMarks();
        over.classList.add(after ? 'drag-over-bottom' : 'drag-over-top');
        drag.slot = Number(over.dataset.index) + (after ? 1 : 0); // position between rows, before the move
    });

    function finish(e, cancelled) {
        if (!drag || e.pointerId !== drag.pointerId) return;
        const { li, from, slot } = drag;
        drag = null;
        li.classList.remove('dragging');
        clearMarks();
        if (cancelled || slot === null) return;

        const to = slot > from ? slot - 1 : slot;
        if (to === from) return;

        const list = window.currentPlaylist.slice();
        const moved = list.splice(from, 1)[0];
        list.splice(to, 0, moved);
        reorderPlaylist(list);
    }
    ul.addEventListener('pointerup', (e) => finish(e, false));
    ul.addEventListener('pointercancel', (e) => finish(e, true));
}

// The new order is shown immediately and then saved on the server; if saving fails the old order comes back.
async function reorderPlaylist(newList) {
    const previous = window.currentPlaylist.slice();
    updatePlaylistUI(newList);

    try {
        const res = await fetch(window.appUrl('/reorder'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playlist: newList })
        });
        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message || 'Reorder failed');
        if (data.playlist) updatePlaylistUI(data.playlist);
    } catch (err) {
        console.error('Reordering the queue failed:', err);
        updatePlaylistUI(previous);
        displayStatus('Could not change the queue order.', 3000);
    }
}

async function clearPlaylist() {
    const res = await fetch(window.appUrl('/clear'), { method: 'POST' });
    const data = await res.json();

    if (data.status === 'success') {
        updatePlaylistUI([]);
		if (!isRadioPlaying){
			if (window.audio) {
				window.audio.pause();
				window.audio.currentTime = 0;
				window.audio.src = '';
			}
		}else{
			playRadio();
		}
        window.currentFile = null;
        displayStatus('Playlist cleared.', 3000);
		setTimeout(() => {
        displayStatus('Reconnecting to the radio...');
    }, 6000);
        playRadio();
    } else {
        alert(data.message);
    }
}

function stopIfPlaying(filename) {
    if (window.audio && window.audio.src.includes(filename)) {
        window.audio.pause();
        window.audio.currentTime = 0;
        window.audio.src = ''; 
        window.currentFile = null;
        displayStatus('');
    }
}

async function removeSong(filename) {
    const res = await fetch(window.appUrl('/remove/' + encodeURIComponent(filename)), { method: 'POST' });
    const data = await res.json();

    if (data.status === 'success') {
        updatePlaylistUI(data.playlist);

        if (window.currentFile && window.currentFile.endsWith(filename)) {
            if (data.playlist && data.playlist.length > 0) {
                playFile(data.playlist[0]);
                window.currentFile = data.playlist[0];
            } else {
                window.audio.pause();
                window.audio.currentTime = 0;
                window.audio.src = '';
                window.currentFile = null;
                displayStatus('Playlist finished.', 3000);
            }
        }
        return data.playlist || [];
    } else {
        alert(data.message);
        return [];
    }
}

function skipTo(index) {
    return fetch(window.appUrl('/skip/' + index), { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                window.playFile(data.file);
                window.currentFile = data.file;
            } else {
                alert(data.message);
            }
        });
}

async function playNext() {
    const res = await fetch(window.appUrl('/next'));
    const data = await res.json();
    updatePlaylistUI(data.playlist);

    if (data.file) {
        playFile(data.file);
        window.currentFile = data.file;
        displayStatus("Now playing: " + data.file.split('/').pop());
    } else {
        window.audio.src = '';
        window.currentFile = null;
        displayStatus('No files uploaded.');
    }
}

document.getElementById('fileInput').addEventListener('change', function() {
    const fileList = Array.from(this.files).map(file => file.name).join(', ');
    document.getElementById('fileNames').textContent = fileList || 'Brak wybranych plików';
});

function showYtStatus(message, duration) {
    const statusEl = document.getElementById('yt-status');
    statusEl.innerText = message;
    statusEl.style.opacity = "1"; 

    if (statusEl._timeoutId) {
        clearTimeout(statusEl._timeoutId);
    }

    statusEl._timeoutId = setTimeout(() => {
        statusEl.style.transition = "opacity 0.5s ease";
        statusEl.style.opacity = "0";
        setTimeout(() => statusEl.innerText = "", 500);
    }, duration);
}

document.getElementById('yt-search-btn').addEventListener('click', async () => {
    const query = document.getElementById('yt-query').value.trim();
    if (!query) return;

	showYtStatus("Adding song to queue...", 30000);

    const res = await fetch(window.appUrl('/youtube'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query})
    });

    const data = await res.json();
    if (data.status === 'success') {
        showYtStatus(data.message, 5000);
        updatePlaylistUI(data.playlist);

        // auto-play next track
        // const lastIndex = data.playlist.length - 1;
        // skipTo(lastIndex);
    } else {
        //showYtStatus("Error: " + data.message, 9000); //debug
		showYtStatus("Service currently unavailable", 9000);
    }
});


window.updatePlaylistUI = updatePlaylistUI;
window.removeSong = removeSong;
window.skipTo = skipTo;
window.loopNext = loopNext;
window.reorderPlaylist = reorderPlaylist;
window.playNext = playNext;