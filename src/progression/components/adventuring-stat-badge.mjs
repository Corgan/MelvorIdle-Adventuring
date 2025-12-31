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
        this.valueEl = getElementFromFragment(this._content, 'value', 'span');
        this.labelEl = getElementFromFragment(this._content, 'label', 'small');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    /**
     * Set the stat bonus to display
     * @param {string} icon - Font Awesome icon class (e.g., 'fa-heart')
     * @param {string} colorClass - Color class for the content (e.g., 'text-danger')
     * @param {number|string} value - Numeric value to display (will be prefixed with +)
     * @param {string} label - Short label (e.g., 'HP')
     */
    setStatData(icon, colorClass, value, label) {
        this.content.className = colorClass || '';
        this.iconEl.className = `fa ${icon} mr-1`;
        this.valueEl.textContent = `+${value}`;
        this.labelEl.textContent = label;
    }
}
window.customElements.define('adventuring-stat-badge', AdventuringStatBadgeElement);
