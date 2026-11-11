import mimetypes
import os
from collections import Counter
from flask import Flask, render_template, request, jsonify, session, send_file, url_for
from datetime import timedelta
import uuid
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import threading
import time
import re
import ipaddress
import socket
from urllib.parse import urlparse, urljoin
import requests

app = Flask(__name__)
load_dotenv()
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)


def normalize_url_prefix(value):
    value = (value or '').strip()
    if not value or value == '/':
        return ''
    return '/' + value.strip('/')


# The app is served from the site root locally, but production may mount it
# under a subpath (e.g. https://hyndzia.net/visualizer). Set URL_PREFIX there so
# every generated link (static files, audio files, API calls) keeps that prefix.
URL_PREFIX = normalize_url_prefix(os.getenv('URL_PREFIX'))


class PrefixMiddleware:

    def __init__(self, wsgi_app, prefix):
        self.wsgi_app = wsgi_app
        self.prefix = prefix

    def __call__(self, environ, start_response):
        if self.prefix:
            path = environ.get('PATH_INFO') or '/'
            if path == self.prefix or path.startswith(self.prefix + '/'):
                environ['SCRIPT_NAME'] = self.prefix
                environ['PATH_INFO'] = path[len(self.prefix):] or '/'
            elif not environ.get('SCRIPT_NAME'):
                # The proxy already removed the prefix, but generated URLs and
                # the static route still have to know where the app lives.
                environ['SCRIPT_NAME'] = self.prefix

        return self.wsgi_app(environ, start_response)


app.wsgi_app = PrefixMiddleware(app.wsgi_app, URL_PREFIX)

@app.after_request
def disable_stale_cache(response):
    if request.path.startswith('/static/') or response.mimetype == 'text/html':
        response.headers['Cache-Control'] = 'no-store, max-age=0'
    return response


UPLOAD_FOLDER = os.path.abspath('uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'm4u', 'ogg'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_user_id():
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
        session['playlist'] = []
        session['current_index'] = 0
    return session['user_id']
    
def folder_size(path):
    total = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if os.path.exists(fp):
                total += os.path.getsize(fp)
    return total

def monitor_uploads():
    while True:
        size_bytes = folder_size(UPLOAD_FOLDER)
        size_mb = size_bytes / (1024 * 1024)
        print(f"[Uploads Folder Size] {size_mb:.2f} MB")
        time.sleep(1800)  # seconds

@app.route('/')
def index():
    get_user_id()
    return render_template('index.html', playlist=session.get('playlist', [])), 200, {'Content-Type': 'text/html; charset=utf-8'}

@app.route('/upload', methods=['POST'])
def upload():
    user_id = get_user_id()
    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], user_id)
    os.makedirs(user_folder, exist_ok=True)

    files = request.files.getlist('mp3_files')
    if len(files) > 9:
        return jsonify({'status': 'error', 'message': 'Max 9 files at a time!'})

    playlist = session.get('playlist', [])

    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            save_path = os.path.join(user_folder, filename)
            file.save(save_path)
            if filename not in playlist:
                playlist.append(filename)

    session['playlist'] = playlist
    return jsonify({'status': 'success','message': 'Files succesfully uploaded!', 'playlist': playlist})

@app.route('/youtube', methods=['POST'])
def youtube_search():
    user_id = get_user_id()
    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], user_id)
    os.makedirs(user_folder, exist_ok=True)
    data = request.get_json()
    query = data.get("query", "").strip()
    if not query:
        return jsonify({'status': 'error', 'message': 'No query provided'})

    if not query.startswith("http"):
        search_url = f"ytsearch1:{query}"  
    else:
        search_url = query  

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(user_folder, '%(title)s.%(ext)s'),
        'noplaylist': True,
        'quiet': True,
        'cookiefile': os.getenv("COOKIE_FILE", "/app/cookies.txt"),
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(search_url, download=True)
            if 'entries' in info:
                info = info['entries'][0]

            filename = ydl.prepare_filename(info)
            safe_name = os.path.basename(filename)

            playlist = session.get('playlist', [])
            if safe_name not in playlist:
                playlist.append(safe_name)
            session['playlist'] = playlist

        return jsonify({
            'status': 'success',
            'message': f"Added {info.get('title')} to playlist",
            'playlist': playlist
        })

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})


