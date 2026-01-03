const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

/**
 * Tavern drink icon element - displays drink with charges badge and selection state
 */
export class AdventuringTavernDrinkElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-tavern-drink-template'));
        
        this.clickable = getElementFromFragment(this._content, 'clickable', 'div');
        this.border = getElementFromFragment(this._content, 'border', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.charges = getElementFromFragment(this._content, 'charges', 'small');
        this.chargesBadge = getElementFromFragment(this._content, 'charges-badge', 'div');
        this.equippedBadge = getElementFromFragment(this._content, 'equipped-badge', 'span');
        
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
     * Mount the element to a parent
     */
    mount(parent) {
        parent.appendChild(this);
    }

    /**
     * Remove from DOM
     */
    remove() {
        this.parentElement?.removeChild(this);
    }

    /**
     * Update selection state
     */
    setSelected(selected) {
        if (selected) {
            this.border.classList.remove('border-secondary');
            this.border.classList.add('border-info');
        } else {
            this.border.classList.remove('border-info');
            this.border.classList.add('border-secondary');
        }
    }

    /**
     * Update charges display
     */
    setCharges(count) {
        if (count > 0) {
            this.charges.textContent = count;
            this.chargesBadge.classList.remove('d-none');
        } else {
            this.chargesBadge.classList.add('d-none');
        }
    }

    /**
     * Update equipped indicator
     */
    setEquipped(equipped) {
        if (equipped) {
            this.equippedBadge.classList.remove('d-none');
        } else {
            this.equippedBadge.classList.add('d-none');
        }
    }
}
window.customElements.define('adventuring-tavern-drink', AdventuringTavernDrinkElement);
