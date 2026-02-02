const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement, createTooltip } = await loadModule('src/core/components/adventuring-tooltip-element.mjs');

export class AdventuringPickerIconElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-picker-icon-template'));

        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');

        this._tooltipTarget = this.styling;
        this.selectorPopup = null;
        this._buildSelectorContent = null;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.selectorPopup !== undefined) {
            this.selectorPopup.destroy();
            this.selectorPopup = undefined;
        }
    }

    setIcon(src) {
        this.icon.src = src;
    }

    onClick(handler) {
        this.styling.onclick = handler;
    }

    attachSelector({ buildContent, placement = 'bottom', maxWidth = 400, onHide }) {
        this._buildSelectorContent = buildContent;

        this.selectorPopup = createTooltip(this.styling, '', {
            interactive: true,
            trigger: 'click',
            placement,
            maxWidth,
            theme: 'adventuring-selector',
            appendTo: document.body,
            hideOnClick: true,
            onShow: (instance) => {
                if (this._buildSelectorContent) {
                    const content = this._buildSelectorContent();
                    if (content === false) {
                        return false; // Prevent showing
                    }
                    instance.setContent(content);
                }
            },
            onHide: () => {
                if (onHide) {
                    onHide();
                }
            }
        });
    }

    hideSelector() {
        if (this.selectorPopup) {
            this.selectorPopup.hide();
        }
    }

    setStylingClass(className) {
        this.styling.className = className;
    }
}
window.customElements.define('adventuring-picker-icon', AdventuringPickerIconElement);
