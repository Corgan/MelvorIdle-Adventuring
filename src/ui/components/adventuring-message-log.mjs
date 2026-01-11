export class AdventuringMessageLogElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-message-log-template'));

        this.messages = getElementFromFragment(this._content, 'messages', 'div');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }
}
window.customElements.define('adventuring-message-log', AdventuringMessageLogElement);