@app.route('/file/<filename>')
def get_file(filename):
    user_id = get_user_id()
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], user_id, filename)

    if not os.path.exists(file_path):
        playlist = session.get('playlist', [])
        if filename in playlist:
            playlist.remove(filename)
            session['playlist'] = playlist
        return jsonify({'status': 'missing', 'playlist': playlist})

    mimetype = mimetypes.guess_type(filename)[0] or 'audio/mpeg'
    return send_file(file_path, mimetype=mimetype)

@app.route('/current')
def current():
    playlist = session.get('playlist', [])
    idx = session.get('current_index', 0)

    if not playlist:
        return jsonify({'file': None})

    current_file = playlist[idx]
    return jsonify({'file': url_for('get_file', filename=current_file)})


@app.route('/next')
def next_track():
    playlist = session.get('playlist', [])
    current_index = session.get('current_index', -1)

    if not playlist:
        return jsonify({'file': None, 'playlist': []})

    next_index = current_index + 1
    if next_index >= len(playlist):
        next_index = 0 

    session['current_index'] = next_index
    next_file = playlist[next_index]
    return jsonify({'file': url_for('get_file', filename=next_file), 'playlist': playlist})

@app.route('/playlist')
def get_playlist():
    playlist = session.get('playlist', [])
    return jsonify({'playlist': playlist})

@app.route('/remove/<filename>', methods=['POST'])
def remove(filename):
    playlist = session.get('playlist', [])
    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], get_user_id())
    file_path = os.path.join(user_folder, filename)

    if filename in playlist:
        idx = playlist.index(filename)
        playlist.remove(filename)
        if os.path.exists(file_path):
            os.remove(file_path)
        current_index = session.get('current_index', 0)
        if idx < current_index:
            session['current_index'] = current_index - 1
        elif idx == current_index:
            session['current_index'] = current_index % len(playlist) if playlist else 0
        session['playlist'] = playlist
        return jsonify({'status': 'success', 'playlist': playlist})


@app.route('/skip/<int:index>', methods=['POST'])
def skip_to(index):
    playlist = session.get('playlist', [])
    if 0 <= index < len(playlist):
        session['current_index'] = index
        return jsonify({'status': 'success', 'file': url_for('get_file', filename=playlist[index])})
    return jsonify({'status': 'error', 'message': 'Invalid index'})


@app.route('/reorder', methods=['POST'])
def reorder():
    # Saves the queue order changed by drag & drop. Only the order may change:
    # the new list has to contain exactly the same files as the current one.
    playlist = session.get('playlist', [])
    new_order = (request.get_json(silent=True) or {}).get('playlist')

    if (not isinstance(new_order, list)
            or not all(isinstance(name, str) for name in new_order)
            or Counter(new_order) != Counter(playlist)):
        return jsonify({'status': 'error', 'message': 'Invalid playlist'}), 400

    # keep "current_index" pointing at the same song after it has moved
    current_index = session.get('current_index', 0)
    current_name = playlist[current_index] if 0 <= current_index < len(playlist) else None

    session['playlist'] = new_order
    if current_name is not None:
        session['current_index'] = new_order.index(current_name)

    return jsonify({'status': 'success', 'playlist': new_order})


@app.route('/clear', methods=['POST'])
def clear_playlist():
    playlist = session.get('playlist', [])
    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], get_user_id())

    for filename in playlist:
        file_path = os.path.join(user_folder, filename)
        if os.path.exists(file_path):
            os.remove(file_path)

    session['playlist'] = []
    session['current_index'] = 0

    return jsonify({'status': 'success', 'playlist': []})

# ---------- Radio "now playing" ----------
SHINPU_HOST = 'radio.shinpu.top'
_radio_cache = {}  # url -> (timestamp, result)
RADIO_CACHE_SECONDS = 8


