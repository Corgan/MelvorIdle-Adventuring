const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement, createTooltip } = await loadModule('src/core/adventuring-tooltip-element.mjs');

/**
 * Picker icon element - small clickable icon with tooltip and optional selector popup
 * 
 * Replaces patterns in: adventuring-job-small, adventuring-ability-small
 * 
 * Features:
 * - Small icon box with tooltip
 * - Optional interactive selector popup (separate tippy instance)
 * - Clickable
 */
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

    /**
     * Set the icon source
     * @param {string} src - Image URL
     */
    setIcon(src) {
        this.icon.src = src;
    }

    /**
     * Set click handler (for simple click actions)
     * @param {Function} handler - Click callback
     */
    onClick(handler) {
        this.styling.onclick = handler;
    }

    /**
     * Attach an interactive selector popup
     * @param {Object} options
     * @param {Function} options.buildContent - Function that returns content for the popup
     * @param {string} [options.placement='bottom'] - Popup placement
     * @param {number} [options.maxWidth=400] - Max width of popup
     * @param {Function} [options.onHide] - Callback when popup hides
     */
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

    /**
     * Manually hide the selector popup
     */
    hideSelector() {
        if (this.selectorPopup) {
            this.selectorPopup.hide();
        }
    }

    /**
     * Update the styling class
     * @param {string} className - CSS class string
     */
    setStylingClass(className) {
        this.styling.className = className;
    }
}
window.customElements.define('adventuring-picker-icon', AdventuringPickerIconElement);
