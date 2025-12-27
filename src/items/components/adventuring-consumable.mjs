export class AdventuringConsumableElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-consumable-template'));
        
        this.clickable = getElementFromFragment(this._content, 'clickable', 'div');
        this.border = getElementFromFragment(this._content, 'border', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.charges = getElementFromFragment(this._content, 'charges', 'small');
    }

    connectedCallback() {
        this.appendChild(this._content);
        this.tooltip = tippy(this.clickable, {
            content: '',
            allowHTML: true,
            hideOnClick: false
        });
    }

    disconnectedCallback() {
        if (this.tooltip !== undefined) {
            this.tooltip.destroy();
            this.tooltip = undefined;
        }
    }

    mount(parent) {
        parent.appendChild(this);
    }
}
window.customElements.define('adventuring-consumable', AdventuringConsumableElement);
