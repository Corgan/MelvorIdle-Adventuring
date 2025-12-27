export class AdventuringAuraElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-aura-template'));

        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.nameText = getElementFromFragment(this._content, 'name', 'small');
        this.description = getElementFromFragment(this._content, 'description', 'small');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }
}
window.customElements.define('adventuring-aura', AdventuringAuraElement);