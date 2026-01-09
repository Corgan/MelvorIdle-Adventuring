/**
 * Simple stat row element for label: value displays
 */
export class AdventuringStatRowElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-stat-row-template'));
        
        this.row = getElementFromFragment(this._content, 'row', 'div');
        this.label = getElementFromFragment(this._content, 'label', 'span');
        this.valueEl = getElementFromFragment(this._content, 'value', 'span');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    /**
     * Set the stat to display
     * @param {Object} options
     * @param {string} options.label - Stat label
     * @param {string|number} options.value - Stat value
     * @param {string} [options.valueClass] - Optional class for value element
     */
    setStat({ label, value, valueClass }) {
        this.label.textContent = `${label}:`;
        this.valueEl.textContent = value;
        if(valueClass) {
            this.valueEl.className = valueClass;
        } else {
            this.valueEl.className = '';
        }
    }

    /**
     * Reset element for pooling
     */
    reset() {
        this.label.textContent = '';
        this.valueEl.textContent = '';
        this.valueEl.className = '';
    }
}
window.customElements.define('adventuring-stat-row', AdventuringStatRowElement);
