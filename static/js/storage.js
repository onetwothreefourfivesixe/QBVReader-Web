// Storage management for client files
class StorageManager {
    constructor() {
        this.userId = null;
        this.lastInteractionTime = Date.now();
        this.cleanupInterval = null;
        this.CLEANUP_TIMEOUT = 5 * 60 * 1000; // 10 minutes in milliseconds
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

            this.updateLastInteractionTime();
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    // Method to be called when the page is unloaded
    async cleanupOnUnload() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        await this.performCleanup();
    }
}

// Create and export the storage manager instance
const storageManager = new StorageManager();

// Handle tab/browser closure
window.addEventListener('beforeunload', (event) => {
    // Prevent immediate closure to allow cleanup
    event.preventDefault();
    storageManager.cleanupOnUnload();
    // Chrome requires returnValue to be set
    event.returnValue = '';
});

export { storageManager };

