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

function updatePlaylistUI(playlist) {
    const ul = document.getElementById('playlist');
    if (!playlist || playlist.length === 0) {
        ul.innerHTML = '';
        ul.style.display = 'none';
        return;
    }
    ul.style.display = 'block';
    ul.innerHTML = '';
    playlist.forEach((song, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="song-name">${song}</span>
            <div class="btn-group">
                <button onclick="skipTo(${index})">Play</button>
                <button class="remove-btn" onclick="removeSong('${song}')">Remove</button>
            </div>`;
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
    liClear.innerHTML = `<button class="clear-all-btn" onclick="clearPlaylist()">Clear playlist</button>`;
    ul.appendChild(liClear);
}

async function clearPlaylist() {
    const res = await fetch('/visualizer/clear', { method: 'POST' });
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
    const res = await fetch('/visualizer/remove/' + encodeURIComponent(filename), { method: 'POST' });
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
    fetch('/visualizer/skip/' + index, { method: 'POST' })
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
    const res = await fetch('/visualizer/next');
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

window.updatePlaylistUI = updatePlaylistUI;
window.removeSong = removeSong;
window.skipTo = skipTo;
window.playNext = playNext;
