# QBVReader - Web

**Live at [qbv-reader.com](https://www.qbv-reader.com/).**

The web version of QBVReader, a quiz bowl practice app that reads tossups aloud. Questions come
from the [QBReader](https://www.qbreader.org) database, are synthesized with Google Cloud
Text-to-Speech, and are shown on screen word by word as they are read. Buzz whenever you know
the answer, type it in, and it is checked against the answer line. Scores are tracked as
powers, tens, and negs, just like a real match.

The same project also ships as a Discord bot; the Install page in the app links to it.

## Features

- Reads tossups aloud at a reading speed you choose, from 0.75x to 1.5x.
- Shows the tossup text in sync with the audio, or hides it if you would rather listen.
- Filters by difficulty (middle school through hard college nationals) and by subject.
- Buzz with the button or the spacebar, then answer within the ten-second timer. A tossup that
  finishes without a buzz gives you eight more seconds before it is dead.
- Detects whether a buzz landed before the power mark and scores 15, 10, or -5 accordingly.
- Optional re-buzzing after a wrong answer.
- Keeps a history of the tossups read this session, each with its text, answer line, your
  answer, and a replayable copy of the audio.
- Remembers your settings and running score between visits.

Keyboard shortcuts: **N** for the next tossup, **P** to pause, **Space** to buzz.

## How a tossup is made

1. `util/fetchQuestions.py` asks the QBReader API for a random tossup matching the chosen
   difficulties and subjects.
2. `util/audio.py` strips pronunciation guides and the power mark from the text, sends the
   result to Google Cloud Text-to-Speech, and saves an MP3.
3. The same module runs [aeneas](https://github.com/readbeyond/aeneas) to align the audio with
   the text, producing a sync map of when each word is spoken.
4. `app.py` returns the audio path, the text, the answer line, the sync map, and the power-mark
   position to the browser, which plays the audio and reveals the text as it goes.
5. When you answer, the browser sends it back and `util/fetchQuestions.py` asks the QBReader
   answer checker whether it should be accepted, rejected, or prompted.

Generated files live under `static/audio/<session id>/<tossup id>/`. The server keeps the last
20 tossups per session so they can be replayed from the history list, sweeps sessions that have
been quiet for six hours, and the browser asks for its own files to be removed after an hour of
inactivity.

## Requirements

- Python 3.11
- `ffmpeg` and `espeak`, which aeneas needs for alignment
- A Google Cloud project with the Text-to-Speech API enabled and a service account key

## Setup

1. Create a virtual environment:

   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. Install the dependencies:

   ```bash
   pip install -r requirements.txt
   ```

   aeneas is deliberately not listed in `requirements.txt` because it needs NumPy 1.x. Install it
   against a pinned NumPy, as the Dockerfile does:

   ```bash
   pip install "numpy==1.26.4" "cython<3" "setuptools<70"
   pip install --no-build-isolation "aeneas==1.7.3.0"
   ```

3. Put your Google service account key in the project folder (for example `credentials.json`) and
   create a `.env` file pointing at it:

   ```
   GOOGLE_CLOUD_PROJECT=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=credentials.json
   SECRET_KEY=change-me
   ```

   Both the key file and `.env` are ignored by git.

## Running

```bash
python app.py
```

The app is available at `http://localhost:5000`. In production it runs under gunicorn:

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `SECRET_KEY` | `dev` | Signs the session cookie that holds your settings and score |
| `GOOGLE_APPLICATION_CREDENTIALS` | none | Path to the service account key; required for audio |
| `UPLOAD_FOLDER` | `static/audio` | Where generated audio is written |
| `PORT`, `HOST` | `5000`, `0.0.0.0` | Where the development server listens |

## Deployment

The production build is a Docker image based on Ubuntu 22.04 that installs the aeneas toolchain,
pins NumPy below 2.0, and starts gunicorn. `deploy.sh` builds it for `linux/amd64`, pushes it to
Google Artifact Registry, and deploys it to Cloud Run. Both files are kept out of git because they
carry project-specific values.

## Project structure

- `app.py`: Flask application, routes, and the Text-to-Speech client
- `util/fetchQuestions.py`: QBReader API calls for fetching tossups and checking answers
- `util/audio.py`: Text cleanup, speech synthesis, and audio-to-text alignment
- `util/util.py`: Session folders, retention, and cleanup of generated audio
- `templates/`: The landing, play, install, changelog, privacy policy, and terms pages
- `static/js/main.js`: The play page: settings, timers, buzzing, scoring, and keyboard shortcuts
- `static/js/tossup.js`: One tossup: fetching it, syncing the text to the audio, marking the buzz point
- `static/js/history.js`: The list of tossups read this session
- `static/js/storage.js`: Asks the server to remove this session's audio after an idle hour
- `static/css/`: Stylesheets for the play page and the content pages
- `static/audio/`: Generated audio, one folder per session (ignored by git)
