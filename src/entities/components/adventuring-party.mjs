export class AdventuringPartyElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-party-template'));

        this.party = getElementFromFragment(this._content, 'party', 'div');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }
}
window.customElements.define('adventuring-party', AdventuringPartyElement);