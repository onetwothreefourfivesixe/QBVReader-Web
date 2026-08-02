// Session history of the tossups already read.
//
// Entry metadata lives in sessionStorage, so it survives a page reload but is
// gone once the tab closes. The audio itself stays in the user's temporary
// folder on the server (one sub-folder per tossup) until the session is
// cleaned up, which is what makes replaying an old tossup possible.

const STORAGE_KEY = 'qbv-tossup-history';

// Keep in sync with MAX_STORED_TOSSUPS in util/util.py — the server only keeps
// that many audio folders, so older entries would have nothing to play.
export const MAX_HISTORY = 20;

const RESULTS = {
    power: { label: 'Power', points: '+15' },
    ten: { label: 'Correct', points: '+10' },
    neg: { label: 'Neg', points: '-5' },
    dead: { label: 'Dead', points: '0' },
    skipped: { label: 'Skipped', points: '' }
};

export class TossupHistory {
    constructor({ list, count, empty, clearButton }) {
        this.listElement = list;
        this.countElement = count;
        this.emptyElement = empty;
        this.entries = this.read();

        if (clearButton) {
            clearButton.addEventListener('click', () => {
                if (this.entries.length && confirm('Clear the list of tossups read this session?')) {
                    this.clear();
                }
            });
        }

        this.render();
    }

    // ------------------------------------------------------------------
    // Persistence
    // ------------------------------------------------------------------

    read() {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            const parsed = stored ? JSON.parse(stored) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('Could not read tossup history:', error);
            return [];
        }
    }

    write() {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
        } catch (error) {
            // Realistically only a quota error. Drop the oldest half and retry
            // once rather than losing the whole history.
            console.error('Could not save tossup history:', error);
            this.entries = this.entries.slice(0, Math.ceil(this.entries.length / 2));
            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
            } catch (retryError) {
                console.error('Giving up on saving tossup history:', retryError);
            }
        }
    }

    // ------------------------------------------------------------------
    // Mutations
    // ------------------------------------------------------------------

    /** Add a freshly finished tossup to the top of the list. */
    add(entry) {
        const previous = this.entries[0];
        const record = {
            audioAvailable: true,
            ...entry,
            number: previous ? previous.number + 1 : 1
        };

        this.entries.unshift(record);
        const dropped = this.entries.splice(MAX_HISTORY);
        this.write();

        // Insert in place rather than re-rendering, so audio playing in
        // another entry is not interrupted.
        this.listElement.prepend(this.buildItem(record));
        dropped.forEach(item => this.findNode(item.id)?.remove());
        this.syncSummary();

        return record;
    }

    /** Patch one entry (e.g. after the result is toggled) and redraw just it. */
    updateEntry(id, patch) {
        const entry = this.entries.find(item => item.id === id);
        if (!entry) return null;

        Object.assign(entry, patch);
        this.write();

        const node = this.findNode(id);
        if (node) {
            const replacement = this.buildItem(entry);
            // Preserve whether the user had this box open
            if (!node.querySelector('.collapsible-header').classList.contains('collapsed')) {
                this.setItemCollapsed(replacement, false);
            }
            node.replaceWith(replacement);
        }
        return entry;
    }

    /** Mark tossups whose audio the server has aged out of temporary storage. */
    expire(ids) {
        if (!ids || !ids.length) return;
        ids.forEach(id => {
            const entry = this.entries.find(item => item.id === id);
            if (entry && entry.audioAvailable) {
                this.updateEntry(id, { audioAvailable: false });
            }
        });
    }

    clear() {
        this.entries = [];
        this.write();
        this.render();
    }

    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    render() {
        this.listElement.replaceChildren(...this.entries.map(entry => this.buildItem(entry)));
        this.syncSummary();
    }

    syncSummary() {
        if (this.countElement) {
            this.countElement.textContent = this.entries.length;
        }
        if (this.emptyElement) {
            this.emptyElement.classList.toggle('hidden', this.entries.length > 0);
        }
    }

    findNode(id) {
        return this.listElement.querySelector(`[data-tossup-id="${id}"]`);
    }

    setItemCollapsed(item, collapsed) {
        const header = item.querySelector('.collapsible-header');
        const content = item.querySelector('.collapsible-content');
        header.classList.toggle('collapsed', collapsed);
        content.classList.toggle('collapsed', collapsed);
        header.setAttribute('aria-expanded', String(!collapsed));
    }

    buildItem(entry) {
        const result = RESULTS[entry.result] || RESULTS.dead;
        const contentId = `history-content-${entry.id}`;

        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.tossupId = entry.id;

        // Header — reuses the collapsible pattern used by the settings panels
        const header = document.createElement('div');
        header.className = 'collapsible-header collapsed';
        header.setAttribute('data-target', contentId);
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'false');
        header.setAttribute('aria-controls', contentId);

        const title = document.createElement('label');
        title.className = 'history-title';

        const number = document.createElement('span');
        number.className = 'history-number';
        number.textContent = `#${entry.number}`;

        const setName = document.createElement('span');
        setName.className = 'history-set';
        setName.textContent = entry.setName || 'Unknown set';

        title.append(number, setName);

        const badge = document.createElement('span');
        badge.className = `history-result ${entry.result || 'dead'}`;
        badge.textContent = result.points ? `${result.label} ${result.points}` : result.label;

        const icon = document.createElement('span');
        icon.className = 'collapse-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '▼';

        header.append(title, badge, icon);

        // Body — hidden until the box is expanded
        const content = document.createElement('div');
        content.className = 'collapsible-content collapsed';
        content.id = contentId;

        const body = document.createElement('div');
        body.className = 'history-body';

        const question = document.createElement('p');
        question.className = 'history-question';
        question.textContent = entry.question || 'Question text unavailable.';
        body.append(question);

        const answer = document.createElement('p');
        answer.className = 'history-answer';
        const answerLabel = document.createElement('strong');
        answerLabel.textContent = 'ANSWER: ';
        const answerText = document.createElement('span');
        // Answer lines arrive from the packet with their own <b>/<u> markup,
        // the same as the live answer display.
        answerText.innerHTML = entry.answer || '';
        answer.append(answerLabel, answerText);
        body.append(answer);

        if (entry.userAnswer) {
            const said = document.createElement('p');
            said.className = 'history-user-answer';
            said.textContent = `You answered: ${entry.userAnswer}`;
            body.append(said);
        }

        body.append(this.buildAudio(entry));

        content.append(body);
        item.append(header, content);
        return item;
    }

    buildAudio(entry) {
        if (!entry.audioAvailable || !entry.audioPath) {
            const missing = document.createElement('p');
            missing.className = 'history-audio-missing';
            missing.textContent = 'Audio is no longer available for this tossup.';
            return missing;
        }

        const player = document.createElement('audio');
        player.className = 'history-audio';
        player.controls = true;
        // Nothing is fetched until the user actually presses play
        player.preload = 'none';
        player.src = entry.audioPath;

        player.addEventListener('error', () => {
            const entryRecord = this.entries.find(item => item.id === entry.id);
            if (entryRecord) {
                entryRecord.audioAvailable = false;
                this.write();
            }
            player.replaceWith(this.buildAudio({ ...entry, audioAvailable: false }));
        });

        return player;
    }
}
