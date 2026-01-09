const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

/**
 * Loot row element for monster details drop table
 */
export class AdventuringLootRowElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-loot-row-template'));
        
        this.row = getElementFromFragment(this._content, 'row', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
        this.typeBadge = getElementFromFragment(this._content, 'typeBadge', 'span');
        this.qty = getElementFromFragment(this._content, 'qty', 'small');
        this.chance = getElementFromFragment(this._content, 'chance', 'small');
        
        this._tooltipTarget = this.row;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    /**
     * Set the loot entry to display
     * @param {Object} options - Configuration options
     * @param {string} options.icon - Icon URL
     * @param {string} options.name - Item name
     * @param {string} options.type - Loot type (currency, salvage, materials, equipment, equipment_pool)
     * @param {string} options.qty - Formatted quantity string
     * @param {string} options.chance - Formatted chance string
     * @param {string} [options.tooltipContent] - Optional tooltip HTML
     */
    setLoot({ icon, name, type, qty, chance, tooltipContent }) {
        this.icon.src = icon || '';
        this.icon.classList.toggle('d-none', !icon);
        
        this.nameText.textContent = name;
        
        // Type badge colors
        const badgeColors = {
            currency: 'badge-warning',
            salvage: 'badge-secondary',
            materials: 'badge-info',
            equipment: 'badge-success',
            equipment_pool: 'badge-primary'
        };
        this.typeBadge.className = `badge ${badgeColors[type] || 'badge-dark'}`;
        this.typeBadge.textContent = type;
        
        this.qty.textContent = qty;
        this.chance.textContent = chance;
        
        if(tooltipContent) {
            this.setTooltipContent(tooltipContent);
        }
    }

    /**
     * Reset element for pooling
     */
    reset() {
        this.icon.src = '';
        this.nameText.textContent = '';
        this.typeBadge.textContent = '';
        this.qty.textContent = '';
        this.chance.textContent = '';
        this.clearTooltip();
    }
}
window.customElements.define('adventuring-loot-row', AdventuringLootRowElement);
