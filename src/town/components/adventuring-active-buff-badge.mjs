/**
 * Active buff badge - displays an active consumable/drink buff
 * Used in tavern active drinks display
 */
export class AdventuringActiveBuffBadgeElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-active-buff-badge-template'));
        
        this.badge = getElementFromFragment(this._content, 'badge', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.text = getElementFromFragment(this._content, 'text', 'span');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    /**
     * Set the buff to display
     * @param {Object} options - Configuration options
     * @param {string} options.iconSrc - Icon URL
     * @param {string} options.name - Buff name
     * @param {number} options.remaining - Runs/charges remaining
     */
    setBuff({ iconSrc, name, remaining }) {
        this.icon.src = iconSrc;
        this.text.textContent = `${name} (${remaining} runs)`;
    }
}
window.customElements.define('adventuring-active-buff-badge', AdventuringActiveBuffBadgeElement);
