const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

export class AdventuringItemBaseElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-item-base-template'));

        this.clickable = getElementFromFragment(this._content, 'clickable', 'div');
        this.border = getElementFromFragment(this._content, 'border', 'div');
        this.lock = getElementFromFragment(this._content, 'lock', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.upgrade = getElementFromFragment(this._content, 'upgrade', 'small');
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
window.customElements.define('adventuring-item-base', AdventuringItemBaseElement);