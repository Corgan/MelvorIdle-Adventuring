/**
 * Requirement status element - displays a requirement with met/unmet styling
 * Used in workshop requirements, ability requirements, unlock conditions
 */
export class AdventuringRequirementElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-requirement-template'));
        
        this.container = getElementFromFragment(this._content, 'container', 'span');
        this.status = getElementFromFragment(this._content, 'status', 'span');
        this.text = getElementFromFragment(this._content, 'text', 'span');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    /**
     * Set the requirement display
     * @param {Object} options - Configuration options
     * @param {string} options.text - Requirement text (e.g., "Fighter Lv.5")
     * @param {boolean} options.met - Whether the requirement is met
     * @param {boolean} [options.showIcon=true] - Whether to show checkmark/x icon
     */
    setRequirement({ text, met, showIcon = true }) {
        if (showIcon) {
            this.status.textContent = met ? '✓' : '✗';
            this.status.className = `mr-1 ${met ? 'text-success' : 'text-danger'}`;
        } else {
            this.status.textContent = '';
            this.status.className = '';
        }
        
        this.text.textContent = text;
        this.container.className = met ? 'text-success' : 'text-warning';
    }
}
window.customElements.define('adventuring-requirement', AdventuringRequirementElement);
