export class AdventuringItemBaseElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-item-base-template'));
        
        this.clickable = getElementFromFragment(this._content, 'clickable', 'div');
        this.border = getElementFromFragment(this._content, 'border', 'div');
        this.lock = getElementFromFragment(this._content, 'lock', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.upgrade = getElementFromFragment(this._content, 'upgrade', 'small');
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
window.customElements.define('adventuring-item-base', AdventuringItemBaseElement);