def is_public_http_url(url):
    """Only allow http(s) URLs that resolve to public IPs (blocks SSRF to localhost/LAN)."""
    try:
        p = urlparse(url)
        if p.scheme not in ('http', 'https') or not p.hostname:
            return False
        port = p.port or (443 if p.scheme == 'https' else 80)
        for info in socket.getaddrinfo(p.hostname, port, proto=socket.IPPROTO_TCP):
            if not ipaddress.ip_address(info[4][0]).is_global:
                return False
        return True
    except (ValueError, socket.gaierror):
        return False


def _read_exact(raw, n):
    buf = b''
    while len(buf) < n:
        chunk = raw.read(n - len(buf))
        if not chunk:
            raise EOFError('stream ended')
        buf += chunk
    return buf


def read_icy_title(url, timeout=6):
    """Returns StreamTitle string, or None if the stream has no usable ICY metadata."""
    headers = {
        'Icy-MetaData': '1',
        'Accept-Encoding': 'identity',
        'User-Agent': 'Mozilla/5.0 (VisualizerApp radio metadata)',
    }
    current = url
    resp = None
    for _ in range(4):  # follow a few redirects, re-validating every hop
        if not is_public_http_url(current):
            return None
        resp = requests.get(current, headers=headers, stream=True,
                            timeout=timeout, allow_redirects=False)
        if resp.status_code in (301, 302, 303, 307, 308):
            current = urljoin(current, resp.headers.get('Location', ''))
            resp.close()
            resp = None
            continue
        break
    if resp is None:
        return None

    try:
        if not resp.ok:
            return None
        metaint = resp.headers.get('icy-metaint', '')
        if not metaint.isdigit() or not (0 < int(metaint) <= 1_000_000):
            return None
        metaint = int(metaint)

        # Audio bytes, then 1 length byte (x16), then the metadata block.
        # An empty block is normal between songs, so look at a few blocks.
        for _ in range(3):
            _read_exact(resp.raw, metaint)
            length = _read_exact(resp.raw, 1)[0] * 16
            if not length:
                continue
            block = _read_exact(resp.raw, length).rstrip(b'\0')
            try:
                text = block.decode('utf-8')
            except UnicodeDecodeError:
                text = block.decode('latin-1')
            m = re.search(r"StreamTitle='(.*?)';", text, re.S) or \
                re.search(r"StreamTitle='(.*)'", text, re.S)
            if m and m.group(1).strip():
                return m.group(1).strip()
        return None
    except (EOFError, requests.RequestException, OSError):
        return None
    finally:
        resp.close()


def shinpu_title():
    """Shinpu is Icecast/Ogg, so it uses its status-json instead of ICY."""
    try:
        data = requests.get(f'https://{SHINPU_HOST}/status-json.xsl', timeout=5).json()
        mount = data['icestats']['source']
        if isinstance(mount, list):
            mount = next((m for m in mount if m.get('listenurl', '').endswith('/radio.ogg')), None)
        if not mount:
            return None
        artist, title = mount.get('artist'), mount.get('title')
        if artist and title:
            return f'{artist} - {title}'
        return title or artist or None
    except Exception:
        return None


@app.route('/api/radio/now-playing')
def radio_now_playing():
    url = request.args.get('url', '').strip()
    if not is_public_http_url(url):
        return jsonify({'has_metadata': False, 'title': None, 'stream_url': url}), 400

    cached = _radio_cache.get(url)
    if cached and time.time() - cached[0] < RADIO_CACHE_SECONDS:
        return jsonify(cached[1])

    host = (urlparse(url).hostname or '').lower()
    title = shinpu_title() if host == SHINPU_HOST else read_icy_title(url)

    result = {'has_metadata': bool(title), 'title': title, 'stream_url': url}
    _radio_cache[url] = (time.time(), result)
    return jsonify(result)    

if __name__ == '__main__':
    threading.Thread(target=monitor_uploads, daemon=True).start()
    app.run(host="127.0.0.1", port=8989, debug=True)