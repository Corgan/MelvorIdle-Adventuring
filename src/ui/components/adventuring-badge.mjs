/**
 * Reusable badge element for consistent badge styling
 * Supports various badge types: info, success, warning, danger, secondary, tier-based
 */
export class AdventuringBadgeElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-badge-template'));
        
        this.badge = getElementFromFragment(this._content, 'badge', 'span');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    /**
     * Set badge content and type
     * @param {Object} options
     * @param {string} options.text - Badge text
     * @param {string} [options.type='secondary'] - Badge type: info, success, warning, danger, secondary, primary
     * @param {string} [options.size='normal'] - Size: normal, sm, xs
     * @param {string} [options.icon] - Optional Font Awesome icon class (e.g., 'fa-lock')
     */
    setBadge({ text, type = 'secondary', size = 'normal', icon }) {
        const sizeClass = size === 'xs' ? 'font-size-xs' : size === 'sm' ? 'font-size-sm' : '';
        this.badge.className = `badge badge-${type} mr-1 ${sizeClass}`.trim();
        
        if(icon) {
            this.badge.innerHTML = `<i class="fa ${icon} mr-1"></i>${text}`;
        } else {
            this.badge.textContent = text;
        }
    }

    /**
     * Set badge for a tier (1-4 with predefined colors)
     * @param {number} tier - Tier number (1-4)
     */
    setTier(tier) {
        const colors = {
            1: 'secondary',
            2: 'success',
            3: 'info',
            4: 'warning'
        };
        this.setBadge({
            text: `Tier ${tier}`,
            type: colors[tier] || 'secondary',
            size: 'sm'
        });
    }

    /**
     * Set badge for a location/area
     * @param {string} name - Location name
     */
    setLocation(name) {
        this.setBadge({
            text: name,
            type: 'info'
        });
    }

    /**
     * Reset element for pooling
     */
    reset() {
        this.badge.className = 'badge badge-secondary mr-1';
        this.badge.textContent = '';
        this.badge.innerHTML = '';
    }
}
window.customElements.define('adventuring-badge', AdventuringBadgeElement);
