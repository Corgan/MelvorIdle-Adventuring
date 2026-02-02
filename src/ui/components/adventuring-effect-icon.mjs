const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/components/adventuring-tooltip-element.mjs');

export class AdventuringEffectIconElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-effect-icon-template'));

        this.icon = getElementFromFragment(this._content, 'icon', 'div');
        this.img = getElementFromFragment(this._content, 'img', 'img');

        this._tooltipTarget = this.icon;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    setEffect(effect) {
        this.img.src = effect.media;
        this.img.alt = effect.name;

        if (effect.colorClass) {
            this.icon.classList.add(effect.colorClass);
        }

        this.setTooltipContent(effect.tooltip);
    }
}
window.customElements.define('adventuring-effect-icon', AdventuringEffectIconElement);
