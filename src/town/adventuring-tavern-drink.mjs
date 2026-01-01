const { loadModule } = mod.getContext(import.meta);

const { createEffect, describeEffect } = await loadModule('src/core/adventuring-utils.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

class TavernDrinkRenderQueue {
    constructor() {
        this.icon = false;
        this.charges = false;
        this.tooltip = false;
    }
    updateAll() {
        this.icon = true;
        this.charges = true;
        this.tooltip = true;
    }
}

/**
 * A tavern drink that provides passive effects for a number of runs.
 * Separate from consumables - these are purchased with currency/materials.
 */
export class AdventuringTavernDrink extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._media = data.media;
        this.tier = data.tier || 1;
        this.flavorText = data.flavorText;
        
        // Raw effects from data - will be converted in postDataRegistration
        this._rawEffects = data.effects || [];
        this.effects = [];
        
        // Cost to purchase one run's worth
        this._cost = data.cost || {};
        this.cost = {
            currency: 0,
            slayerCoins: 0,
            materials: new Map()
        };

        this.renderQueue = new TavernDrinkRenderQueue();
    }

    get name() {
        return this._name;
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    /**
     * Get the number of runs remaining for this drink
     */
    get charges() {
        return this.manager.tavern.getCharges(this);
    }

    /**
     * Check if this drink is currently active (has charges)
     */
    get isActive() {
        return this.charges > 0;
    }

    /**
     * Check if this drink is equipped (in one of the 3 slots)
     */
    get isEquipped() {
        return this.manager.tavern.isEquipped(this);
    }

    /**
     * Get a human-readable cost string
     */
    get costText() {
        const parts = [];
        if(this.cost.currency > 0) {
            parts.push(`${this.cost.currency} coins`);
        }
        if(this.cost.slayerCoins > 0) {
            parts.push(`${this.cost.slayerCoins} slayer coins`);
        }
        this.cost.materials.forEach((qty, mat) => {
            parts.push(`${qty} ${mat.name}`);
        });
        return parts.join(', ') || 'Free';
    }

    /**
     * Get effect description text
     */
    get effectText() {
        return this.effects.map(e => describeEffect(e, this.manager)).join(', ');
    }

    /**
     * Get full description for tooltip
     */
    get description() {
        const lines = [];
        lines.push(this.effectText);
        if(this.flavorText) {
            lines.push(`<span class="text-muted font-italic">${this.flavorText}</span>`);
        }
        return lines.join('<br>');
    }

    /**
     * Check if player can afford to purchase runs
     */
    canAfford(runs = 1) {
        const stash = this.manager.stash;
        
        if(this.cost.currency > 0) {
            const currency = this.manager.materials.getObjectByID('adventuring:currency');
            if(!currency || stash.getCount(currency) < this.cost.currency * runs) {
                return false;
            }
        }
        
        if(this.cost.slayerCoins > 0) {
            const slayerCoins = this.manager.materials.getObjectByID('adventuring:slayer_coins');
            if(!slayerCoins || stash.getCount(slayerCoins) < this.cost.slayerCoins * runs) {
                return false;
            }
        }
        
        for(const [mat, qty] of this.cost.materials) {
            if(stash.getCount(mat) < qty * runs) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Purchase runs of this drink
     */
    purchase(runs = 1) {
        if(!this.canAfford(runs)) {
            this.manager.log.add(`Cannot afford ${this.name}`);
            return false;
        }

        const stash = this.manager.stash;

        // Deduct currency
        if(this.cost.currency > 0) {
            const currency = this.manager.materials.getObjectByID('adventuring:currency');
            stash.remove(currency, this.cost.currency * runs);
        }
        
        // Deduct slayer coins
        if(this.cost.slayerCoins > 0) {
            const slayerCoins = this.manager.materials.getObjectByID('adventuring:slayer_coins');
            stash.remove(slayerCoins, this.cost.slayerCoins * runs);
        }
        
        // Deduct materials
        for(const [mat, qty] of this.cost.materials) {
            stash.remove(mat, qty * runs);
        }

        // Add charges
        this.manager.tavern.addCharges(this, runs);
        this.manager.log.add(`Bought ${runs} run${runs > 1 ? 's' : ''} of ${this.name}`);
        
        return true;
    }

    get tooltip() {
        return TooltipBuilder.forTavernDrink(this).build();
    }

    postDataRegistration() {
        // Resolve cost references
        if(this._cost.currency) {
            this.cost.currency = this._cost.currency;
        }
        if(this._cost.slayerCoins) {
            this.cost.slayerCoins = this._cost.slayerCoins;
        }
        if(this._cost.materials) {
            this._cost.materials.forEach(({ id, qty }) => {
                const material = this.manager.materials.getObjectByID(id);
                if(material) {
                    this.cost.materials.set(material, qty);
                }
            });
        }
        delete this._cost;

        // Convert effects to standardized format
        // All tavern drink effects are passive by definition
        this.effects = this._rawEffects.map(effectData => {
            return createEffect({ 
                ...effectData, 
                trigger: 'passive'  // Force passive trigger
            }, this, this.name);
        });
        delete this._rawEffects;
    }

    onLoad() {
        this.renderQueue.updateAll();
    }

    encode(writer) {
        // Encoding handled by tavern manager
        return writer;
    }

    decode(reader, version) {
        // Decoding handled by tavern manager
        return reader;
    }
}
