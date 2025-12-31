const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

/**
 * Icon slot element - unified icon box for items, materials, equipment, consumables
 * 
 * Replaces: adventuring-material, adventuring-stored-item, adventuring-item-base, 
 *           adventuring-consumable, adventuring-equipment-slot
 * 
 * Features:
 * - Bordered icon box with tooltip
 * - Optional lock overlay
 * - Optional corner badge (NEW, etc.)
 * - Optional bottom badge (count, charges, upgrade level)
 */
export class AdventuringIconSlotElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-icon-slot-template'));
        
        this.clickable = getElementFromFragment(this._content, 'clickable', 'div');
        this.border = getElementFromFragment(this._content, 'border', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.lock = getElementFromFragment(this._content, 'lock', 'div');
        this.cornerBadge = getElementFromFragment(this._content, 'cornerBadge', 'span');
        this.bottomBadge = getElementFromFragment(this._content, 'bottomBadge', 'small');
        
        this._tooltipTarget = this.clickable;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    /**
     * Set the icon source
     * @param {string} src - Image URL
     */
    setIcon(src) {
        this.icon.src = src;
    }

    /**
     * Set the border color class
     * @param {string} colorClass - Border color class (e.g., 'border-success', 'border-warning')
     */
    setBorderColor(colorClass) {
        // Remove existing border color classes
        this.border.classList.remove('border-secondary', 'border-success', 'border-warning', 'border-danger', 'border-info', 'border-primary');
        this.border.classList.add(colorClass);
    }

    /**
     * Show/hide the lock overlay
     * @param {boolean} locked - Whether to show the lock
     */
    setLocked(locked) {
        this.lock.classList.toggle('d-none', !locked);
    }

    /**
     * Set the corner badge (e.g., NEW)
     * @param {string|null} text - Badge text, or null to hide
     * @param {string} [badgeClass='badge-success'] - Badge color class
     */
    setCornerBadge(text, badgeClass = 'badge-success') {
        if (text) {
            this.cornerBadge.textContent = text;
            this.cornerBadge.className = `badge ${badgeClass}`;
            this.cornerBadge.style.cssText = 'position: absolute; top: 2px; right: 2px; font-size: 0.5rem; z-index: 10;';
            this.cornerBadge.classList.remove('d-none');
        } else {
            this.cornerBadge.classList.add('d-none');
        }
    }

    /**
     * Set the bottom badge (count, charges, upgrade level)
     * @param {string|number|null} value - Badge value, or null to hide
     * @param {string} [badgeClass='bg-secondary'] - Badge background class
     */
    setBottomBadge(value, badgeClass = 'bg-secondary') {
        if (value !== null && value !== undefined) {
            this.bottomBadge.textContent = value;
            this.bottomBadge.className = `badge-pill ${badgeClass}`;
            this.bottomBadge.classList.remove('d-none');
        } else {
            this.bottomBadge.classList.add('d-none');
        }
    }

    /**
     * Configure for material/stored item display
     * @param {Object} options
     * @param {string} options.iconSrc - Icon URL
     * @param {number|string} [options.count] - Item count
     * @param {boolean} [options.isNew] - Show NEW badge
     */
    setMaterial({ iconSrc, count, isNew = false }) {
        this.setIcon(iconSrc);
        this.setBottomBadge(count);
        this.setCornerBadge(isNew ? 'NEW' : null);
        this.setLocked(false);
    }

    /**
     * Configure for equipment item display
     * @param {Object} options
     * @param {string} options.iconSrc - Icon URL
     * @param {number|string} [options.upgradeLevel] - Upgrade level to display
     * @param {boolean} [options.isNew] - Show NEW badge
     * @param {boolean} [options.locked] - Show lock overlay
     * @param {string} [options.borderColor] - Border color class
     */
    setEquipment({ iconSrc, upgradeLevel, isNew = false, locked = false, borderColor = 'border-secondary' }) {
        this.setIcon(iconSrc);
        this.setBottomBadge(upgradeLevel);
        this.setCornerBadge(isNew ? 'NEW' : null);
        this.setLocked(locked);
        this.setBorderColor(borderColor);
    }

    /**
     * Configure for consumable display
     * @param {Object} options
     * @param {string} options.iconSrc - Icon URL
     * @param {number|string} [options.charges] - Charges remaining
     */
    setConsumable({ iconSrc, charges }) {
        this.setIcon(iconSrc);
        this.setBottomBadge(charges, 'bg-warning');
        this.setCornerBadge(null);
        this.setLocked(false);
    }
}
window.customElements.define('adventuring-icon-slot', AdventuringIconSlotElement);
