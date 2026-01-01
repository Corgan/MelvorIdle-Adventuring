const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

export class AdventuringStashSlotElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-stash-slot-template'));
        
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        
        this._tooltipTarget = this.icon;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }
}
window.customElements.define('adventuring-stash-slot', AdventuringStashSlotElement);