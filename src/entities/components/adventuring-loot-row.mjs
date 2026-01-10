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
     * @param {string} options.type - Loot type (currency, salvage, materials, equipment)
     * @param {string} options.qty - Formatted quantity string
     * @param {string} options.chance - Formatted chance string
     * @param {string} [options.tooltipContent] - Optional tooltip HTML
     * @param {boolean} [options.nested=false] - Whether this is a nested item (indented)
     * @param {boolean} [options.isHeader=false] - Whether this is a pool header row
     * @param {boolean} [options.collected=false] - Whether this item has been collected
     */
    setLoot({ icon, name, type, qty, chance, tooltipContent, nested = false, isHeader = false, collected = false }) {
        this.icon.src = icon || '';
        this.nameText.textContent = name;
        
        // Apply indent and icon visibility for different row types
        if(isHeader) {
            // Pool header - hide icon completely, no indent
            this.icon.classList.add('d-none');
            this.row.style.marginLeft = '';
            this.nameText.className = 'font-w600';
        } else if(nested) {
            // Nested pool items - always show icon (media handles ? for undropped)
            this.icon.classList.remove('d-none');
            this.row.style.marginLeft = '24px';
            // Collected items show as success, otherwise muted
            this.nameText.className = collected ? 'text-success' : 'text-muted';
        } else {
            // Normal rows - show icon with visibility for spacing
            this.icon.classList.remove('d-none');
            this.icon.style.visibility = icon ? 'visible' : 'hidden';
            this.row.style.marginLeft = '';
            this.nameText.className = 'font-w600';
        }
        
        // Type badge colors
        const badgeColors = {
            currency: 'badge-warning',
            salvage: 'badge-secondary',
            materials: 'badge-info',
            equipment: 'badge-success'
        };
        this.typeBadge.className = `badge ml-auto ${badgeColors[type] || 'badge-dark'}`;
        this.typeBadge.textContent = type;
        
        // Hide type badge for nested items
        this.typeBadge.classList.toggle('d-none', nested);
        
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
        this.icon.style.visibility = '';
        this.icon.classList.remove('d-none');
        this.nameText.textContent = '';
        this.nameText.className = 'font-w600';
        this.row.style.marginLeft = '';
        this.typeBadge.textContent = '';
        this.typeBadge.className = 'badge mr-3';
        this.qty.textContent = '';
        this.chance.textContent = '';
        this.clearTooltip();
    }
}
window.customElements.define('adventuring-loot-row', AdventuringLootRowElement);
