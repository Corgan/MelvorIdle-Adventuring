const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/components/adventuring-tooltip-element.mjs');

export class AdventuringDungeonCellElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-dungeon-cell-template'));

        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');

        this._tooltipTarget = this.styling;
        this._tooltipOptions = { placement: 'top' };
    }

    connectedCallback() {
        if (this._content.childNodes.length > 0) {
            this.appendChild(this._content);
        }
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }
}
window.customElements.define('adventuring-dungeon-cell', AdventuringDungeonCellElement);