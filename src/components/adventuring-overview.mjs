export class AdventuringOverviewElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-overview-template'));

        this.statusText = getElementFromFragment(this._content, 'status-text', 'h5');
        this.buttons = getElementFromFragment(this._content, 'buttons', 'div');
        this.turnProgress = getElementFromFragment(this._content, 'turn-progress', 'div');
        this.turnProgressBar = getElementFromFragment(this._content, 'turn-progress-bar', 'progress-bar');
        this.cards = getElementFromFragment(this._content, 'cards', 'div');
        this.log = getElementFromFragment(this._content, 'log', 'div');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }
}
window.customElements.define('adventuring-overview', AdventuringOverviewElement);