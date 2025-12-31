/**
 * Stat card element - displays a large value with label underneath
 * Used in lemon stats, summary displays, counters
 */
export class AdventuringStatCardElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-stat-card-template'));
        
        this.container = getElementFromFragment(this._content, 'container', 'div');
        this.value = getElementFromFragment(this._content, 'value', 'h4');
        this.label = getElementFromFragment(this._content, 'label', 'small');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    /**
     * Set the stat display
     * @param {Object} options - Configuration options
     * @param {string|number} options.value - Value to display
     * @param {string} options.label - Label text underneath
     * @param {string} [options.valueClass='text-warning'] - CSS class for value
     */
    setStat({ value, label, valueClass = 'text-warning' }) {
        this.value.textContent = value;
        this.value.className = `${valueClass} mb-0`;
        this.label.textContent = label;
    }

    /**
     * Set container width class for grid layouts
     * @param {string} colClass - Bootstrap column class (e.g., 'col-4')
     */
    setColumnClass(colClass) {
        this.container.className = `${colClass} text-center`;
    }
}
window.customElements.define('adventuring-stat-card', AdventuringStatCardElement);
