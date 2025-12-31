/**
 * Achievement reward element - displays a reward item in achievement cards
 * Handles currency, stat bonuses, and material rewards
 */
export class AdventuringAchievementRewardElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-achievement-reward-template'));
        
        this.container = getElementFromFragment(this._content, 'container', 'span');
        this.text = getElementFromFragment(this._content, 'text', 'span');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    /**
     * Set a currency reward
     * @param {number} amount - Currency amount
     * @param {string} iconSrc - Currency icon URL
     */
    setCurrency(amount, iconSrc) {
        this.text.textContent = amount + ' ';
        this.text.className = '';
        this.icon.src = iconSrc;
        this.icon.classList.remove('d-none');
    }

    /**
     * Set a stat bonus reward
     * @param {number} value - Stat value bonus
     * @param {string} statName - Short stat name (e.g., "STR")
     */
    setStat(value, statName) {
        this.text.textContent = `+${value} ${statName}`;
        this.text.className = 'text-success';
        this.icon.classList.add('d-none');
    }

    /**
     * Set a material reward
     * @param {number} quantity - Material quantity
     * @param {string} iconSrc - Material icon URL
     */
    setMaterial(quantity, iconSrc) {
        this.text.textContent = quantity + ' ';
        this.text.className = '';
        this.icon.src = iconSrc;
        this.icon.classList.remove('d-none');
    }
}
window.customElements.define('adventuring-achievement-reward', AdventuringAchievementRewardElement);
