export class AdventuringMessageElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-message-template'));

        this.body = getElementFromFragment(this._content, 'body', 'small');
        this.ts = getElementFromFragment(this._content, 'ts', 'small');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }
}
window.customElements.define('adventuring-message', AdventuringMessageElement);