const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

/**
 * Ability row for job details ability list
 */
export class AdventuringAbilityRowElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-ability-row-template'));
        
        this.row = getElementFromFragment(this._content, 'row', 'div');
        this.status = getElementFromFragment(this._content, 'status', 'span');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
        this.badge = getElementFromFragment(this._content, 'badge', 'span');
        this.level = getElementFromFragment(this._content, 'level', 'small');
        
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
     * @param {Object} options - Configuration options
     * @param {string} options.name - Ability name (or '???' if locked)
     * @param {boolean} options.isUnlocked - Whether ability is unlocked
     * @param {string} options.type - 'generator', 'spender', or 'passive'
     * @param {number} options.unlockLevel - Level required to unlock
     * @param {string} options.tooltipContent - HTML content for tooltip
     */
    setAbility({ name, isUnlocked, type, unlockLevel, tooltipContent }) {
        // Status indicator (use Font Awesome icons instead of unicode)
        this.status.className = isUnlocked 
            ? 'fas fa-check text-success mr-2' 
            : 'fas fa-lock text-warning mr-2';
        this.status.textContent = '';
        
        // Name
        this.nameText.className = isUnlocked ? 'font-w600' : 'font-w600 text-muted';
        this.nameText.textContent = name;
        
        // Type badge
        const badgeColors = { generator: 'badge-info', spender: 'badge-warning', passive: 'badge-success' };
        const badgeLabels = { generator: 'Generator', spender: 'Spender', passive: 'Passive' };
        this.badge.className = `badge ${badgeColors[type]} ml-auto`;
        this.badge.textContent = badgeLabels[type];
        
        // Level
        this.level.textContent = `Lv.${unlockLevel}`;
        
        this.setTooltipContent(tooltipContent);
    }
}
window.customElements.define('adventuring-ability-row', AdventuringAbilityRowElement);
