/**
 * Empty state element - centered placeholder message for empty containers
 * Used in tavern active buffs, slayers active tasks, empty lists
 */
export class AdventuringEmptyStateElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-empty-state-template'));
        
        this.container = getElementFromFragment(this._content, 'container', 'div');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    /**
     * Set the empty state message
     * @param {string} message - Message text to display
     * @param {string} [extraClasses] - Additional CSS classes
     */
    setMessage(message, extraClasses = '') {
        this.container.textContent = message;
        this.container.className = `text-center text-muted p-3 ${extraClasses}`;
    }

    /**
     * Set message spanning full width (for grid layouts)
     * @param {string} message - Message text to display
     */
    setFullWidthMessage(message) {
        this.container.textContent = message;
        this.container.className = 'col-12 text-center text-muted p-3';
    }
}
window.customElements.define('adventuring-empty-state', AdventuringEmptyStateElement);
