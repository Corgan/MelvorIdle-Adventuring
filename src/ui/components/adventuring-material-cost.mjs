/**
 * Material cost display element - shows material icon with have/need counts
 * Used in workshop costs, tavern drink costs, crafting requirements
 */
export class AdventuringMaterialCostElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-material-cost-template'));
        
        this.container = getElementFromFragment(this._content, 'container', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.text = getElementFromFragment(this._content, 'text', 'span');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    /**
     * Set the material cost display
     * @param {Object} options - Configuration options
     * @param {string} options.iconSrc - Material icon URL
     * @param {number} options.have - Amount player has
     * @param {number} options.need - Amount required
     */
    setCost({ iconSrc, have, need }) {
        this.icon.src = iconSrc;
        this.text.textContent = `${have}/${need}`;
        
        const canAfford = have >= need;
        this.container.className = `d-flex align-items-center mr-3 ${canAfford ? 'text-success' : 'text-danger'}`;
    }

    /**
     * Set a simple quantity display without have/need comparison
     * @param {string} iconSrc - Material icon URL
     * @param {number|string} quantity - Quantity to display
     * @param {string} [colorClass] - Optional color class
     */
    setQuantity(iconSrc, quantity, colorClass = '') {
        this.icon.src = iconSrc;
        this.text.textContent = quantity;
        this.container.className = `d-flex align-items-center mr-3 ${colorClass}`;
    }
}
window.customElements.define('adventuring-material-cost', AdventuringMaterialCostElement);
