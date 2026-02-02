const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/components/adventuring-tooltip-element.mjs');

export class AdventuringConsumableElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-consumable-template'));

        this.clickable = getElementFromFragment(this._content, 'clickable', 'div');
        this.border = getElementFromFragment(this._content, 'border', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.charges = getElementFromFragment(this._content, 'charges', 'small');

        this._tooltipTarget = this.clickable;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }
}
window.customElements.define('adventuring-consumable', AdventuringConsumableElement);
