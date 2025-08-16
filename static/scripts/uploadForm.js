document.getElementById('uploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    let formData = new FormData(this);

    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length){
        alert('No file selected!');
        return;
    }

    const playlistRes = await fetch('/visualizer/playlist');
    const playlistData = await playlistRes.json();
    const currentFiles = playlistData.playlist.map(f => f.split('/').pop());

    const duplicateFiles = Array.from(fileInput.files)
        .map(f => f.name)
        .filter(name => currentFiles.includes(name));

    if (duplicateFiles.length) {
        alert('These files are already in the playlist: ' + duplicateFiles.join(', '));
        return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/visualizer/upload', true);

    const progressBar = document.getElementById('progress-bar');
    const progressContainer = document.getElementById('progress-container');
    const statusMessage = document.getElementById('status');  

    progressContainer.style.display = 'block';  
    setTimeout(() => progressContainer.style.opacity = '1', 10);

    xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percent + '%';
        }
    };
	
    xhr.onload = async function() {
        if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            document.getElementById('message').innerText = data.message;

            const playlistRes = await fetch('/visualizer/playlist');
            const playlistData = await playlistRes.json();
            updatePlaylistUI(playlistData.playlist);
            fileInput.value = '';
			document.getElementById('fileNames').textContent = '';
            progressContainer.style.transition = 'opacity 0.5s';
            progressContainer.style.opacity = '0';
            setTimeout(() => {
                progressContainer.style.display = 'none';
                progressBar.style.width = '0%';
            }, 500);
        } else {
            alert("Error in file upload.");
            progressContainer.style.opacity = '0';
        }
    };

    xhr.send(formData);
});
