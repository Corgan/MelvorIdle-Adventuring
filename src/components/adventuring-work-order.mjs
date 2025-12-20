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
        this.completed = getElementFromFragment(this._content, 'completed', 'span');
        this.count = getElementFromFragment(this._content, 'count', 'span');
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