export class AdventuringDungeonFloorElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-dungeon-floor-template'));

        this.floor = getElementFromFragment(this._content, 'floor', 'div');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }
}
window.customElements.define('adventuring-dungeon-floor', AdventuringDungeonFloorElement);