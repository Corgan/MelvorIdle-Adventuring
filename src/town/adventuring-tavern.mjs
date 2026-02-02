const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { createEffect, filterEffects } = await loadModule('src/core/utils/adventuring-utils.mjs');

await loadModule('src/town/components/adventuring-tavern.mjs');

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

export class AdventuringTavern extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-tavern');
        this.renderQueue = new AdventuringTavernRenderQueue();

        this.charges = new Map();

        this.equipped = new Map();

        this.selectedDrink = null;
        this.selectedTier = 1;

        this.component.back.onclick = () => this.back();

        // Consume charges at end of dungeon runs
        this.manager.conductor.listen('dungeon_end', () => this.consumeCharges());
    }

    get maxEquipped() { return this.manager.config.limits.maxEquippedDrinks; }

    back() {
        if(this.active) {
            this.manager.town.setBuilding(undefined);
        }
    }

    onLoad() {
        super.onLoad();
        this.renderQueue.queueAll();
    }

    onShow() {
        this.manager.party.setAllLocked(false);
        this.renderQueue.all = true;

        const drinks = this.manager.tavernDrinks.allObjects;
        if (drinks.length > 0 && !this.selectedDrink) {
            this.selectedDrink = drinks[0];
            this.selectedTier = 1;
        }
    }

    onHide() {
        this.manager.party.setAllLocked(true);
    }

    // Required by base class contract - no additional registration needed
    postDataRegistration() {

    }




    getCharges(drink, tier) {
        const drinkCharges = this.charges.get(drink.id);
        if (!drinkCharges) return 0;
        return drinkCharges.get(tier) || 0;
    }

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
        this.manager.party.invalidateAllEffects('tavern');
        this.manager.overview.renderQueue.buffs = true;
    }

    removeCharges(drink, tier, amount) {
        if (!this.charges.has(drink.id)) return;

        const drinkCharges = this.charges.get(drink.id);
        const current = drinkCharges.get(tier) || 0;
        const newCharges = Math.max(current - amount, 0);
        drinkCharges.set(tier, newCharges);

        drink.renderQueue.updateAll();
        this.renderQueue.equipped = true;
        this.renderQueue.details = true;
        this.manager.party.invalidateAllEffects('tavern');
        this.manager.overview.renderQueue.buffs = true;

        const equippedTier = this.getEquippedTier(drink);
        if (newCharges <= 0 && equippedTier === tier) {
            this.unequip(drink);
        }
    }

    consumeCharges() {
        for (const [drink, tier] of this.equipped.entries()) {
            if (this.getCharges(drink, tier) > 0) {
                this.removeCharges(drink, tier, 1);
            }
        }
    }

    resetDrinks() {
        this.charges.clear();
        this.equipped.clear();
        this.selectedDrink = null;
        this.selectedTier = 1;
        this.renderQueue.queueAll();
    }




    isEquipped(drink) {
        return this.equipped.has(drink);
    }

    getEquippedTier(drink) {
        return this.equipped.get(drink) || 0;
    }

    equip(drink, tier) {
        if (this.equipped.size >= this.maxEquipped && !this.isEquipped(drink)) {
            this.manager.log.add(`Cannot equip more than ${this.maxEquipped} drinks.`, {
                category: 'town'
            });
            return false;
        }
        if (this.getCharges(drink, tier) <= 0) {
            this.manager.log.add(`${drink.getTierName(tier)} has no charges. Craft some first.`, {
                category: 'town'
            });
            return false;
        }

        this.equipped.set(drink, tier);
        drink.renderQueue.updateAll();
        this.renderQueue.equipped = true;
        this.renderQueue.details = true;
        this.manager.party.invalidateAllEffects('tavern');
        this.manager.overview.renderQueue.buffs = true;
        this.manager.log.add(`Equipped ${drink.getTierName(tier)}`, {
            category: 'town'
        });

        return true;
    }

    unequip(drink) {
        if (!this.isEquipped(drink)) return false;

        const tier = this.getEquippedTier(drink);
        this.equipped.delete(drink);
        drink.renderQueue.updateAll();
        this.renderQueue.equipped = true;
        this.renderQueue.details = true;
        this.manager.party.invalidateAllEffects('tavern');
        this.manager.log.add(`Unequipped ${drink.getTierName(tier)}`, {
            category: 'town'
        });
        this.manager.overview.renderQueue.buffs = true;

        return true;
    }

    toggleEquip(drink, tier) {
        if (this.isEquipped(drink) && this.getEquippedTier(drink) === tier) {
            return this.unequip(drink);
        } else {

            if (this.isEquipped(drink)) {
                this.unequip(drink);
            }
            return this.equip(drink, tier);
        }
    }




    get activeDrinks() {
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
     * Get effects from equipped drinks
     * @param {Object} filters - Optional filters (trigger, party, type, etc.)
     * @returns {Array} Filtered effects with source metadata
     */
    getEffects(filters = { trigger: 'passive' }) {
        let effects = [];

        for (const [drink, tier] of this.equipped.entries()) {
            if (this.getCharges(drink, tier) > 0) {
                const tierEffects = drink.getTierEffects(tier);
                // Effects already have sourcePath from drink.postDataRegistration()
                effects.push(...tierEffects);
            }
        }

        return filterEffects(effects, filters);
    }




    selectDrink(drink) {
        const previousDrink = this.selectedDrink;
        this.selectedDrink = drink;
        this.selectedTier = 1;
        this.renderQueue.details = true;

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




    render() {
        this.renderDrinks();
        this.renderEquipped();
        this.renderDetails();
    }

    renderDrinks() {
        if (!this.renderQueue.drinks && !this.renderQueue.all)
            return;

        this.component.drinks.replaceChildren();
        for (const drink of this.manager.tavernDrinks.allObjects) {

            if (typeof drink.component.mount === 'function') {
                drink.component.mount(this.component.drinks);
            } else {

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
            this.activeDrinks,
            this.maxEquipped,
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




    encode(writer) {
        writer.writeUint32(this.charges.size);
        for (const [drinkId, tierCharges] of this.charges) {
            const drink = this.manager.tavernDrinks.getObjectByID(drinkId);
            writer.writeNamespacedObject(drink);
            writer.writeUint32(tierCharges.size);
            for (const [tier, count] of tierCharges) {
                writer.writeUint8(tier);
                writer.writeUint32(count);
            }
        }

        writer.writeUint32(this.equipped.size);
        for (const [drink, tier] of this.equipped) {
            writer.writeNamespacedObject(drink);
            writer.writeUint8(tier);
        }

        return writer;
    }

    decode(reader, version) {

        this.charges = new Map();
        const chargesCount = reader.getUint32();
        for (let i = 0; i < chargesCount; i++) {
            const drink = reader.getNamespacedObject(this.manager.tavernDrinks);
            const tierCount = reader.getUint32();
            const tierCharges = new Map();
            for (let j = 0; j < tierCount; j++) {
                const tier = reader.getUint8();
                const count = reader.getUint32();
                tierCharges.set(tier, count);
            }
            if (drink && typeof drink !== 'string') {
                this.charges.set(drink.id, tierCharges);
            }
        }

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
