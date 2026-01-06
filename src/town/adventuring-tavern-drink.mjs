const { loadModule } = mod.getContext(import.meta);

const { createEffect, describeEffect, describeEffectFull } = await loadModule('src/core/adventuring-utils.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { AdventuringTavernDrinkElement } = await loadModule('src/town/components/adventuring-tavern-drink.mjs');

class AdventuringTavernDrinkRenderQueue {
    constructor() {
        this.icon = false;
        this.charges = false;
        this.tooltip = false;
        this.equipped = false;
    }
    queueAll() {
        this.icon = true;
        this.charges = true;
        this.tooltip = true;
        this.equipped = true;
    }
    updateAll() {
        this.queueAll();
    }
}

/**
 * A tavern drink with 4 tiers that provides passive effects for a number of runs.
 * Similar to consumables but purchased/crafted at the tavern.
 * 
 * Data format:
 * {
 *   "id": "ale",
 *   "name": "Adventurer's Ale",
 *   "media": "...",
 *   "type": "drink",
 *   "tiers": [
 *     {
 *       "tier": 1,
 *       "nameSuffix": "I",
 *       "media": "...",
 *       "flavorText": "...",
 *       "effects": [...],
 *       "materials": [{ "id": "...", "count": N }]
 *     },
 *     ...
 *   ]
 * }
 */
export class AdventuringTavernDrink extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._media = data.media;
        
        // Tier data - array of tier definitions
        this._tiers = data.tiers || [];
        this.tiers = new Map(); // Map<tierNumber, tierData>

        this.component = createElement('adventuring-tavern-drink');
        this.renderQueue = new AdventuringTavernDrinkRenderQueue();
        
        // Use setOnClick if available (browser), otherwise try direct access (may be undefined in test env)
        if (typeof this.component.setOnClick === 'function') {
            this.component.setOnClick(() => this.onClick());
        } else if (this.component.clickable) {
            this.component.clickable.onclick = () => this.onClick();
        }
    }

    /**
     * Handle click on the drink icon
     */
    onClick() {
        this.manager.tavern.selectDrink(this);
        this.manager.tavern.render();
    }

    get name() {
        return this._name;
    }

    /**
     * Get description (flavor text from tier 1)
     */
    get description() {
        return this.getTierFlavorText(1);
    }

    /**
     * Get the name for a specific tier
     */
    getTierName(tier) {
        const tierData = this.tiers.get(tier);
        if (!tierData) return this._name;
        return tierData.nameSuffix ? `${this._name} ${tierData.nameSuffix}` : this._name;
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    /**
     * Get media for a specific tier
     */
    getTierMedia(tier) {
        const tierData = this.tiers.get(tier);
        if (tierData && tierData.media) {
            return this.getMediaURL(tierData.media);
        }
        return this.media;
    }

    /**
     * Get effects for a specific tier
     */
    getTierEffects(tier) {
        const tierData = this.tiers.get(tier);
        return tierData ? tierData.effects : [];
    }

    /**
     * Get materials for a specific tier
     */
    getTierMaterials(tier) {
        const tierData = this.tiers.get(tier);
        return tierData ? tierData.materials : new Map();
    }

    /**
     * Get flavor text for a specific tier
     */
    getTierFlavorText(tier) {
        const tierData = this.tiers.get(tier);
        return tierData ? tierData.flavorText : '';
    }

    /**
     * Get charge count for a specific tier
     */
    getCharges(tier) {
        return this.manager.tavern.getCharges(this, tier);
    }

    /**
     * Get total charges across all tiers
     */
    get totalCharges() {
        let total = 0;
        for (let t = 1; t <= 4; t++) {
            total += this.getCharges(t);
        }
        return total;
    }

    /**
     * Get the currently equipped tier (0 if not equipped)
     */
    get equippedTier() {
        return this.manager.tavern.getEquippedTier(this);
    }

    /**
     * Check if any tier is equipped
     */
    get isEquipped() {
        return this.equippedTier > 0;
    }

    /**
     * Check if this drink is active (equipped and has charges)
     */
    get isActive() {
        const tier = this.equippedTier;
        return tier > 0 && this.getCharges(tier) > 0;
    }

    /**
     * Get effect text for a specific tier
     */
    getTierEffectText(tier) {
        const effects = this.getTierEffects(tier);
        return effects.map(e => describeEffect(e, this.manager)).join(', ');
    }

    /**
     * Get description for a specific tier
     */
    getTierDescription(tier) {
        const effects = this.getTierEffects(tier);
        const flavorText = this.getTierFlavorText(tier);
        
        const effectDescs = effects.map(e => describeEffectFull(e, this.manager));
        const generated = effectDescs.join('. ');
        
        if (flavorText) {
            return generated ? `${generated}.\n\n${flavorText}` : flavorText;
        }
        
        return generated || 'No effect.';
    }

    /**
     * Get material cost text for a specific tier
     */
    getTierCostText(tier) {
        const materials = this.getTierMaterials(tier);
        if (!materials || materials.size === 0) return 'Free';
        
        const parts = [];
        for (const [mat, qty] of materials) {
            parts.push(`${qty} ${mat.name}`);
        }
        return parts.join(', ');
    }

    /**
     * Check if the player can afford to craft a specific tier
     */
    canAffordTier(tier) {
        const materials = this.getTierMaterials(tier);
        if (!materials || materials.size === 0) return false;
        
        for (const [mat, qty] of materials) {
            if (this.manager.stash.getCount(mat) < qty) return false;
        }
        return true;
    }

    /**
     * Craft one charge of a specific tier
     */
    craftTier(tier) {
        const materials = this.getTierMaterials(tier);
        if (!materials || materials.size === 0) return false;
        
        // Check materials
        for (const [mat, qty] of materials) {
            if (this.manager.stash.getCount(mat) < qty) return false;
        }

        // Deduct materials
        for (const [mat, qty] of materials) {
            this.manager.stash.remove(mat, qty);
        }

        // Add charge
        this.manager.tavern.addCharges(this, tier, 1);
        this.manager.log.add(`Crafted ${this.getTierName(tier)}`);
        this.renderQueue.updateAll();
        return true;
    }

    /**
     * Use one charge of the equipped tier
     */
    useCharge() {
        const tier = this.equippedTier;
        if (tier <= 0) return false;
        if (this.getCharges(tier) <= 0) return false;
        
        this.manager.tavern.removeCharges(this, tier, 1);
        this.renderQueue.updateAll();
        return true;
    }

    get tooltip() {
        return TooltipBuilder.forTavernDrink(this, this.totalCharges).build();
    }

    /**
     * Render the drink's component
     */
    render() {
        if (this.renderQueue.icon) {
            this.component.icon.src = this.media;
            this.renderQueue.icon = false;
        }
        
        if (this.renderQueue.charges) {
            this.component.setCharges(this.totalCharges);
            this.renderQueue.charges = false;
        }
        
        if (this.renderQueue.equipped) {
            this.component.setEquipped(this.isEquipped);
            this.renderQueue.equipped = false;
        }
        
        if (this.renderQueue.tooltip) {
            this.component.setTooltipContent(this.tooltip);
            this.renderQueue.tooltip = false;
        }
    }

    postDataRegistration() {
        // Process tier data
        for (const tierData of this._tiers) {
            const tier = tierData.tier;
            
            // Convert effects to standardized format (all are passive)
            const effects = (tierData.effects || []).map(effectData => {
                return createEffect({ 
                    ...effectData, 
                    trigger: 'passive'
                }, this, this.getTierName(tier));
            });

            // Resolve material references
            const materials = new Map();
            
            // Add currency cost based on tier (50/100/200/400 coins)
            const currency = this.manager.materials.getObjectByID('adventuring:currency');
            if (currency) {
                const tierCosts = [50, 100, 200, 400];
                materials.set(currency, tierCosts[tier - 1] || 50);
            }
            
            if (tierData.materials) {
                for (const { id, count } of tierData.materials) {
                    const material = this.manager.materials.getObjectByID(id);
                    if (material) {
                        materials.set(material, count);
                    } else {
                        console.warn(`TavernDrink ${this.id}: Material not found: ${id}`);
                    }
                }
            }

            this.tiers.set(tier, {
                tier,
                nameSuffix: tierData.nameSuffix || '',
                media: tierData.media,
                flavorText: tierData.flavorText || '',
                effects,
                materials
            });
        }

        delete this._tiers;
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
