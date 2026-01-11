const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

export class AdventuringPassiveBadgeElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-passive-badge-template'));

        this.badge = getElementFromFragment(this._content, 'badge', 'div');
        this.nameText = getElementFromFragment(this._content, 'name', 'small');

        this._tooltipTarget = this.badge;
        this._tooltipOptions = { placement: 'top' };
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    setPassive(name, tooltipContent) {
        this.nameText.textContent = name;
        this.setTooltipContent(tooltipContent);
    }
}
window.customElements.define('adventuring-passive-badge', AdventuringPassiveBadgeElement);
