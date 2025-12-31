const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

/**
 * Entity display element - unified display for jobs, monsters, areas
 * 
 * Replaces: adventuring-job, adventuring-monster, adventuring-area
 * 
 * Features:
 * - Icon + name + level
 * - Optional progress bar (mastery)
 * - Optional NEW badge
 * - Clickable with tooltip
 */
export class AdventuringEntityDisplayElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-entity-display-template'));
        
        this.col = getElementFromFragment(this._content, 'col', 'div');
        this.clickable = getElementFromFragment(this._content, 'clickable', 'div');
        this.newBadge = getElementFromFragment(this._content, 'newBadge', 'span');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
        this.level = getElementFromFragment(this._content, 'level', 'small');
        this.progressContainer = getElementFromFragment(this._content, 'progressContainer', 'div');
        this.progress = getElementFromFragment(this._content, 'progress', 'progress-bar');
        
        this._tooltipTarget = this.clickable;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    /**
     * Set the entity icon
     * @param {string} src - Image URL
     */
    setIcon(src) {
        this.icon.src = src;
    }

    /**
     * Set the entity name
     * @param {string} name - Display name
     */
    setName(name) {
        this.nameText.textContent = name;
    }

    /**
     * Set the level display
     * @param {number|string|null} level - Level value, or null to hide
     */
    setLevel(level) {
        if (level !== null && level !== undefined) {
            this.level.textContent = ` Lv.${level}`;
        } else {
            this.level.textContent = '';
        }
    }

    /**
     * Show/hide the NEW badge
     * @param {boolean} show - Whether to show the badge
     */
    setNewBadge(show) {
        this.newBadge.classList.toggle('d-none', !show);
    }

    /**
     * Set progress bar percentage
     * @param {number} percent - Percentage (0-100)
     * @param {string} [colorClass='bg-info'] - Progress bar color class
     */
    setProgress(percent, colorClass = 'bg-info') {
        this.progress.style.width = `${percent}%`;
        this.progress.className = `progress-bar ${colorClass}`;
    }

    /**
     * Show/hide the progress bar container
     * @param {boolean} show - Whether to show progress
     */
    showProgress(show) {
        this.progressContainer.classList.toggle('d-none', !show);
    }

    /**
     * Set column width class
     * @param {string} colClass - Bootstrap column class (e.g., 'col-12 col-md-4')
     */
    setColumnClass(colClass) {
        this.col.className = colClass;
    }

    /**
     * Configure for job display
     * @param {Object} options
     * @param {string} options.iconSrc - Icon URL
     * @param {string} options.name - Job name
     * @param {number} options.level - Job level
     * @param {number} [options.masteryPercent] - Mastery progress percentage
     */
    setJob({ iconSrc, name, level, masteryPercent }) {
        this.setIcon(iconSrc);
        this.setName(name);
        this.setLevel(level);
        this.setNewBadge(false);
        if (masteryPercent !== undefined) {
            this.setProgress(masteryPercent);
            this.showProgress(true);
        } else {
            this.showProgress(false);
        }
    }

    /**
     * Configure for monster display
     * @param {Object} options
     * @param {string} options.iconSrc - Icon URL
     * @param {string} options.name - Monster name
     * @param {number} [options.level] - Monster level
     * @param {boolean} [options.isNew] - Show NEW badge
     * @param {number} [options.masteryPercent] - Mastery progress percentage
     */
    setMonster({ iconSrc, name, level, isNew = false, masteryPercent }) {
        this.setIcon(iconSrc);
        this.setName(name);
        this.setLevel(level);
        this.setNewBadge(isNew);
        if (masteryPercent !== undefined) {
            this.setProgress(masteryPercent);
            this.showProgress(true);
        } else {
            this.showProgress(false);
        }
    }

    /**
     * Configure for area display
     * @param {Object} options
     * @param {string} options.iconSrc - Icon URL
     * @param {string} options.name - Area name
     * @param {number} [options.level] - Area level requirement
     * @param {number} [options.masteryPercent] - Mastery progress percentage
     */
    setArea({ iconSrc, name, level, masteryPercent }) {
        this.setIcon(iconSrc);
        this.setName(name);
        this.setLevel(level);
        this.setNewBadge(false);
        if (masteryPercent !== undefined) {
            this.setProgress(masteryPercent);
            this.showProgress(true);
        } else {
            this.showProgress(false);
        }
    }

    /**
     * Set click handler
     * @param {Function} handler - Click callback
     */
    onClick(handler) {
        this.clickable.onclick = handler;
    }
}
window.customElements.define('adventuring-entity-display', AdventuringEntityDisplayElement);
