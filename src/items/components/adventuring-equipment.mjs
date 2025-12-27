export class AdventuringEquipmentElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-equipment-template'));

        this.equipment = getElementFromFragment(this._content, 'equipment', 'div');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }
}
window.customElements.define('adventuring-equipment', AdventuringEquipmentElement);