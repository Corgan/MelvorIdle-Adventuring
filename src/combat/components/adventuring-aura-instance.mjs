const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement, createTooltip } = await loadModule('src/core/components/adventuring-tooltip-element.mjs');

export class AdventuringAuraInstanceElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-aura-instance-template'));

        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.stacks = getElementFromFragment(this._content, 'stacks', 'small');
        this.border = getElementFromFragment(this._content, 'border', 'div');

        this.auraInstance = null;
    }

    connectedCallback() {
        this.appendChild(this._content);
        if (this.tooltip === undefined) {
            this.tooltip = createTooltip(this.styling, '', { interactive: true });
        }
        if (this.auraInstance) {
            this.auraInstance.renderQueue.tooltip = true;
        }
    }

    disconnectedCallback() {
        const shouldDestroy = !this.auraInstance || this.auraInstance.stacks === 0 || this.auraInstance.base === undefined;
        if (this.tooltip !== undefined && shouldDestroy) {
            this.tooltip.destroy();
            this.tooltip = undefined;
        }
    }
}
window.customElements.define('adventuring-aura-instance', AdventuringAuraInstanceElement);