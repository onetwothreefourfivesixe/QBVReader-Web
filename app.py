from flask import Flask, render_template, jsonify, request, send_from_directory, session
from dotenv import load_dotenv
import os
from google.cloud import texttospeech
import logging
from util.fetchQuestions import checkTossupAnswer
from util.util import clear_user_folder, generate_tossup_files, get_file_paths, get_or_create_user_id, get_user_folder, read_sync_map
from datetime import timedelta

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev')  # Needed for sessions
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=1)  # Optional: set session lifetime

# Configuration
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'static/audio')
app.config['GOOGLE_APPLICATION_CREDENTIALS'] = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
logger.info(f"Using upload folder: {app.config['UPLOAD_FOLDER']}")

# Initialize Google Cloud Text-to-Speech client
try:
    # Set the environment variable for Google credentials
    if app.config['GOOGLE_APPLICATION_CREDENTIALS']:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = app.config['GOOGLE_APPLICATION_CREDENTIALS']
        # Initialize the client
        texttospeech_client = texttospeech.TextToSpeechClient()
        logger.info("Google Cloud Text-to-Speech client initialized successfully.")
    else:
        logger.error("GOOGLE_APPLICATION_CREDENTIALS environment variable not set")
        texttospeech_client = None
except Exception as e:
    logger.error(f"Error initializing Google Cloud Text-to-Speech client: {e}")
    texttospeech_client = None

@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/play')
def play():
    get_or_create_user_id()
    return render_template('index.html')

@app.route('/install')
def install():
    return render_template('install.html')

@app.route('/changelog')
def changelog():
    return render_template('changelog.html')

@app.route('/privacy-policy')
def privacy_policy():
    return render_template('privacyPolicy.html')

@app.route('/terms-of-service')
def terms_of_service():
    return render_template('termsOfService.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/generate-tossup', methods=['POST'])
def generate_tossup():
    try:
        data = request.get_json()
        difficulties = data.get('difficulties', [])
        subjects = data.get('subjects', [])
        readingSpeed = float(data.get('readingSpeed', 1.0))

        # Format difficulties and subjects as comma-separated strings
        difficulties_str = ','.join(difficulties)
        subjects_str = ','.join(subjects)

        # Check if client is initialized
        if not texttospeech_client:
            return jsonify({
                'success': False,
                'error': 'Google Cloud Text-to-Speech client not initialized. Please check your credentials.'
            }), 500

        # Get user ID and folder
        user_id = get_or_create_user_id()
        user_folder = get_user_folder(app, user_id)
        os.makedirs(user_folder, exist_ok=True)
        
        logger.info(f"Generating tossup for user {user_id} with difficulties {difficulties_str} and subjects {subjects_str}")
        
        # Clear existing files
        clear_user_folder(user_folder)
        
        # Get file paths
        file_paths = get_file_paths(user_folder)
        
        # Generate tossup files
        tossup, answerLine, setName, power_mark_pos = generate_tossup_files(file_paths, texttospeech_client, difficulties_str, subjects_str, readingSpeed)
        
        # Read sync map
        sync_map = read_sync_map(file_paths['sync'])
        
        # Return the relative path for the audio file
        relative_path = f"/static/audio/{user_id}/audio.mp3"
        return jsonify({
            'success': True,
            'audioPath': relative_path,
            'answer': answerLine,
            'setName': setName,
            'syncMap': sync_map,
            'powerMarkPos': power_mark_pos
        })
        
    except Exception as e:
        logger.error(f"Error generating tossup: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/check-answer', methods=['POST'])
def check_answer():
    data = request.get_json()
    user_answer = data.get('userAnswer')
    correct_answer = data.get('correctAnswer')
    
    directive = checkTossupAnswer(correct_answer, user_answer)
    
    # Convert directive to result format
    result = {
        'accept': 'accept',
        'reject': 'reject',
        'prompt': 'prompt'
    }.get(directive, 'reject')
    
    return jsonify({
        'success': True,
        'result': result
    })

@app.route('/get-user-id', methods=['GET'])
def get_user_id():
    try:
        user_id = get_or_create_user_id()
        response = jsonify({
            'success': True,
            'userId': user_id
        })
        response.set_cookie('user_id', user_id, max_age=3600)  # 1 hour
        return response
    except Exception as e:
        logger.error(f"Error getting user ID: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/cleanup-files', methods=['POST'])
def cleanup_files():
    try:
        data = request.get_json()
        user_id = data.get('userId')
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'No user ID provided'
            }), 400
            
        # Get user folder
        user_folder = get_user_folder(app, user_id)
        
        # Clear user folder
        clear_user_folder(user_folder)
        
        return jsonify({
            'success': True,
            'message': 'Files cleaned up successfully'
        })
        
    except Exception as e:
        logger.error(f"Error cleaning up files: {e}")
        return jsonify({
            'success': False,
            'error': str(e)}
        ), 500

@app.route('/audio/<path:filename>')
def serve_audio(filename):
    try:
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    except Exception as e:
        logger.error(f"Error serving audio file {filename}: {e}")
        return jsonify({'error': str(e)}), 404

@app.route('/save-settings', methods=['POST'])
def save_settings():
    try:
        data = request.get_json()
        session['game_settings'] = {
            'difficulties': data.get('difficulties', []),
            'subjects': data.get('subjects', []),
            'readingSpeed': data.get('readingSpeed', 1.0),
            'showText': data.get('showText', True),
            'goals': data.get('goals', {
                'powers': 0,
                'tens': 0,
                'negs': 0,
                'total': 0
            })
        }
        session['scores'] = {
            'powers': data.get('powers', 0),
            'tens': data.get('tens', 0),
            'negs': data.get('negs', 0),
            'total': data.get('total', 0)
        }
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error saving settings: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/load-settings')
def load_settings():
    try:
        return jsonify({
            'success': True,
            'settings': session.get('game_settings', {}),
            'scores': session.get('scores', {})
        })
    except Exception as e:
        logger.error(f"Error loading settings: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/reset-scores', methods=['POST'])
def reset_scores():
    try:
        session['scores'] = {
            'powers': 0,
            'tens': 0,
            'negs': 0,
            'total': 0
        }
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error resetting scores: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    pass
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    app.run(host=host, port=port)#, debug=True)