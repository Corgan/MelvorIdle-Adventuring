export class AdventuringCardsElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-cards-template'));
        
        this.cards = getElementFromFragment(this._content, 'cards', 'div');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }
}
window.customElements.define('adventuring-cards', AdventuringCardsElement);