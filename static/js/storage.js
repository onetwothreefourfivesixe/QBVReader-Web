// Storage management for client files
class StorageManager {
    constructor() {
        this.userId = null;
        this.lastInteractionTime = Date.now();
        this.cleanupInterval = null;
        this.CLEANUP_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
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
            try {
                // Call backend to cleanup files
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

                // Reset interaction time after successful cleanup
                this.updateLastInteractionTime();
            } catch (error) {
                console.error('Error during cleanup:', error);
            }
        }
    }

    // Method to be called when the page is unloaded
    cleanupOnUnload() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

// Create and export the storage manager instance
const storageManager = new StorageManager();

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
    storageManager.cleanupOnUnload();
});

export { storageManager };

