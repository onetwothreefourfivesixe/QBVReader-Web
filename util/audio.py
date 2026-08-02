import os
import re
import json
import logging
from dotenv import load_dotenv
from google.cloud import texttospeech

import numpy
import aeneas.wavfile
from aeneas.executetask import ExecuteTask
from aeneas.task import Task
from aeneas.language import Language
from aeneas.syncmap import SyncMapFormat
from aeneas.task import TaskConfiguration
from aeneas.textfile import TextFileFormat
import aeneas.globalconstants as gc

from util.fetchQuestions import fetchTossup

logger = logging.getLogger(__name__)


class _NumpyCompat:
    """Restores numpy.fromstring's binary mode for aeneas's vendored wav reader.

    aeneas has been unmaintained since 2017 and aeneas/wavfile.py still calls
    numpy.fromstring(bytes, dtype=...), which numpy removed in 2.0. Without
    this, reading the generated MP3 raises and no sync map is produced, so the
    tossup text never appears while the tossup is read.

    The Dockerfile pins numpy<2 and asserts it at build time, so this is a
    no-op in production; it only rescues local environments that ended up on
    numpy 2.x. Note that such an environment also loses aeneas's cdtw/cmfcc C
    extensions and falls back to the much slower pure-Python alignment.
    """

    def __getattr__(self, name):
        return getattr(numpy, name)

    def fromstring(self, string, dtype=float, count=-1, sep=''):
        if sep == '':
            return numpy.frombuffer(string, dtype=dtype, count=count)
        return numpy.fromstring(string, dtype=dtype, count=count, sep=sep)


# Applied unconditionally: frombuffer is equivalent to the binary mode of
# fromstring on every numpy version aeneas runs against.
aeneas.wavfile.numpy = _NumpyCompat()

# Load environment variables from .env file
load_dotenv()

def saveTossupSpeaking(text="", speaking_speed=1.0, textPath='temp/myFile.txt', audioPath='temp/audio.mp3', powerMarkPath='temp/powerMarks.txt', client=None):
    '''
    Generates speech from the given text and saves it as an MP3 file. Also writes the text content to a UTF-8 encoded file excluding sentences with quotes.

    Args:
        text (str): The text to convert to speech.
        speaking_speed (float): The speed of speech generation.
        textPath (str): Path to save the text file.
        audioPath (str): Path to save the audio file.
        powerMarkPath (str): Path to save the power mark positions.
        client (TextToSpeechClient, optional): Google Cloud Text-to-Speech client. If None, a new client will be created.

    Returns:
        str: The filename of the generated audio file.
    '''
    # Remove pronunciation guides
    powerMarkPositions = [m.start() for m in re.finditer(r'\(\*\)', text)]
    print(powerMarkPositions)

    # Remove (*) from text
    sentence = re.sub(r'\([^)]*\)|\[[^]]*\]|\{[^}]*\}|\<[^>]*\>', '', text).strip()

    # Write cleaned text to file
    with open(textPath, "w", encoding='utf-8') as output_file:
        output_file.writelines(sentence + '\n' for sentence in sentence.split())

    # Write power mark positions to a separate file
    with open(powerMarkPath, "w", encoding='utf-8') as power_file:
        power_file.write(json.dumps(powerMarkPositions))

    # Create client if not provided
    if client is None:
        # Set the environment variable for Google credentials
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if not credentials_path:
            raise Exception("Google Application Credentials not set in .env file.")
        client = texttospeech.TextToSpeechClient()

    # Generate speech with adjusted speed
    synthesis_input = texttospeech.SynthesisInput(text=sentence)
    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        ssml_gender=texttospeech.SsmlVoiceGender.MALE,
        name="en-US-Polyglot-1"
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=speaking_speed
    )

    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    # Write the audio content to a file
    with open(audioPath, "wb") as audio_file:
        audio_file.write(response.audio_content)
    #print(f'Audio content written to file "{audioPath}"')

    return powerMarkPositions


def generateTossupTextSync(audio_file_path="temp/audio.mp3", text_file_path="temp/myFile.txt", sync_map_file_path="temp/syncmap.json"):
    """Align the spoken audio to the text, word by word.

    Returns True if a sync map was written. Without one the reader cannot show
    the tossup text as it is read, so failures are logged rather than swallowed.
    """
    try:
        # Configure task
        config = TaskConfiguration()
        config[gc.PPN_TASK_LANGUAGE] = Language.ENG
        config[gc.PPN_TASK_IS_TEXT_FILE_FORMAT] = TextFileFormat.PLAIN
        config[gc.PPN_TASK_OS_FILE_FORMAT] = SyncMapFormat.JSON
        task = Task()
        task.configuration = config

        # Set file paths
        task.audio_file_path_absolute = audio_file_path
        task.text_file_path_absolute = text_file_path
        task.sync_map_file_path_absolute = sync_map_file_path

        # Process task
        ExecuteTask(task).execute()

        # Print produced sync map
        task.output_sync_map_file()

        return os.path.exists(sync_map_file_path)

    except Exception as e:
        logger.error(
            "Text/audio alignment failed for %s — the tossup text will not be "
            "shown while it is read. %s: %s",
            audio_file_path, type(e).__name__, e, exc_info=True
        )
        return False