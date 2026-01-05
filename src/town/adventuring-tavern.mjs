const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringTavernElement } = await loadModule('src/town/components/adventuring-tavern.mjs');

const MAX_EQUIPPED_DRINKS = 3;

class AdventuringTavernRenderQueue {
    constructor() {
        this.drinks = false;
        this.equipped = false;
        this.details = false;
        this.all = false;
    }

    queueAll() {
        this.drinks = true;
        this.equipped = true;
        this.details = true;
        this.all = true;
    }
}

/**
 * Tavern manager - handles tavern drinks (passive run-length effects)
 * Now with tiered drinks similar to consumables.
 */
export class AdventuringTavern extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-tavern');
        this.renderQueue = new AdventuringTavernRenderQueue();

        // Charges per drink per tier (Map<drinkId, Map<tier, count>>)
        this.charges = new Map();
        
        // Equipped drinks with their tier (Map<drink, tier>)
        this.equipped = new Map();
        
        // Currently selected drink for detail view
        this.selectedDrink = null;
        this.selectedTier = 1;

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
        this.manager.party.setAllLocked(false);
        this.renderQueue.all = true;
        
        // Select first drink by default
        const drinks = this.manager.tavernDrinks.allObjects;
        if (drinks.length > 0 && !this.selectedDrink) {
            this.selectedDrink = drinks[0];
            this.selectedTier = 1;
        }
    }

    onHide() {
        this.manager.party.setAllLocked(true);
    }

    postDataRegistration() {
        // Nothing special needed
    }

    // =========================================
    // Charge Management (per tier)
    // =========================================

    /**
     * Get charge count for a drink's specific tier
     */
    getCharges(drink, tier) {
        const drinkCharges = this.charges.get(drink.id);
        if (!drinkCharges) return 0;
        return drinkCharges.get(tier) || 0;
    }

    /**
     * Add charges to a drink's specific tier
     */
    addCharges(drink, tier, amount) {
        if (!this.charges.has(drink.id)) {
            this.charges.set(drink.id, new Map());
        }
        const drinkCharges = this.charges.get(drink.id);
        const current = drinkCharges.get(tier) || 0;
        drinkCharges.set(tier, current + amount);
        
        drink.renderQueue.updateAll();
        this.renderQueue.equipped = true;
        this.renderQueue.details = true;
        this.manager.overview.renderQueue.buffs = true;
        
        // Invalidate effect cache if equipped
        if (this.isEquipped(drink)) {
            this.invalidateAllHeroEffects();
        }
    }

    /**
     * Remove charges from a drink's specific tier
     */
    removeCharges(drink, tier, amount) {
        if (!this.charges.has(drink.id)) return;
        
        const drinkCharges = this.charges.get(drink.id);
        const current = drinkCharges.get(tier) || 0;
        const newCharges = Math.max(current - amount, 0);
        drinkCharges.set(tier, newCharges);
        
        drink.renderQueue.updateAll();
        this.renderQueue.equipped = true;
        this.renderQueue.details = true;
        this.manager.overview.renderQueue.buffs = true;

        // If charges depleted and this tier is equipped, unequip
        const equippedTier = this.getEquippedTier(drink);
        if (newCharges <= 0 && equippedTier === tier) {
            this.unequip(drink);
        } else if (this.isEquipped(drink)) {
            this.invalidateAllHeroEffects();
        }
    }

    /**
     * Consume one charge from all equipped drinks (called at dungeon end)
     */
    consumeCharges() {
        for (const [drink, tier] of this.equipped.entries()) {
            if (this.getCharges(drink, tier) > 0) {
                this.removeCharges(drink, tier, 1);
            }
        }
    }

    /**
     * Reset all tavern drink state (for skill reset)
     */
    resetDrinks() {
        this.charges.clear();
        this.equipped.clear();
        this.selectedDrink = null;
        this.selectedTier = 1;
        this.renderQueue.queueAll();
    }

    // =========================================
    // Equipment Management
    // =========================================

    /**
     * Check if a drink is equipped (any tier)
     */
    isEquipped(drink) {
        return this.equipped.has(drink);
    }

    /**
     * Get the equipped tier for a drink (0 if not equipped)
     */
    getEquippedTier(drink) {
        return this.equipped.get(drink) || 0;
    }

    /**
     * Equip a drink at a specific tier
     */
    equip(drink, tier) {
        if (this.equipped.size >= MAX_EQUIPPED_DRINKS && !this.isEquipped(drink)) {
            this.manager.log.add(`Cannot equip more than ${MAX_EQUIPPED_DRINKS} drinks.`);
            return false;
        }
        if (this.getCharges(drink, tier) <= 0) {
            this.manager.log.add(`${drink.getTierName(tier)} has no charges. Craft some first.`);
            return false;
        }

        this.equipped.set(drink, tier);
        drink.renderQueue.updateAll();
        this.renderQueue.equipped = true;
        this.renderQueue.details = true;
        this.manager.overview.renderQueue.buffs = true;
        this.manager.log.add(`Equipped ${drink.getTierName(tier)}`);
        
        this.invalidateAllHeroEffects();
        return true;
    }

    /**
     * Unequip a drink
     */
    unequip(drink) {
        if (!this.isEquipped(drink)) return false;

        const tier = this.getEquippedTier(drink);
        this.equipped.delete(drink);
        drink.renderQueue.updateAll();
        this.renderQueue.equipped = true;
        this.renderQueue.details = true;
        this.manager.overview.renderQueue.buffs = true;
        this.manager.log.add(`Unequipped ${drink.getTierName(tier)}`);
        
        this.invalidateAllHeroEffects();
        return true;
    }

    /**
     * Toggle equip state for a drink at a tier
     */
    toggleEquip(drink, tier) {
        if (this.isEquipped(drink) && this.getEquippedTier(drink) === tier) {
            return this.unequip(drink);
        } else {
            // If already equipped at different tier, unequip first
            if (this.isEquipped(drink)) {
                this.unequip(drink);
            }
            return this.equip(drink, tier);
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
        for (const [drink, tier] of this.equipped.entries()) {
            const charges = this.getCharges(drink, tier);
            if (charges > 0) {
                active.push({ drink, tier, runsRemaining: charges });
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
        
        for (const [drink, tier] of this.equipped.entries()) {
            if (this.getCharges(drink, tier) > 0) {
                effects.push(...drink.getTierEffects(tier));
            }
        }
        
        return effects;
    }

    /**
     * Invalidate effect cache for all heroes.
     */
    invalidateAllHeroEffects() {
        if (this.manager.party) {
            this.manager.party.all.forEach(hero => {
                if (hero.effectCache) {
                    hero.invalidateEffects('tavern');
                }
            });
        }
    }

    // =========================================
    // Selection
    // =========================================

    selectDrink(drink) {
        const previousDrink = this.selectedDrink;
        this.selectedDrink = drink;
        this.selectedTier = 1;
        this.renderQueue.details = true;
        
        // Update selection styling on both drinks
        if (previousDrink) {
            previousDrink.component.setSelected(false);
        }
        if (drink) {
            drink.component.setSelected(true);
        }
    }

    selectTier(tier) {
        this.selectedTier = tier;
        this.renderQueue.details = true;
    }

    // =========================================
    // Rendering
    // =========================================

    render() {
        this.renderDrinks();
        this.renderEquipped();
        this.renderDetails();
    }

    renderDrinks() {
        if (!this.renderQueue.drinks && !this.renderQueue.all)
            return;

        // Mount drink components once
        this.component.drinks.replaceChildren();
        for (const drink of this.manager.tavernDrinks.allObjects) {
            // Check if component has mount method (may be undefined if custom element not registered)
            if (typeof drink.component.mount === 'function') {
                drink.component.mount(this.component.drinks);
            } else {
                // Fallback: manually append element
                this.component.drinks.appendChild(drink.component);
            }
            if (typeof drink.component.setSelected === 'function') {
                drink.component.setSelected(drink === this.selectedDrink);
            }
            drink.renderQueue.queueAll();
            drink.render();
        }

        this.renderQueue.drinks = false;
    }

    renderEquipped() {
        if (!this.renderQueue.equipped && !this.renderQueue.all)
            return;

        this.component.renderEquippedSlots(
            this.getActiveDrinks(),
            MAX_EQUIPPED_DRINKS,
            (drink) => {
                this.unequip(drink);
                this.render();
            }
        );

        this.renderQueue.equipped = false;
        this.renderQueue.all = false;
    }

    renderDetails() {
        if (!this.renderQueue.details && !this.renderQueue.all)
            return;

        if (!this.selectedDrink) {
            this.component.renderEmptyDetails();
            this.renderQueue.details = false;
            return;
        }

        const drink = this.selectedDrink;
        const tier = this.selectedTier;

        this.component.renderDetails({
            drink,
            tier,
            charges: this.getCharges(drink, tier),
            equippedTier: this.getEquippedTier(drink),
            canAfford: drink.canAffordTier(tier),
            onSelectTier: (t) => {
                this.selectTier(t);
                this.render();
            },
            onCraft: () => {
                if (drink.craftTier(tier)) {
                    this.render();
                }
            },
            onEquip: () => {
                this.toggleEquip(drink, tier);
                this.render();
            }
        });

        this.renderQueue.details = false;
    }

    // =========================================
    // Save/Load
    // =========================================

    encode(writer) {
        // Save charges for each drink (nested map: drinkId -> tier -> count)
        writer.writeUint32(this.charges.size);
        for (const [drinkId, tierCharges] of this.charges) {
            writer.writeString(drinkId);
            writer.writeUint32(tierCharges.size);
            for (const [tier, count] of tierCharges) {
                writer.writeUint8(tier);
                writer.writeUint32(count);
            }
        }
        
        // Save equipped drinks with their tier
        writer.writeUint32(this.equipped.size);
        for (const [drink, tier] of this.equipped) {
            writer.writeNamespacedObject(drink);
            writer.writeUint8(tier);
        }
        
        return writer;
    }

    decode(reader, version) {
        // Load charges
        this.charges = new Map();
        const chargesCount = reader.getUint32();
        for (let i = 0; i < chargesCount; i++) {
            const drinkId = reader.getString();
            const tierCount = reader.getUint32();
            const tierCharges = new Map();
            for (let j = 0; j < tierCount; j++) {
                const tier = reader.getUint8();
                const count = reader.getUint32();
                tierCharges.set(tier, count);
            }
            this.charges.set(drinkId, tierCharges);
        }
        
        // Load equipped drinks
        this.equipped = new Map();
        const equippedCount = reader.getUint32();
        for (let i = 0; i < equippedCount; i++) {
            const drink = reader.getNamespacedObject(this.manager.tavernDrinks);
            const tier = reader.getUint8();
            if (drink && typeof drink !== "string") {
                this.equipped.set(drink, tier);
            }
        }
        
        return reader;
    }
}
