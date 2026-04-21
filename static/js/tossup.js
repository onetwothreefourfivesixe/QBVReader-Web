export class Tossup {
    constructor(difficulties, subjects, readingSpeed = 1.0) {
        this.difficulties = difficulties;
        this.subjects = subjects;
        this.readingSpeed = readingSpeed;
        this.audioPath = null;
        this.syncMap = null;
        this.answer = null;
        this.setName = null;
        this.currentWordIndex = 0;
        this.displayedText = '';
        this.textCues = [];
        this._updateTextFunction = null;
        this.powerMarkPos = null;
        this.isPower = false;
    }

    cleanup() {
        this.audioPath = null;
        this.syncMap = null;
        this.answer = null;
        this.setName = null;
        this.currentWordIndex = 0;
        this.displayedText = '';
        this.textCues = [];
        this._updateTextFunction = null;
        this.powerMarkPos = null;
        this.isPower = false;
    }

    async generate() {
        try {
            const response = await fetch('/generate-tossup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    difficulties: this.difficulties,
                    subjects: this.subjects,
                    readingSpeed: this.readingSpeed
                })
            });

            const data = await response.json();

            if (data.success) {
                this.audioPath = data.audioPath;
                this.syncMap = data.syncMap;
                this.answer = data.answer;
                this.setName = data.setName;
                this.currentWordIndex = 0;
                this.displayedText = '';
                this.powerMarkPos = data.powerMarkPos.length == 0 ? null : data.powerMarkPos[0];
                this.isPower = false;

                console.log(this.answer);

                // Process sync map to create text cues
                this.processTextCues();

                return true;
            } else {
                throw new Error(data.error || 'Failed to generate tossup');
            }
        } catch (error) {
            console.error('Error generating tossup:', error);
            throw error;
        }
    }

    getAudioPath() {
        return this.audioPath;
    }

    getSyncMap() {
        return this.syncMap;
    }

    getAnswer() {
        return this.answer;
    }

    getSetName() {
        return this.setName;
    }

    getTextCues() {
        return this.textCues;
    }

    /**
     * Process the sync map to create text cues for display
     */
    processTextCues() {
        this.textCues = [];

        if (!this.syncMap || !this.syncMap.fragments) return;

        // Create an array of [time, word] pairs from the sync map fragments
        this.syncMap.fragments.forEach(fragment => {
            if (fragment.lines && fragment.lines.length > 0) {
                // Convert begin time from string to seconds
                const startTimeInSeconds = parseFloat(fragment.begin);

                // Get the text from the first line
                const text = fragment.lines[0];

                if (text && text.trim()) {
                    this.textCues.push([startTimeInSeconds, text]);
                }
            }
        });

        // Sort cues by time just to be safe
        this.textCues.sort((a, b) => a[0] - b[0]);
    }

    /**
     * Starts text updating based on the audio time
     * @param {HTMLElement} textElement - The element to display text in
     * @param {HTMLAudioElement} audio - The audio element
     */
    startTextSync(textElement, audio) {
        if (!textElement || !audio || !this.textCues.length) return;

        // Reset the displayed text and word index
        textElement.textContent = '';
        this.currentWordIndex = 0;
        this.displayedText = '';

        // Remove any existing event listener
        if (this._updateTextFunction) {
            audio.removeEventListener('timeupdate', this._updateTextFunction);
        }

        // Define the update function
        const updateText = () => {
            const currentTime = audio.currentTime;

            // Find the last cue that should be displayed
            let lastIndex = -1;
            for (let i = 0; i < this.textCues.length; i++) {
                if (currentTime >= this.textCues[i][0]) {
                    lastIndex = i;
                } else {
                    break;
                }
            }

            // Only update if we have new text to display
            if (lastIndex >= this.currentWordIndex) {
                // Build the text up to the current point
                let newText = '';
                for (let i = 0; i <= lastIndex; i++) {
                    const text = this.textCues[i][1];
                    if (i > 0 && !(/^[.,!?;:)]/.test(text))) {
                        newText += ' ';
                    }
                    newText += text;
                }

                // Update the display
                textElement.textContent = newText;
                this.currentWordIndex = lastIndex + 1;
                this.displayedText = newText;
            }
        };

        // Store the update function for cleanup
        this._updateTextFunction = updateText;

        // Add event listeners
        audio.addEventListener('timeupdate', this._updateTextFunction);

        // Handle ended event
        audio.addEventListener('ended', () => {
            this.currentWordIndex = 0;
        });
    }

    /**
     * Stops text syncing and cleans up
     * @param {HTMLAudioElement} audio - The audio element
     */
    stopTextSync(audio) {
        if (this._updateTextFunction && audio) {
            audio.removeEventListener('timeupdate', this._updateTextFunction);
            this._updateTextFunction = null;
        }
    }

    async checkAnswer(userAnswer) {
        try {
            const response = await fetch('/check-answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userAnswer: userAnswer,
                    correctAnswer: this.answer
                })
            });

            if (!response.ok) {
                throw new Error('Failed to check answer');
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error('Server returned unsuccessful response');
            }

            // Convert the API response to a more user-friendly format
            switch (result.result) {
                case 'accept':
                    return { is_correct: true, message: 'Correct!' };
                case 'reject':
                    return { is_correct: false, message: 'Incorrect!' };
                case 'prompt':
                    return { is_correct: false, message: 'Prompt!' };
                default:
                    throw new Error('Invalid response from server');
            }
        } catch (error) {
            console.error('Error checking answer:', error);
            throw error;
        }
    }

    markBuzzPoint(currentTime) {
        if (!this.syncMap || !this.syncMap.fragments) return null;

        // Find the fragment that was playing when the user buzzed
        let buzzFragmentIndex = -1;
        let cumulativeLength = 0;
        for (let i = 0; i < this.syncMap.fragments.length; i++) {
            const fragment = this.syncMap.fragments[i];
            if (currentTime >= fragment.begin && currentTime <= fragment.end) {
                buzzFragmentIndex = i;
                break;
            }
            // Add the length of this fragment to the cumulative length
            if (fragment.lines && fragment.lines.length > 0) {
                cumulativeLength += fragment.lines[0].length;
                // Add 1 for the space between fragments
                if (i < this.syncMap.fragments.length - 1) {
                    cumulativeLength += 1;
                }
            }
        }

        if (buzzFragmentIndex === -1) return null;

        // Determine if the buzz was before or after power mark
        this.isPower = this.powerMarkPos !== null && cumulativeLength <= this.powerMarkPos;

        // Get the text up to the buzz point
        let markedText = '';
        for (let i = 0; i <= buzzFragmentIndex; i++) {
            const fragment = this.syncMap.fragments[i];
            let fragmentText = fragment.lines[0];

            // Add power mark if this fragment contains the power mark position and powerMarkPos exists
            if (this.powerMarkPos !== null && this.powerMarkPos !== undefined) {
                const fragmentStart = markedText.length;
                const fragmentEnd = fragmentStart + fragmentText.length;
                if (this.powerMarkPos >= fragmentStart && this.powerMarkPos <= fragmentEnd) {
                    const posInFragment = this.powerMarkPos - fragmentStart;
                    fragmentText = fragmentText.slice(0, posInFragment) + '(*)' + fragmentText.slice(posInFragment);
                }
            }

            markedText += fragmentText;

            // Add buzz mark if this is the buzz fragment
            if (i === buzzFragmentIndex) {
                markedText += ' (#)';
            }

            markedText += ' ';
        }

        // Add the rest of the text
        for (let i = buzzFragmentIndex + 1; i < this.syncMap.fragments.length; i++) {
            const fragment = this.syncMap.fragments[i];
            let fragmentText = fragment.lines[0];

            // Add power mark if this fragment contains the power mark position and powerMarkPos exists
            if (this.powerMarkPos !== null && this.powerMarkPos !== undefined) {
                const fragmentStart = markedText.length;
                const fragmentEnd = fragmentStart + fragmentText.length;
                if (this.powerMarkPos >= fragmentStart && this.powerMarkPos <= fragmentEnd) {
                    const posInFragment = this.powerMarkPos - fragmentStart;
                    fragmentText = fragmentText.slice(0, posInFragment) + '(*)' + fragmentText.slice(posInFragment);
                }
            }

            markedText += fragmentText + ' ';
        }

        return markedText.trim();
    }
}
