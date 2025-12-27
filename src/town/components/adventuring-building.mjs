export class AdventuringBuildingElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-building-template'));

        this.clickable = getElementFromFragment(this._content, 'clickable', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
    }

    mount(parent) {
        parent.append(this);
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
}
window.customElements.define('adventuring-building', AdventuringBuildingElement);