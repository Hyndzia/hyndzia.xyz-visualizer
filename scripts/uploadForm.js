document.getElementById('uploadForm').addEventListener('submit', function(e) {
    e.preventDefault();
    let formData = new FormData(this);
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/visualizer/upload', true);

    const progressBar = document.getElementById('progress-bar');
	const progressContainer = document.getElementById('progress-container');
	const statusMessage = document.getElementById('status');  
	
	
	   progressContainer.style.display = 'block';  
    setTimeout(() => {
        progressContainer.style.opacity = '1';  // set up opacity
    }, 10);  // latency before fade-in (ms)
	

    // upload progress
    xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percent + '%';
            //progressBar.textContent = percent + '%';
        }
    };

    xhr.onload = async function() {
        if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            const messageEl = document.getElementById('message');
            messageEl.innerText = data.message;

			 statusMessage.style.display = 'block';  // show status notify
			 
            const playlistRes = await fetch('/visualizer/playlist');
            const playlistData = await playlistRes.json();
            updatePlaylistUI(playlistData.playlist);

      setTimeout(() => {
                progressContainer.style.opacity = '0';  
                setTimeout(() => {
                    progressContainer.style.display = 'none'; 
                }, 500);  
            }, 1000);  
        } else {
            alert("Błąd przy przesyłaniu plików!");
            progressContainer.style.opacity = '0';
        }
    };

    xhr.send(formData);
});