/**
 * Stat bonus badge - displays a stat bonus with icon, value and label
 * Used in slayers achievements stats display
 */
export class AdventuringStatBadgeElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-stat-badge-template'));
        
        this.col = getElementFromFragment(this._content, 'col', 'div');
        this.content = getElementFromFragment(this._content, 'content', 'div');
        this.iconEl = getElementFromFragment(this._content, 'icon', 'i');
        this.imgEl = null; // Created on demand for image-based icons
        this.valueEl = getElementFromFragment(this._content, 'value', 'span');
        this.labelEl = getElementFromFragment(this._content, 'label', 'small');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    /**
     * Set the stat bonus to display using a Font Awesome icon
     * @param {string} icon - Font Awesome icon class (e.g., 'fa-heart')
     * @param {string} colorClass - Color class for the content (e.g., 'text-danger')
     * @param {number|string} value - Numeric value to display (will be prefixed with +)
     * @param {string} label - Short label (e.g., 'HP')
     */
    setStatData(icon, colorClass, value, label) {
        this.content.className = colorClass || '';
        this.iconEl.className = `fa ${icon} mr-1`;
        this.iconEl.classList.remove('d-none');
        if(this.imgEl) this.imgEl.classList.add('d-none');
        this.valueEl.textContent = `+${value}`;
        this.labelEl.textContent = label;
    }

    /**
     * Set the stat bonus using an actual stat object from the registry
     * @param {object} stat - Stat object with name and media properties
     * @param {number|string} value - Numeric value to display
     */
    setStatDataFromStat(stat, value) {
        // Hide the Font Awesome icon
        this.iconEl.classList.add('d-none');
        
        // Create or show the image element
        if(!this.imgEl) {
            this.imgEl = document.createElement('img');
            this.imgEl.className = 'skill-icon-xxs mr-1';
            this.iconEl.parentNode.insertBefore(this.imgEl, this.iconEl);
        }
        this.imgEl.classList.remove('d-none');
        this.imgEl.src = stat.media;
        
        this.content.className = '';
        this.valueEl.textContent = `+${value}`;
        this.labelEl.textContent = stat.name;
    }
}
window.customElements.define('adventuring-stat-badge', AdventuringStatBadgeElement);
