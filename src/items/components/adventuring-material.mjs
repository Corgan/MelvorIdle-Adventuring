const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/components/adventuring-tooltip-element.mjs');

export class AdventuringMaterialElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-material-template'));

        this.clickable = getElementFromFragment(this._content, 'clickable', 'div');
        this.border = getElementFromFragment(this._content, 'border', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.count = getElementFromFragment(this._content, 'count', 'small');
        this.newBadge = getElementFromFragment(this._content, 'new-badge', 'span');

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
window.customElements.define('adventuring-material', AdventuringMaterialElement);