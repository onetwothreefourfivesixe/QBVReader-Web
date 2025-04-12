import { Tossup } from './tossup.js';
import { storageManager } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('audio');
    const audioSource = document.getElementById('audioSource');
    const nextButton = document.getElementById('nextTossup');
    const showTextToggle = document.getElementById('show-text-toggle');
    const allowRebuzzToggle = document.getElementById('allow-rebuzz-toggle');
    const textDisplay = document.querySelector('.text-display');
    const tossupTextElement = document.querySelector('.tossup-text');
    const setNameElement = document.querySelector('.set-name');
    const answerElement = document.getElementById('answer');
    const tossupMetadata = document.querySelector('.tossup-metadata');
    const textToggleContainer = document.querySelector('.text-display-controls');
    const buzzButton = document.getElementById('buzzButton');
    const answerInput = document.getElementById('answerInput');
    const submitAnswer = document.getElementById('submitAnswer');
    const progressContainer = document.querySelector('.progress-container');
    const progressBar = document.querySelector('.progress-bar');
    const buzzTimer = document.querySelector('.buzz-timer');
    const answerTimer = document.querySelector('.answer-timer');
    const buzzTimerValue = buzzTimer.querySelector('.timer-value');
    const answerTimerValue = answerTimer.querySelector('.timer-value');
    const readingSpeedSlider = document.getElementById('reading-speed');
    const readingSpeedValue = document.getElementById('reading-speed-value');

    // Score elements
    const powerScoreElement = document.getElementById('powerScore');
    const tenScoreElement = document.getElementById('tenScore');
    const negScoreElement = document.getElementById('negScore');
    const totalScoreElement = document.getElementById('totalScore');

    let tossup = null;
    let isPlaying = false;
    let isBuzzed = false;
    let isCorrect = false;
    let buzzTimerInterval = null;
    let answerTimerInterval = null;

    // Score tracking
    let scores = {
        powers: 0,
        tens: 0,
        negs: 0,
        get total() {
            return (this.powers * 15) + (this.tens * 10) - (this.negs * 5);
        }
    };

    // Function to update metadata and text display
    function updateMetadataAndText() {
        if (tossup) {
            tossupMetadata.classList.remove('hidden');
            setNameElement.textContent = `Set: ${tossup.setName || ''}`;
            // Store the answer but don't display it yet
            answerElement.innerHTML = tossup.answer || '';
            tossupTextElement.textContent = '';
            textToggleContainer.classList.remove('hidden');
            // Only show text display if toggle is checked
            textDisplay.classList.toggle('hidden', !showTextToggle.checked);
            buzzButton.disabled = false;
            answerInput.disabled = true;
            submitAnswer.disabled = true;
            isBuzzed = false;
            isCorrect = false;

            // Show progress bar and reset it
            progressContainer.classList.remove('hidden');
            progressBar.style.width = '0%';
            progressBar.style.display = 'block';
            progressContainer.style.display = 'block';

            // Hide answer input container by default
            const answerInputContainer = document.querySelector('.answer-input-container');
            answerInputContainer.classList.add('hidden');
            answerInputContainer.classList.remove('visible');
        }
    }

    // Function to update score display
    function updateScoreDisplay() {
        powerScoreElement.textContent = scores.powers;
        tenScoreElement.textContent = scores.tens;
        negScoreElement.textContent = scores.negs;
        totalScoreElement.textContent = scores.total;
    }

    // Function to end the tossup (called when time runs out or answer is correct)
    function endTossup() {
        // Show both text and answer
        textDisplay.classList.remove('hidden');
        document.querySelector('.answer-display').classList.remove('hidden');

        // Mark the buzz point in the text
        const markedText = tossup.markBuzzPoint(audio.currentTime);
        if (markedText) {
            tossupTextElement.textContent = markedText;
        }
    }

    // Function to start the buzz timer
    function startBuzzTimer() {
        let timeLeft = 8;
        buzzTimerValue.textContent = timeLeft;
        buzzTimer.classList.remove('hidden');

        buzzTimerInterval = setInterval(() => {
            timeLeft--;
            buzzTimerValue.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(buzzTimerInterval);
                buzzTimer.classList.add('hidden');
                // End the tossup if no one buzzed
                if (!isBuzzed) {
                    endTossup();
                    audio.pause();
                }
            }
        }, 1000);
    }

    // Function to start the answer timer
    function startAnswerTimer() {
        let timeLeft = 10;
        answerTimerValue.textContent = timeLeft;
        answerTimer.classList.remove('hidden');

        answerTimerInterval = setInterval(() => {
            timeLeft--;
            answerTimerValue.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(answerTimerInterval);
                answerTimer.classList.add('hidden');
                // Submit the answer if the timer runs out
                if (isBuzzed) {
                    handleAnswerSubmission();
                }
            }
        }, 1000);
    }

    // Function to clear all timers
    function clearTimers() {
        if (buzzTimerInterval) {
            clearInterval(buzzTimerInterval);
            buzzTimerInterval = null;
        }
        if (answerTimerInterval) {
            clearInterval(answerTimerInterval);
            answerTimerInterval = null;
        }
        buzzTimer.classList.add('hidden');
        answerTimer.classList.add('hidden');
    }

    // Function to handle buzz
    function handleBuzz() {
        if (tossup && !isBuzzed) {
            isBuzzed = true;
            buzzButton.disabled = true;
            answerInput.disabled = false;
            submitAnswer.disabled = false;
            audio.pause();

            // Clear buzz timer and start answer timer
            clearInterval(buzzTimerInterval);
            buzzTimer.classList.add('hidden');
            startAnswerTimer();

            // Show answer input container
            const answerInputContainer = document.querySelector('.answer-input-container');
            answerInputContainer.classList.remove('hidden');
            answerInputContainer.classList.add('visible');

            // Focus the answer input box
            answerInput.focus();
        }
    }

    // Function to handle answer submission
    async function handleAnswerSubmission() {
        if (tossup && isBuzzed) {
            // Clear answer timer
            clearInterval(answerTimerInterval);
            answerTimer.classList.add('hidden');

            const userAnswer = answerInput.value.trim();

            try {
                const result = await tossup.checkAnswer(userAnswer);

                // Disable input
                answerInput.disabled = true;
                submitAnswer.disabled = true;

                // Show answer if correct
                if (result.is_correct) {
                    isCorrect = true;
                    endTossup();
                    audio.pause();

                    // Update score based on power status
                    if (tossup.isPower) {
                        scores.powers++;
                    } else {
                        scores.tens++;
                    }
                    updateScoreDisplay();

                    // Show power status in the alert
                    const powerStatus = tossup.isPower ? "Power!" : "Regular";
                    alert(`${result.message} (${powerStatus})`);
                } else {
                    // Handle prompt or incorrect answer
                    if (result.message === 'Prompt!') {
                        // For prompts, allow re-entering answer
                        answerInput.value = '';
                        answerInput.disabled = false;
                        submitAnswer.disabled = false;
                        answerInput.focus();
                        alert('Prompt! Please try to improve your answer.');
                    } else {
                        // Handle incorrect answer based on re-buzz setting
                        scores.negs++;
                        updateScoreDisplay();
                        if (allowRebuzzToggle.checked) {
                            // Allow re-buzzing
                            isBuzzed = false;
                            buzzButton.disabled = false;
                            answerInput.value = '';
                            answerInput.disabled = true;
                            submitAnswer.disabled = true;

                            // Hide answer input container
                            const answerInputContainer = document.querySelector('.answer-input-container');
                            answerInputContainer.classList.add('hidden');
                            answerInputContainer.classList.remove('visible');

                            // Continue audio
                            audio.play().catch(error => {
                                console.error('Error playing audio:', error);
                            });
                        } else {
                            // End tossup on incorrect answer
                            endTossup();
                            audio.pause();
                        }
                        alert(result.message);
                    }
                }
            } catch (error) {
                console.error('Error checking answer:', error);
                alert('Failed to check answer. Please try again.');
            }
        }
    }

    // Event listeners
    buzzButton.addEventListener('click', handleBuzz);
    submitAnswer.addEventListener('click', handleAnswerSubmission);
    answerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleAnswerSubmission();
        }
    });

    // Update reading speed display
    readingSpeedSlider.addEventListener('input', () => {
        readingSpeedValue.textContent = `${readingSpeedSlider.value}x`;
    });

    // Next button event listener
    nextButton.addEventListener('click', async () => {
        try {
            console.log('Next button clicked - starting tossup generation');
            // Update last interaction time
            storageManager.updateLastInteractionTime();

            // Clear any existing timers
            clearTimers();

            const difficulties = Array.from(document.querySelectorAll('input[name="difficulty"]:checked')).map(checkbox => checkbox.value);
            const subjects = Array.from(document.querySelectorAll('input[name="subject"]:checked')).map(checkbox => checkbox.value);
            const readingSpeed = parseFloat(readingSpeedSlider.value);

            console.log('Selected settings:', { difficulties, subjects, readingSpeed });

            // Reset UI state
            buzzButton.disabled = false;
            answerInput.disabled = true;
            submitAnswer.disabled = true;
            isBuzzed = false;
            isCorrect = false;

            // Clean up previous tossup if it exists
            if (tossup) {
                console.log('Cleaning up previous tossup');
                tossup.cleanup();
            }

            // Clear the text display and reset UI state
            tossupTextElement.textContent = '';
            document.querySelector('.answer-display').classList.add('hidden');
            const answerInputContainer = document.querySelector('.answer-input-container');
            answerInputContainer.classList.add('hidden');
            answerInputContainer.classList.remove('visible');

            // Set text display based on toggle setting
            console.log('Text display toggle:', showTextToggle.checked);
            if (!showTextToggle.checked) {
                console.log('Hiding text display');
                textDisplay.classList.add('hidden');
            } else {
                console.log('Showing text display');
                textDisplay.classList.remove('hidden');
            }

            // Create new tossup with reading speed
            console.log('Creating new tossup');
            tossup = new Tossup(difficulties, subjects, readingSpeed);

            console.log('Generating tossup...');
            const success = await tossup.generate();
            console.log('Tossup generation result:', success);

            // Update UI
            if (success) {
                console.log('Updating UI with new tossup');
                updateMetadataAndText();

                // Reset audio
                console.log('Resetting audio');
                audio.pause();
                audio.currentTime = 0;

                // Create a new audio source to force reload
                console.log('Creating new audio source');
                const newSource = document.createElement('source');
                const audioUrl = tossup.audioPath + '?t=' + new Date().getTime();
                console.log('Audio URL:', audioUrl);
                newSource.src = audioUrl;
                newSource.type = 'audio/mpeg';

                // Remove existing sources and add the new one
                while (audio.firstChild) {
                    audio.removeChild(audio.firstChild);
                }
                audio.appendChild(newSource);

                // Load the new audio
                console.log('Loading new audio');
                await audio.load();

                // Reset buzz state
                isBuzzed = false;
                buzzButton.disabled = false;
                answerInput.disabled = true;
                submitAnswer.disabled = true;
                answerInput.value = '';

                // Start playing audio
                try {
                    console.log('Attempting to play audio');
                    const playPromise = audio.play();
                    if (playPromise !== undefined) {
                        playPromise.then(() => {
                            console.log('Audio playback started successfully');
                            // Start text sync if toggle is checked
                            if (showTextToggle.checked) {
                                console.log('Starting text sync');
                                tossup.startTextSync(tossupTextElement, audio);
                            }
                        }).catch(error => {
                            console.error('Error playing audio:', error);
                            alert('Failed to play audio. Please check your browser settings and try again.');
                        });
                    }
                } catch (error) {
                    console.error('Error in audio playback:', error);
                    alert('Failed to play audio. Please check your browser settings and try again.');
                }
            }
        } catch (error) {
            console.error('Error in next button handler:', error);
            alert('Failed to generate tossup. Please try again.');
        }
    });

    // Audio event listeners
    audio.addEventListener('play', () => {
        buzzButton.disabled = false;
        if (tossup && showTextToggle.checked) {
            tossup.startTextSync(tossupTextElement, audio);
        }
    });

    // audio.addEventListener('pause', () => {
    //     if (!isBuzzed) {
    //         buzzButton.disabled = true;
    //     }
    // });

    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            const progress = (audio.currentTime / audio.duration) * 100;
            progressBar.style.width = `${progress}%`;
        }
    });

    audio.addEventListener('seeking', () => {
        if (tossup && showTextToggle.checked) {
            tossup.startTextSync(tossupTextElement, audio);
        }
    });

    audio.addEventListener('ended', () => {
        // Start 8-second buzz timer when tossup ends
        startBuzzTimer();
    });

    // progressContainer.addEventListener('click', (e) => {
    //     if (!isBuzzed) {
    //         const rect = progressContainer.getBoundingClientRect();
    //         const pos = (e.clientX - rect.left) / rect.width;
    //         audio.currentTime = pos * audio.duration;
    //     }
    // });

    // Text toggle event listener
    showTextToggle.addEventListener('change', () => {
        textDisplay.classList.toggle('hidden', !showTextToggle.checked);
        if (showTextToggle.checked && tossup) {
            // Only start text sync if the audio is still playing
            if (!audio.paused) {
                tossup.startTextSync(tossupTextElement, audio);
            } else if (tossup.displayedText) {
                // If audio is paused, show the full text
                let fullText = '';
                if (tossup.syncMap && tossup.syncMap.fragments) {
                    // Build the full text from all fragments
                    tossup.syncMap.fragments.forEach((fragment, i) => {
                        if (fragment.lines && fragment.lines.length > 0) {
                            if (i > 0 && !(/^[.,!?;:)]/.test(fragment.lines[0]))) {
                                fullText += ' ';
                            }
                            fullText += fragment.lines[0];
                        }
                    });
                }
                tossupTextElement.textContent = fullText;
            }
        }
    });

    // Add keyboard event listener
    document.addEventListener('keydown', (event) => {
        // Only handle shortcuts if not in answer input
        if (document.activeElement !== answerInput) {
            if (event.key === 'n' || event.key === 'N') {
                nextButton.click();
            } else if (event.key === ' ') {
                // Prevent spacebar from scrolling the page
                event.preventDefault();
                buzzButton.click();
            }
        }
    });

    // Add error event listener for audio
    audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        alert('Error loading audio. Please try again.');
    });

    // Add loadeddata event listener for audio
    audio.addEventListener('loadeddata', () => {
        console.log('Audio data loaded successfully');
    });
});