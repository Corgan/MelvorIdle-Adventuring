const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

export class AdventuringWorkshopProductElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-workshop-product-template'));

        this.clickable = getElementFromFragment(this._content, 'clickable', 'div');
        this.border = getElementFromFragment(this._content, 'border', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');

        this._tooltipTarget = this.clickable;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    setProduct({ iconSrc, name, selected = false, active = false, tooltip = null }) {
        this.icon.src = iconSrc;
        this.setTooltipContent(tooltip || name);

        this.border.classList.remove('border-secondary', 'border-info', 'border-warning');
        if (selected) {
            this.border.classList.add('border-info');
        } else if (active) {
            this.border.classList.add('border-warning');
        } else {
            this.border.classList.add('border-secondary');
        }
    }
}
window.customElements.define('adventuring-workshop-product', AdventuringWorkshopProductElement);
