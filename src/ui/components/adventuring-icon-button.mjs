const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement, createTooltip } = await loadModule('src/core/adventuring-tooltip-element.mjs');

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
        if(icon) {
            this.icon.src = icon;
        }
        this.icon.classList.toggle('invisible', hideIcon);
        this.border.className = `border-2x border-rounded-equip combat-equip-img fishing-img m-0 ${borderClass}`;
        this.border.style.cssText = 'position: relative; overflow: hidden; border-width: 2px!important; border-style: solid!important;';
        if(cornerBadgeText !== undefined) {
            this.cornerBadge.textContent = cornerBadgeText;
            this.cornerBadge.className = `badge ${cornerBadgeClass}`;
            this.cornerBadge.style.cssText = 'position: absolute; top: 2px; right: 2px; font-size: 0.5rem; z-index: 10;';
            this.cornerBadge.classList.remove('d-none');
        } else {
            this.cornerBadge.classList.add('d-none');
        }
        if(bottomBadgeText !== undefined) {
            this.bottomBadge.innerHTML = `<small class="badge-pill ${bottomBadgeClass}">${bottomBadgeText}</small>`;
            this.bottomBadge.classList.remove('d-none');
        } else {
            this.bottomBadge.classList.add('d-none');
        }
        if(tooltipContent) {
            this.setTooltipContent(tooltipContent);
        }
        this.container.onclick = onClick || null;
    }

    setBorderStyle(style) {
        this.border.style.borderStyle = `${style}!important`;
    }

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
