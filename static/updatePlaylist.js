function updatePlaylistUI(playlist) {
    const ul = document.getElementById('playlist');
    if (!playlist || playlist.length === 0) {
        ul.innerHTML = '';
        ul.style.display = 'none';  // ukryj listę
        return;
    }
    ul.style.display = 'block'; // pokaż listę
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
}
function removeSong(filename) {
    fetch('/remove/' + encodeURIComponent(filename), { method: 'POST' })
        .then(res => res.json())
        .then(data => {
    if (data.status === 'success') {
        updatePlaylistUI(data.playlist);
    } else {
        alert(data.message);
    }
});
}
function skipTo(index) {
    fetch('/skip/' + index, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                const audio = document.getElementById('audioPlayer');
                audio.src = data.file;
				location.reload();
                audio.play();
                document.getElementById('status').textContent = 'Now playing: ' + data.file.split('/').pop();
				
            } else {
                alert(data.message);
            }
        });
}