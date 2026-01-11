
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

    setMessage(message, extraClasses = '') {
        this.container.textContent = message;
        this.container.className = `text-center text-muted p-3 ${extraClasses}`;
    }

    setFullWidthMessage(message) {
        this.container.textContent = message;
        this.container.className = 'col-12 text-center text-muted p-3';
    }
}
window.customElements.define('adventuring-empty-state', AdventuringEmptyStateElement);
