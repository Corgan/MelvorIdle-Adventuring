export class AdventuringWorkOrderElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-work-order-template'));

        this.styling = getElementFromFragment(this._content, 'style', 'div');
        this.active = getElementFromFragment(this._content, 'active', 'div');
        this.inactive = getElementFromFragment(this._content, 'inactive', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
        this.progressText = getElementFromFragment(this._content, 'progress-text', 'div');
        this.progressBar = getElementFromFragment(this._content, 'progress-bar', 'div');
        this.craftableBy = getElementFromFragment(this._content, 'craftable-by', 'div');
        this.cancel = getElementFromFragment(this._content, 'cancel', 'button');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }
}
window.customElements.define('adventuring-work-order', AdventuringWorkOrderElement);