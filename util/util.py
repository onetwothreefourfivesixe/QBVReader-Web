import json
import os
import uuid

from flask import Flask, session

from util.audio import generateTossupTextSync, saveTossupSpeaking

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

def clear_user_folder(user_folder):
    """Clear all files in the user's folder."""
    for file in os.listdir(user_folder):
        file_path = os.path.join(user_folder, file)
        try:
            if os.path.isfile(file_path):
                os.unlink(file_path)
        except Exception as e:
            print(f"Error deleting file {file_path}: {e}")

def get_file_paths(user_folder):
    """Get the paths for all required files in the user's folder."""
    return {
        'audio': os.path.join(user_folder, 'audio.mp3'),
        'text': os.path.join(user_folder, 'text.txt'),
        'power': os.path.join(user_folder, 'power.json'),
        'sync': os.path.join(user_folder, 'sync.json')
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