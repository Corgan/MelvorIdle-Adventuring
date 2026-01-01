const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringTavernElement } = await loadModule('src/town/components/adventuring-tavern.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { AdventuringDrinkCardElement } = await loadModule('src/town/components/adventuring-drink-card.mjs');
const { AdventuringActiveBuffBadgeElement } = await loadModule('src/town/components/adventuring-active-buff-badge.mjs');
const { AdventuringEmptyStateElement } = await loadModule('src/ui/components/adventuring-empty-state.mjs');

const MAX_EQUIPPED_DRINKS = 3;

class TavernRenderQueue {
    constructor() {
        this.drinks = false;
        this.equipped = false;
        this.all = false;
    }
}

/**
 * Tavern manager - handles tavern drinks (passive run-length effects)
 * Separate from consumables which are triggered effects.
 */
export class AdventuringTavern extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-tavern');
        this.renderQueue = new TavernRenderQueue();

        // Charges per drink (Map<TavernDrink, number>)
        this.charges = new Map();
        
        // Equipped drinks (max 3)
        this.equipped = [];

        this.component.back.onclick = () => this.back();
    }

    back() {
        if(this.active) {
            this.manager.town.setBuilding(undefined);
        }
    }

    onLoad() {
        super.onLoad();
    }

    onShow() {
        this.manager.party.all.forEach(member => member.setLocked(false));
        this.renderQueue.all = true;
    }

    onHide() {
        this.manager.party.all.forEach(member => member.setLocked(true));
    }

    postDataRegistration() {
        // Nothing special needed - drinks are registered in main manager
    }

    // =========================================
    // Charge Management
    // =========================================

    /**
     * Get charge count for a drink
     */
    getCharges(drink) {
        return this.charges.get(drink) || 0;
    }

    /**
     * Add charges to a drink
     */
    addCharges(drink, amount) {
        const current = this.getCharges(drink);
        this.charges.set(drink, current + amount);
        drink.renderQueue.updateAll();
        this.renderQueue.equipped = true;
        this.manager.overview.renderQueue.buffs = true;
        
        // Invalidate effect cache for all heroes if equipped
        if(this.isEquipped(drink)) {
            this.invalidateAllHeroEffects();
        }
    }

    /**
     * Remove charges from a drink
     */
    removeCharges(drink, amount) {
        const current = this.getCharges(drink);
        const newCharges = Math.max(current - amount, 0);
        this.charges.set(drink, newCharges);
        drink.renderQueue.updateAll();
        this.renderQueue.equipped = true;
        this.manager.overview.renderQueue.buffs = true;

        // If charges depleted and equipped, unequip
        if(newCharges <= 0 && this.isEquipped(drink)) {
            this.unequip(drink);
        } else if(this.isEquipped(drink)) {
            this.invalidateAllHeroEffects();
        }
    }

    /**
     * Consume one charge from all equipped drinks (called at dungeon end)
     */
    consumeCharges() {
        for(const drink of this.equipped.slice()) { // slice to avoid mutation during iteration
            if(this.getCharges(drink) > 0) {
                this.removeCharges(drink, 1);
            }
        }
    }

    // =========================================
    // Equipment Management
    // =========================================

    /**
     * Check if a drink is equipped
     */
    isEquipped(drink) {
        return this.equipped.includes(drink);
    }

    /**
     * Equip a drink
     */
    equip(drink) {
        if(this.equipped.length >= MAX_EQUIPPED_DRINKS) {
            this.manager.log.add(`Cannot equip more than ${MAX_EQUIPPED_DRINKS} drinks.`);
            return false;
        }
        if(this.isEquipped(drink)) {
            return false;
        }
        if(this.getCharges(drink) <= 0) {
            this.manager.log.add(`${drink.name} has no charges. Purchase some first.`);
            return false;
        }

        this.equipped.push(drink);
        drink.renderQueue.updateAll();
        this.renderQueue.equipped = true;
        this.manager.overview.renderQueue.buffs = true;
        this.manager.log.add(`Equipped ${drink.name}`);
        
        this.invalidateAllHeroEffects();
        return true;
    }

    /**
     * Unequip a drink
     */
    unequip(drink) {
        const index = this.equipped.indexOf(drink);
        if(index === -1) return false;

        this.equipped.splice(index, 1);
        drink.renderQueue.updateAll();
        this.renderQueue.equipped = true;
        this.manager.overview.renderQueue.buffs = true;
        this.manager.log.add(`Unequipped ${drink.name}`);
        
        this.invalidateAllHeroEffects();
        return true;
    }

    /**
     * Toggle equip state
     */
    toggleEquip(drink) {
        if(this.isEquipped(drink)) {
            return this.unequip(drink);
        } else {
            return this.equip(drink);
        }
    }

    // =========================================
    // Effect Getters
    // =========================================

    /**
     * Get all active equipped drinks with their remaining charges
     */
    getActiveDrinks() {
        const active = [];
        for(const drink of this.equipped) {
            const charges = this.getCharges(drink);
            if(charges > 0) {
                active.push({ drink, runsRemaining: charges });
            }
        }
        return active;
    }

    /**
     * Get all effects from equipped drinks.
     * @returns {StandardEffect[]} Array of standardized effects
     */
    getEffects() {
        const effects = [];
        
        for(const drink of this.equipped) {
            if(this.getCharges(drink) > 0) {
                effects.push(...drink.effects);
            }
        }
        
        return effects;
    }

    /**
     * Invalidate effect cache for all heroes.
     */
    invalidateAllHeroEffects() {
        if(this.manager.party) {
            this.manager.party.all.forEach(hero => {
                if(hero.effectCache) {
                    hero.invalidateEffects('tavern');
                }
            });
        }
    }

    // =========================================
    // Rendering
    // =========================================

    render() {
        this.renderDrinks();
        this.renderEquipped();
    }

    renderDrinks() {
        if(!this.renderQueue.drinks && !this.renderQueue.all)
            return;

        this.component.drinks.replaceChildren();

        const drinks = this.manager.tavernDrinks.allObjects;
        drinks.forEach(drink => {
            const card = this.createDrinkCard(drink);
            this.component.drinks.appendChild(card);
        });

        this.renderQueue.drinks = false;
    }

    renderEquipped() {
        if(!this.renderQueue.equipped && !this.renderQueue.all)
            return;

        this.component.activeBuffs.replaceChildren();
        
        const activeDrinks = this.getActiveDrinks();

        if(activeDrinks.length === 0) {
            const empty = new AdventuringEmptyStateElement();
            empty.setMessage('No drinks equipped. Buy and equip drinks to gain buffs!', 'p-2');
            this.component.activeBuffs.appendChild(empty);
        } else {
            activeDrinks.forEach(({ drink, runsRemaining }) => {
                const badge = new AdventuringActiveBuffBadgeElement();
                this.component.activeBuffs.appendChild(badge);
                badge.setBuff({
                    iconSrc: drink.media,
                    name: drink.name,
                    remaining: runsRemaining
                });
                // Click to unequip
                badge.onclick = () => {
                    this.unequip(drink);
                    this.render();
                };
                badge.style.cursor = 'pointer';
            });
        }

        this.renderQueue.equipped = false;
        this.renderQueue.all = false;
    }

    createDrinkCard(drink) {
        const card = new AdventuringDrinkCardElement();
        
        card.setDrink({
            drink,
            charges: this.getCharges(drink),
            isEquipped: this.isEquipped(drink),
            canAfford: drink.canAfford(),
            onBuy: (d) => {
                if(d.purchase()) {
                    this.renderQueue.all = true;
                    this.render();
                }
            },
            onEquip: (d) => {
                this.toggleEquip(d);
                this.renderQueue.all = true;
                this.render();
            }
        });
        
        return card;
    }

    // =========================================
    // Save/Load
    // =========================================

    encode(writer) {
        // Save charges for each drink
        writer.writeMap(this.charges, 
            (key, writer) => writer.writeNamespacedObject(key),
            (value, writer) => writer.writeUint32(value)
        );
        
        // Save equipped drinks
        writer.writeArray(this.equipped, (drink, writer) => {
            writer.writeNamespacedObject(drink);
        });
        
        return writer;
    }

    decode(reader, version) {
        // Load charges
        this.charges = new Map();
        reader.getComplexMap((reader) => {
            const key = reader.getNamespacedObject(this.manager.tavernDrinks);
            const value = reader.getUint32();
            if(typeof key !== "string" && key !== undefined) {
                this.charges.set(key, value);
            }
        });
        
        // Load equipped drinks
        const equippedIds = reader.getArray((reader) => {
            return reader.getNamespacedObject(this.manager.tavernDrinks);
        });
        
        // Filter out any invalid drinks
        this.equipped = equippedIds.filter(d => d && typeof d !== "string");
        
        return reader;
    }
}
