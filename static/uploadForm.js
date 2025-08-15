document.getElementById('uploadForm').addEventListener('submit', function(e) {
    e.preventDefault();
    let formData = new FormData(this);
    fetch('/upload', { method: 'POST', body: formData })
      .then(res => res.json())
      .then(data => {
          document.getElementById('message').innerText = data.message;
          if (data.status === 'success') {
              //site-reloading
              location.reload();
          }
      });
});