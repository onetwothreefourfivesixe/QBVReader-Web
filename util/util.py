import json
import os
import shutil
import time
import uuid

from flask import Flask, session

from util.audio import generateTossupTextSync, saveTossupSpeaking

# How many previously read tossups keep their audio on disk per session, so
# they can be replayed from the history list. Mirrored by MAX_HISTORY in
# static/js/history.js — entries beyond this can no longer be played back.
MAX_STORED_TOSSUPS = 20

# A session's folder is reaped once it has gone this long without a new tossup.
SESSION_TTL_SECONDS = 6 * 60 * 60

def get_or_create_user_id():
    """Get the user ID from session or create a new one if it doesn't exist."""
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    return session['user_id']

def get_user_folder(app: Flask, user_id):
    """Get the path to the user's folder and ensure it exists."""
    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], user_id)
    os.makedirs(user_folder, exist_ok=True)
    return user_folder

def create_tossup_folder(user_folder):
    """Create a folder to hold a single tossup's files.

    Each tossup gets its own folder so that reading a new one does not
    overwrite the audio of the ones already read this session.
    """
    tossup_id = uuid.uuid4().hex[:12]
    tossup_folder = os.path.join(user_folder, tossup_id)
    os.makedirs(tossup_folder, exist_ok=True)
    return tossup_id, tossup_folder

def prune_tossup_folders(user_folder, keep=MAX_STORED_TOSSUPS):
    """Keep only the `keep` most recently created tossup folders.

    Returns the ids of the folders that were removed so the client can mark
    those history entries as no longer playable.
    """
    if not os.path.isdir(user_folder):
        return []

    folders = []
    for name in os.listdir(user_folder):
        path = os.path.join(user_folder, name)
        if os.path.isdir(path):
            folders.append((os.path.getmtime(path), name, path))
        else:
            # Loose files can only be left over from the old single-tossup
            # layout, where everything lived in the root of the user folder.
            try:
                os.unlink(path)
            except OSError as e:
                print(f"Error deleting stale file {path}: {e}")

    folders.sort(reverse=True)

    removed = []
    for _, name, path in folders[keep:]:
        try:
            shutil.rmtree(path)
            removed.append(name)
        except OSError as e:
            print(f"Error deleting tossup folder {path}: {e}")
    return removed

def sweep_stale_sessions(upload_folder, keep_user_id=None, max_age_seconds=SESSION_TTL_SECONDS):
    """Delete the folders of sessions that have gone quiet.

    A browser cannot be relied on to tell us when its tab was closed, so
    abandoned folders are reaped opportunistically whenever anyone reads a
    tossup. The folder's own mtime is the time its last tossup was generated,
    since every tossup creates a new sub-folder inside it.
    """
    if not os.path.isdir(upload_folder):
        return 0

    cutoff = time.time() - max_age_seconds
    removed = 0
    for name in os.listdir(upload_folder):
        if name == keep_user_id or name.startswith('.'):
            continue

        path = os.path.join(upload_folder, name)
        if not os.path.isdir(path):
            continue

        try:
            if os.path.getmtime(path) < cutoff:
                shutil.rmtree(path)
                removed += 1
        except OSError as e:
            print(f"Error sweeping stale session {path}: {e}")
    return removed

def clear_user_folder(user_folder):
    """Remove everything in the user's folder, including per-tossup folders."""
    if not os.path.isdir(user_folder):
        return

    for name in os.listdir(user_folder):
        path = os.path.join(user_folder, name)
        try:
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.unlink(path)
        except OSError as e:
            print(f"Error deleting {path}: {e}")

def get_file_paths(tossup_folder):
    """Get the paths for all required files for a single tossup."""
    return {
        'audio': os.path.join(tossup_folder, 'audio.mp3'),
        'text': os.path.join(tossup_folder, 'text.txt'),
        'power': os.path.join(tossup_folder, 'power.json'),
        'sync': os.path.join(tossup_folder, 'sync.json')
    }

def generate_tossup_files(file_paths, client, difficulties, subjects, readingSpeed):
    """Generate all required files for a tossup."""
    # Fetch tossup data
    from util.fetchQuestions import fetchTossup
    tossup, answer_sanitized, answerLine, setName = fetchTossup(difficulties, subjects)
    
    # Save the tossup with the correct file paths
    powerMarkPositions = saveTossupSpeaking(
        text=tossup, 
        speaking_speed=readingSpeed,
        textPath=file_paths['text'],
        audioPath=file_paths['audio'],
        powerMarkPath=file_paths['power'],
        client=client
    )
    
    # Generate sync map
    generateTossupTextSync(
        audio_file_path=file_paths['audio'],
        text_file_path=file_paths['text'],
        sync_map_file_path=file_paths['sync'],
    )

    return tossup, answerLine, setName, powerMarkPositions

def read_sync_map(sync_map_path):
    """Read and return the sync map from file."""
    sync_map = {}
    if os.path.exists(sync_map_path):
        try:
            with open(sync_map_path, 'r') as f:
                sync_map = json.load(f)
        except Exception as e:
            print(f"Error reading sync map file: {e}")
    return sync_map