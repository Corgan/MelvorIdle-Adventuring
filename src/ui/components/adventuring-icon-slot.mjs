const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

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

    setIcon(src) {
        this.icon.src = src;
    }

    setBorderColor(colorClass) {
        this.border.classList.remove('border-secondary', 'border-success', 'border-warning', 'border-danger', 'border-info', 'border-primary');
        this.border.classList.add(colorClass);
    }

    setLocked(locked) {
        this.lock.classList.toggle('d-none', !locked);
    }

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

    setBottomBadge(value, badgeClass = 'bg-secondary') {
        if (value !== null && value !== undefined) {
            this.bottomBadge.textContent = value;
            this.bottomBadge.className = `badge-pill ${badgeClass}`;
            this.bottomBadge.classList.remove('d-none');
        } else {
            this.bottomBadge.classList.add('d-none');
        }
    }

    setMaterial({ iconSrc, count, isNew = false }) {
        this.setIcon(iconSrc);
        this.setBottomBadge(count);
        this.setCornerBadge(isNew ? 'NEW' : null);
        this.setLocked(false);
    }

    setEquipment({ iconSrc, upgradeLevel, isNew = false, locked = false, borderColor = 'border-secondary' }) {
        this.setIcon(iconSrc);
        this.setBottomBadge(upgradeLevel);
        this.setCornerBadge(isNew ? 'NEW' : null);
        this.setLocked(locked);
        this.setBorderColor(borderColor);
    }

    setConsumable({ iconSrc, charges }) {
        this.setIcon(iconSrc);
        this.setBottomBadge(charges, 'bg-warning');
        this.setCornerBadge(null);
        this.setLocked(false);
    }
}
window.customElements.define('adventuring-icon-slot', AdventuringIconSlotElement);
