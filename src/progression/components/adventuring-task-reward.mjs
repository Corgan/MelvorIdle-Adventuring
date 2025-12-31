const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

/**
 * Task reward item with optional tooltip
 */
export class AdventuringTaskRewardElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-task-reward-template'));
        
        this.reward = getElementFromFragment(this._content, 'reward', 'span');
        this.qty = getElementFromFragment(this._content, 'qty', 'span');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        
        this._tooltipTarget = this.reward;
        this._tooltipOptions = { placement: 'top' };
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    /**
     * Set the reward to display
     * @param {Object} options - Configuration options
     * @param {string|number} options.quantity - Quantity text to display
     * @param {string} [options.iconSrc] - Optional icon source
     * @param {string} [options.tooltipContent] - Optional tooltip content
     * @param {string} [options.colorClass] - Optional color class for text
     */
    setReward({ quantity, iconSrc, tooltipContent, colorClass }) {
        this.qty.textContent = quantity;
        
        if (iconSrc) {
            this.icon.src = iconSrc;
            this.icon.classList.remove('d-none');
        } else {
            this.icon.classList.add('d-none');
        }
        
        if (colorClass) {
            this.reward.className = `d-inline-flex align-items-center ${colorClass}`;
        } else {
            this.reward.className = 'd-inline-flex align-items-center';
        }
        
        if (tooltipContent) {
            this.setTooltipContent(tooltipContent);
        }
    }
}
window.customElements.define('adventuring-task-reward', AdventuringTaskRewardElement);
