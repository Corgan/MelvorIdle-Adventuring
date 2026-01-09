const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement, createTooltip } = await loadModule('src/core/adventuring-tooltip-element.mjs');

/**
 * Reusable icon button with border, badges, and tooltip support.
 * Used for equipment slot items, drink icons, equipped slots, etc.
 */
export class AdventuringIconButtonElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-icon-button-template'));
        
        this.container = getElementFromFragment(this._content, 'container', 'div');
        this.border = getElementFromFragment(this._content, 'border', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.cornerBadge = getElementFromFragment(this._content, 'cornerBadge', 'span');
        this.bottomBadge = getElementFromFragment(this._content, 'bottomBadge', 'div');
        
        this._tooltipTarget = this.container;
        this._tooltipOptions = { hideOnClick: true };
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    /**
     * Configure the icon button
     * @param {Object} options
     * @param {string} options.icon - Icon URL
     * @param {string} [options.borderClass='border-secondary'] - Border color class
     * @param {string} [options.cornerBadgeText] - Text for corner badge (e.g., 'E' for equipped)
     * @param {string} [options.cornerBadgeClass='badge-success'] - Class for corner badge
     * @param {string|number} [options.bottomBadgeText] - Text/number for bottom badge
     * @param {string} [options.bottomBadgeClass='bg-info'] - Class for bottom badge
     * @param {string} [options.tooltipContent] - HTML tooltip content
     * @param {Function} [options.onClick] - Click handler
     * @param {boolean} [options.hideIcon=false] - Hide the icon (for empty states)
     */
    setIcon(options) {
        const {
            icon,
            borderClass = 'border-secondary',
            cornerBadgeText,
            cornerBadgeClass = 'badge-success',
            bottomBadgeText,
            bottomBadgeClass = 'bg-info',
            tooltipContent,
            onClick,
            hideIcon = false
        } = options;

        // Icon
        if(icon) {
            this.icon.src = icon;
        }
        this.icon.classList.toggle('invisible', hideIcon);

        // Border color
        this.border.className = `border-2x border-rounded-equip combat-equip-img fishing-img m-0 ${borderClass}`;
        this.border.style.cssText = 'position: relative; overflow: hidden; border-width: 2px!important; border-style: solid!important;';

        // Corner badge (e.g., 'E' for equipped)
        if(cornerBadgeText !== undefined) {
            this.cornerBadge.textContent = cornerBadgeText;
            this.cornerBadge.className = `badge ${cornerBadgeClass}`;
            this.cornerBadge.style.cssText = 'position: absolute; top: 2px; right: 2px; font-size: 0.5rem; z-index: 10;';
            this.cornerBadge.classList.remove('d-none');
        } else {
            this.cornerBadge.classList.add('d-none');
        }

        // Bottom badge (e.g., charges, level)
        if(bottomBadgeText !== undefined) {
            this.bottomBadge.innerHTML = `<small class="badge-pill ${bottomBadgeClass}">${bottomBadgeText}</small>`;
            this.bottomBadge.classList.remove('d-none');
        } else {
            this.bottomBadge.classList.add('d-none');
        }

        // Tooltip
        if(tooltipContent) {
            this.setTooltipContent(tooltipContent);
        }

        // Click handler
        this.container.onclick = onClick || null;
    }

    /**
     * Set border style (solid or dashed for empty slots)
     * @param {string} style - 'solid' or 'dashed'
     */
    setBorderStyle(style) {
        this.border.style.borderStyle = `${style}!important`;
    }

    /**
     * Set a custom icon element (e.g., for unequip X icon)
     * @param {string} html - HTML content to replace icon
     */
    setCustomContent(html) {
        this.icon.style.display = 'none';
        const inner = document.createElement('div');
        inner.className = 'w-100 p-1 d-flex align-items-center justify-content-center';
        inner.style.height = '100%';
        inner.innerHTML = html;
        this.border.insertBefore(inner, this.border.firstChild);
    }
}
window.customElements.define('adventuring-icon-button', AdventuringIconButtonElement);
