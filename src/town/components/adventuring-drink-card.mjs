/**
 * Drink card for tavern menu
 */
export class AdventuringDrinkCardElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-drink-card-template'));
        
        this.col = getElementFromFragment(this._content, 'col', 'div');
        this.card = getElementFromFragment(this._content, 'card', 'div');
        this.tierBadge = getElementFromFragment(this._content, 'tierBadge', 'span');
        this.duration = getElementFromFragment(this._content, 'duration', 'small');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'strong');
        this.effects = getElementFromFragment(this._content, 'effects', 'div');
        this.flavor = getElementFromFragment(this._content, 'flavor', 'div');
        this.costItems = getElementFromFragment(this._content, 'costItems', 'div');
        this.buyBtn = getElementFromFragment(this._content, 'buyBtn', 'button');
        
        this.onBuy = null;
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    disconnectedCallback() {
        this.onBuy = null;
    }

    /**
     * Set the drink to display
     * @param {Object} options - Configuration options
     * @param {Object} options.drink - Drink consumable object
     * @param {boolean} options.canAfford - Whether the player can afford this drink
     * @param {Function} options.onBuy - Callback when buy button is clicked
     * @param {Function} options.renderCosts - Function to render cost items into costItems container
     */
    setDrink({ drink, canAfford, onBuy, renderCosts }) {
        // Tier
        const tierColors = ['secondary', 'info', 'warning'];
        this.tierBadge.className = `badge badge-${tierColors[drink.tier - 1] || 'secondary'}`;
        this.tierBadge.textContent = `Tier ${drink.tier}`;
        
        // Duration
        this.duration.textContent = `${drink.duration} runs`;
        
        // Icon and name
        this.icon.src = drink.media;
        this.nameText.textContent = drink.name;
        
        // Effects
        this.effects.textContent = drink.effectText;
        
        // Flavor text
        if (drink.flavorText) {
            this.flavor.textContent = drink.flavorText;
            this.flavor.classList.remove('d-none');
        } else {
            this.flavor.classList.add('d-none');
        }
        
        // Costs - delegate to parent for rendering adventuring-material components
        this.costItems.replaceChildren();
        if (renderCosts) {
            renderCosts(this.costItems, drink);
        }
        
        // Buy button
        this.onBuy = onBuy;
        if (canAfford) {
            this.buyBtn.className = 'btn btn-sm btn-block btn-primary';
            this.buyBtn.textContent = 'Buy';
            this.buyBtn.disabled = false;
            this.buyBtn.onclick = () => {
                if (this.onBuy) {
                    this.onBuy(drink);
                }
            };
        } else {
            this.buyBtn.className = 'btn btn-sm btn-block btn-secondary';
            this.buyBtn.textContent = 'Cannot Afford';
            this.buyBtn.disabled = true;
            this.buyBtn.onclick = null;
        }
    }
}
window.customElements.define('adventuring-drink-card', AdventuringDrinkCardElement);
