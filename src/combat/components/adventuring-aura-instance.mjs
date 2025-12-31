const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement, createTooltip } = await loadModule('src/core/adventuring-tooltip-element.mjs');

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
        // Don't set _tooltipTarget - we manage tooltip manually for auras
    }

    connectedCallback() {
        this.appendChild(this._content);
        // Only create tooltip if it doesn't exist (survives DOM reordering)
        if (this.tooltip === undefined) {
            this.tooltip = createTooltip(this.styling, '', { interactive: true });
        }
        // Queue tooltip render so it gets filled with correct content
        if (this.auraInstance) {
            this.auraInstance.renderQueue.tooltip = true;
        }
    }

    disconnectedCallback() {
        // Destroy tooltip if:
        // - No auraInstance reference (can't check state, so clean up to be safe)
        // - Aura is being removed (stacks = 0 or base undefined)
        // Otherwise this is just a DOM reorder and we want to keep the tooltip
        const shouldDestroy = !this.auraInstance || this.auraInstance.stacks === 0 || this.auraInstance.base === undefined;
        if (this.tooltip !== undefined && shouldDestroy) {
            this.tooltip.destroy();
            this.tooltip = undefined;
        }
    }
}
window.customElements.define('adventuring-aura-instance', AdventuringAuraInstanceElement);