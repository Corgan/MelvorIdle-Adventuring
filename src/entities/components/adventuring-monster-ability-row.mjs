const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

/**
 * Simple ability row for monster details - shows type label and ability name with tooltip
 */
export class AdventuringMonsterAbilityRowElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-monster-ability-row-template'));
        
        this.row = getElementFromFragment(this._content, 'row', 'div');
        this.typeLabel = getElementFromFragment(this._content, 'type-label', 'span');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
        
        this._tooltipTarget = this.row;
        this._tooltipOptions = { placement: 'right' };
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    /**
     * Set the ability to display
     * @param {Object} options
     * @param {string} options.type - 'generator', 'spender', or 'passive'
     * @param {string} options.name - Ability name
     * @param {string} options.tooltipContent - HTML content for tooltip
     */
    setAbility({ type, name, tooltipContent }) {
        const typeLabels = { generator: 'Generator:', spender: 'Spender:', passive: 'Passive:' };
        
        this.typeLabel.textContent = typeLabels[type] || type;
        this.nameText.textContent = name;
        
        // Type-specific color class
        const typeColors = { generator: 'text-success', spender: 'text-warning', passive: 'text-info' };
        this.nameText.className = `ml-auto ${typeColors[type] || ''}`;
        
        this.setTooltipContent(tooltipContent);
    }

    /**
     * Reset element for pooling
     */
    reset() {
        this.typeLabel.textContent = '';
        this.nameText.textContent = '';
        this.nameText.className = 'ml-auto';
        this.setTooltipContent('');
    }
}
window.customElements.define('adventuring-monster-ability-row', AdventuringMonsterAbilityRowElement);
