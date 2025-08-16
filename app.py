import os
from flask import Flask, render_template, request, jsonify, session, send_file
from datetime import timedelta
import uuid
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SECRET_KEY'] = ''
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'mp3'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_user_id():
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
        session['playlist'] = []
        session['current_index'] = 0
    return session['user_id']

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

    return send_file(file_path, mimetype='audio/mpeg')

@app.route('/current')
def current():
    playlist = session.get('playlist', [])
    idx = session.get('current_index', 0)

    if not playlist:
        return jsonify({'file': None})

    current_file = playlist[idx]
    return jsonify({'file': f"/visualizer/file/{current_file}"})


@app.route('/next')
def next_track():
    playlist = session.get('playlist', [])
    current_index = session.get('current_index', -1)

    if not playlist:
        return jsonify({'file': None, 'playlist': []})

    # następny indeks
    next_index = current_index + 1
    if next_index >= len(playlist):
        next_index = 0  # lub None, jeśli chcesz kończyć

    session['current_index'] = next_index
    next_file = playlist[next_index]
    return jsonify({'file': f"/visualizer/file/{next_file}", 'playlist': playlist})




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
    # Aktualizacja current_index, jeśli usuwany plik był wcześniej w kolejce
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
        return jsonify({'status': 'success', 'file': f"/visualizer/file/{playlist[index]}"})
    return jsonify({'status': 'error', 'message': 'Invalid index'})



if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8989, debug=True)

