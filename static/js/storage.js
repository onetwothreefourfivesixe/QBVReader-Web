// Manages the temporary files the server keeps for this session.
//
// Every tossup that gets read leaves an audio folder behind so it can be
// replayed from the history list, so cleanup only happens once the tab has
// been left alone long enough that the session is clearly over. Folders
// belonging to tabs that were simply closed are reaped server-side by the
// stale-session sweep in util/util.py.

class StorageManager {
    constructor({ onCleanup } = {}) {
        this.userId = null;
        this.onCleanup = onCleanup;
        this.lastInteractionTime = Date.now();
        this.cleanupInterval = null;
        // Long enough that stepping away mid-session does not cost you the
        // tossups you have already read
        this.CLEANUP_TIMEOUT = 60 * 60 * 1000; // 1 hour
        this.initialize();
    }

    async initialize() {
        // Get user ID from server
        try {
            const response = await fetch('/get-user-id');
            if (response.ok) {
                const data = await response.json();
                this.userId = data.userId;
            } else {
                console.error('Failed to get user ID from server');
            }
        } catch (error) {
            console.error('Error getting user ID:', error);
        }

        // Start cleanup interval
        this.startCleanupInterval();

        // Add event listeners for user interaction
        this.setupInteractionListeners();
    }

    setupInteractionListeners() {
        // Update last interaction time on any user interaction
        const events = ['mousedown', 'keydown', 'touchstart', 'click'];
        events.forEach(event => {
            document.addEventListener(event, () => {
                this.updateLastInteractionTime();
            });
        });
    }

    updateLastInteractionTime() {
        this.lastInteractionTime = Date.now();
    }

    startCleanupInterval() {
        // Clear any existing interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        // Start new interval
        this.cleanupInterval = setInterval(() => {
            this.checkAndCleanup();
        }, 60000); // Check every minute
    }

    async checkAndCleanup() {
        const timeSinceLastInteraction = Date.now() - this.lastInteractionTime;

        if (timeSinceLastInteraction >= this.CLEANUP_TIMEOUT) {
            await this.performCleanup();
        }
    }

    async performCleanup() {
        if (!this.userId) return;

        try {
            const response = await fetch('/cleanup-files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.userId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to cleanup files');
            }

            // The history list would otherwise keep offering replays for audio
            // that no longer exists
            if (this.onCleanup) {
                this.onCleanup();
            }

            this.updateLastInteractionTime();
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
}

export { StorageManager };
