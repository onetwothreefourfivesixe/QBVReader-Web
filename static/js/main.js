import { Tossup } from './tossup.js';

document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('audio');
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
    const toggleCorrectButton = document.getElementById('toggleCorrect');
    const pauseButton = document.getElementById('pauseButton');
    const resetScoresButton = document.getElementById('resetScores');

    // Score elements
    const powerScoreElement = document.getElementById('powerScore');
    const tenScoreElement = document.getElementById('tenScore');
    const negScoreElement = document.getElementById('negScore');
    const totalScoreElement = document.getElementById('totalScore');

    let tossup = null;
    let isPlaying = false;
    let isBuzzed = false;
    let isCorrect = false;
    let isPaused = false;
    let isGenerating = false;  // Add this at the top with other state variables
    let buzzTimerInterval = null;
    let answerTimerInterval = null;
    let lastBuzzType = null; // 'power', 'regular', or 'neg'

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
        toggleCorrectButton.classList.remove('hidden');
        lastBuzzType = tossup.isPower ? 'power' : 'regular';
        if (!isCorrect) {
            lastBuzzType = 'neg';
        }

        // Set initial button state
        if (isCorrect) {
            toggleCorrectButton.classList.add('correct');
            toggleCorrectButton.classList.remove('incorrect');
            toggleCorrectButton.textContent = 'Mark as Incorrect';
        } else {
            toggleCorrectButton.classList.add('incorrect');
            toggleCorrectButton.classList.remove('correct');
            toggleCorrectButton.textContent = 'Mark as Correct';
        }
    }

    // Function to start the buzz timer
    function startBuzzTimer() {
        let timeLeft = 8;
        buzzTimerValue.textContent = timeLeft;

        // Show timer display and buzz timer
        document.querySelector('.timer-display').classList.remove('hidden');
        document.querySelector('.timer-display').classList.add('active');
        buzzTimer.classList.remove('hidden');

        buzzTimerInterval = setInterval(() => {
            timeLeft--;
            buzzTimerValue.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(buzzTimerInterval);
                // Hide both timer display and buzz timer
                document.querySelector('.timer-display').classList.remove('active');
                document.querySelector('.timer-display').classList.add('hidden');
                buzzTimer.classList.add('hidden');

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

        // Show timer display and answer timer
        document.querySelector('.timer-display').classList.remove('hidden');
        document.querySelector('.timer-display').classList.add('active');
        answerTimer.classList.remove('hidden');

        answerTimerInterval = setInterval(() => {
            timeLeft--;
            answerTimerValue.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(answerTimerInterval);
                // Hide both timer display and answer timer
                document.querySelector('.timer-display').classList.remove('active');
                document.querySelector('.timer-display').classList.add('hidden');
                answerTimer.classList.add('hidden');

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
        // Hide timers and timer display
        document.querySelector('.timer-display').classList.remove('active');
        document.querySelector('.timer-display').classList.add('hidden');
        buzzTimer.classList.add('hidden');
        answerTimer.classList.add('hidden');
    }

    // Function to handle buzz
    function handleBuzz() {
        if (tossup && !isBuzzed) {
            isBuzzed = true;
            buzzButton.disabled = true;
            pauseButton.disabled = true; // Disable pause button when buzzed
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
            document.querySelector('.timer-display').classList.add('hidden');

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

                    // Show power status in the notification
                    const powerStatus = tossup.isPower ? "Power!" : "Regular";
                    showNotification(`${result.message} (${powerStatus})`);
                } else {
                    // Handle prompt or incorrect answer
                    if (result.message === 'Prompt!') {
                        // For prompts, allow re-entering answer
                        answerInput.value = '';
                        answerInput.disabled = false;
                        submitAnswer.disabled = false;
                        answerInput.focus();
                        showNotification('Prompt! Please try to improve your answer.');
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
                        showNotification(result.message);
                    }
                }
            } catch (error) {
                console.error('Error checking answer:', error);
                showNotification('Failed to check answer. Please try again.');
            }
        }
    }

    // Function to check if an input is focused
    function isInputFocused() {
        return document.activeElement.tagName.toLowerCase() === 'input';
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

    async function handleNextTossup() {
        // Prevent multiple simultaneous requests
        if (isGenerating) {
            console.log('Already generating tossup, please wait...');
            return;
        }

        try {
            isGenerating = true;
            nextButton.disabled = true;  // Disable button while generating

            // Reset pause state if paused
            if (isPaused) {
                isPaused = false;
                pauseButton.textContent = 'Pause';
                pauseButton.style.backgroundColor = '#ffc107';
            }

            // Ensure audio is fully stopped
            audio.pause();

            // Clear any existing tossup
            if (tossup) {
                tossup.cleanup();
            }

            // ...rest of your existing handleNextTossup code...
            toggleCorrectButton.classList.add('hidden');
            try {
                console.log('Next button clicked - starting tossup generation');

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

                    // Enable pause button when new tossup is loaded
                    pauseButton.disabled = false;

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
            } finally {
                isGenerating = false;
                nextButton.disabled = false;  // Re-enable button
            }
        } catch (error) {
            console.error('Error in handleNextTossup:', error);
            alert('An error occurred while generating the tossup. Please try again.');
        }
    }

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
        // Disable pause button when audio ends
        pauseButton.disabled = true;
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

    // Add toggle correct button handler
    toggleCorrectButton.addEventListener('click', () => {
        // Toggle the correct/incorrect state
        isCorrect = !isCorrect;

        // Handle score changes
        if (isCorrect) {
            // If changing from incorrect to correct
            scores.negs--; // Remove the neg
            if (tossup.isPower) {
                scores.powers++; // Add power if it was in power
                lastBuzzType = 'power';
            } else {
                scores.tens++; // Add ten if not in power
                lastBuzzType = 'regular';
            }
        } else {
            // If changing from correct to incorrect
            if (lastBuzzType === 'power') {
                scores.powers--; // Remove power
            } else if (lastBuzzType === 'regular') {
                scores.tens--; // Remove ten
            }
            scores.negs++; // Add neg
            lastBuzzType = 'neg';
        }

        // Update button appearance
        toggleCorrectButton.classList.toggle('correct', isCorrect);
        toggleCorrectButton.classList.toggle('incorrect', !isCorrect);
        toggleCorrectButton.textContent = isCorrect ? 'Mark as Incorrect' : 'Mark as Correct';

        // Update score display
        updateScoreDisplay();
    });

    // Load settings when page loads
    loadSettings();

    // Save settings before page unloads
    window.addEventListener('beforeunload', saveSettings);

    // Save settings when they change
    document.querySelectorAll('.settings-input').forEach(input => {
        input.addEventListener('change', saveSettings);
    });

    // Add event listeners for pause functionality
    pauseButton.addEventListener('click', handlePause);
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'p' && !e.repeat && !isInputFocused()) {
            handlePause();
        }
    });

    resetScoresButton.addEventListener('click', async () => {
        if (confirm('Are you sure you want to reset all scores? This cannot be undone.')) {
            try {
                const response = await fetch('/reset-scores', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to reset scores');
                }

                // Reset local scores object
                scores.powers = 0;
                scores.tens = 0;
                scores.negs = 0;

                // Update the display
                updateScoreDisplay();

                // Show success notification
                showNotification('Scores have been reset successfully');

            } catch (error) {
                console.error('Error resetting scores:', error);
                showNotification('Failed to reset scores', 'error');
            }
        }
    });

    async function saveSettings() {
        try {
            const settings = {
                difficulties: getSelectedDifficulties(),
                subjects: getSelectedSubjects(),
                readingSpeed: parseFloat(document.getElementById('reading-speed').value),
                showText: document.getElementById('show-text-toggle').checked,
                powers: parseInt(document.getElementById('powerScore').textContent),
                tens: parseInt(document.getElementById('tenScore').textContent),
                negs: parseInt(document.getElementById('negScore').textContent),
                total: parseInt(document.getElementById('totalScore').textContent),
                goals: {
                    powers: parseInt(document.getElementById('powerGoal').value) || 0,
                    tens: parseInt(document.getElementById('tenGoal').value) || 0,
                    negs: parseInt(document.getElementById('negGoal').value) || 0,
                    total: parseInt(document.getElementById('totalGoal').value) || 0
                }
            };

            const response = await fetch('/save-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            if (!response.ok) {
                throw new Error('Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    // Update loadSettings function to handle goals
    async function loadSettings() {
        try {
            const response = await fetch('/load-settings');
            const data = await response.json();

            if (data.success && data.settings) {
                // Apply existing game settings
                if (data.settings.difficulties) {
                    setSelectedDifficulties(data.settings.difficulties);
                }
                if (data.settings.subjects) {
                    setSelectedSubjects(data.settings.subjects);
                }
                if (data.settings.readingSpeed) {
                    document.getElementById('reading-speed').value = data.settings.readingSpeed;
                    document.getElementById('reading-speed-value').textContent = `${data.settings.readingSpeed}x`;
                }
                if (data.settings.showText !== undefined) {
                    document.getElementById('show-text-toggle').checked = data.settings.showText;
                }

                // Load goals
                if (data.settings.goals) {
                    document.getElementById('powerGoal').value = data.settings.goals.powers || 0;
                    document.getElementById('tenGoal').value = data.settings.goals.tens || 0;
                    document.getElementById('negGoal').value = data.settings.goals.negs || 0;
                    document.getElementById('totalGoal').value = data.settings.goals.total || 0;
                }
            }

            if (data.success && data.scores) {
                // Apply scores
                document.getElementById('powerScore').textContent = data.scores.powers || '0';
                document.getElementById('tenScore').textContent = data.scores.tens || '0';
                document.getElementById('negScore').textContent = data.scores.negs || '0';
                document.getElementById('totalScore').textContent = data.scores.total || '0';
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    function getSelectedDifficulties() {
        return Array.from(document.querySelectorAll('input[name="difficulty"]:checked'))
            .map(cb => cb.value);
    }

    function getSelectedSubjects() {
        return Array.from(document.querySelectorAll('input[name="subject"]:checked"'))
            .map(cb => cb.value);
    }

    function setSelectedDifficulties(difficulties) {
        document.querySelectorAll('input[name="difficulty"]').forEach(cb => {
            cb.checked = difficulties.includes(cb.value);
        });
    }

    function setSelectedSubjects(subjects) {
        document.querySelectorAll('input[name="subject"]').forEach(cb => {
            cb.checked = subjects.includes(cb.value);
        });
    }

    // When showing the buzz timer
    function showBuzzTimer() {
        document.querySelector('.timer-display').classList.add('active');
        document.querySelector('.buzz-timer').classList.remove('hidden');
        // ...rest of your timer code
    }

    // When showing the answer timer
    function showAnswerTimer() {
        document.querySelector('.timer-display').classList.add('active');
        document.querySelector('.answer-timer').classList.remove('hidden');
        // ...rest of your timer code
    }

    // When hiding the timers
    function hideTimers() {
        document.querySelector('.timer-display').classList.remove('active');
        document.querySelector('.buzz-timer').classList.add('hidden');
        document.querySelector('.answer-timer').classList.add('hidden');
    }

    function showNotification(message, duration = 3000) {
        const notification = document.querySelector('.notification');
        const messageElement = notification.querySelector('.notification-message');
        messageElement.textContent = message;
        notification.classList.remove('hidden');
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.classList.add('hidden'), 300);
        }, duration);
    }

    async function handlePause() {
        if (!tossup) return;

        isPaused = !isPaused;
        if (isPaused) {
            audio.pause();
            pauseButton.textContent = 'Resume';
            pauseButton.classList.add('resumed');
        } else {
            try {
                await audio.play();
                pauseButton.textContent = 'Pause';
                pauseButton.classList.remove('resumed');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error playing audio:', error);
                }
            }
        }
    }

    // Event listeners
    nextButton.addEventListener('click', handleNextTossup);
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'n' || e.key === 'N') && !isInputFocused() && !isGenerating) {
            handleNextTossup();
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
        // Disable pause button when audio ends
        pauseButton.disabled = true;
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

    // Load settings when page loads
    loadSettings();

    // Save settings before page unloads
    window.addEventListener('beforeunload', saveSettings);

    // Save settings when they change
    document.querySelectorAll('.settings-input').forEach(input => {
        input.addEventListener('change', saveSettings);
    });
});