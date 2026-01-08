const { loadModule } = mod.getContext(import.meta);

const { AdventuringConsumableElement } = await loadModule('src/items/components/adventuring-consumable.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { createEffect, describeEffectsInline, buildDescription } = await loadModule('src/core/adventuring-utils.mjs');

class AdventuringConsumableRenderQueue {
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
 * Represents a consumable type with 4 tiers.
 * Each tier has its own effects, materials, and flavor text.
 * Charges are tracked per-tier.
 * Only one tier can be equipped at a time.
 * 
 * Data format:
 * {
 *   "id": "arcane_surge",
 *   "name": "Arcane Surge",
 *   "media": "...",
 *   "type": "blessing",
 *   "sourceJob": "adventuring:astrologist",  // Job that crafts this consumable
 *   "maxCharges": 3,
 *   "tiers": [
 *     {
 *       "tier": 1,
 *       "nameSuffix": "I",
 *       "flavorText": "...",
 *       "effects": [...],
 *       "materials": [{ "id": "...", "count": N }]
 *     },
 *     ...
 *   ]
 * }
 */
export class AdventuringConsumable extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._media = data.media;
        this._sourceJobId = data.sourceJob; // Resolved in postDataRegistration
        this.sourceJob = null;
        
        this.category = null;
        
        this.customDescription = data.customDescription;
        
        // Target: "self" (single hero) or "party" (all heroes)
        this.target = data.target || 'self';

        // Tier data - array of tier definitions
        this._tiers = data.tiers || [];
        this.tiers = new Map(); // Map<tierNumber, tierData>

        this.component = createElement('adventuring-consumable');
        this.renderQueue = new AdventuringConsumableRenderQueue();

        this.component.clickable.onclick = () => this.onClick();
    }

    get name() {
        return this._name;
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
     * Get media for a specific tier (may have tier-specific shading)
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
        return this.manager.consumables.getCharges(this, tier);
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
        return this.manager.consumables.getEquippedTier(this);
    }

    /**
     * Check if any tier is equipped
     */
    get isEquipped() {
        return this.equippedTier > 0;
    }

    /**
     * Check if this consumable is active (equipped and has charges)
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
        return describeEffectsInline(effects, this.manager);
    }

    /**
     * Get description for a specific tier
     */
    getTierDescription(tier) {
        const effects = this.getTierEffects(tier);
        const flavorText = this.getTierFlavorText(tier);
        
        if (this.customDescription) {
            return flavorText 
                ? `${this.customDescription}<br><br><em>${flavorText}</em>`
                : this.customDescription;
        }
        
        return buildDescription({
            effects,
            manager: this.manager,
            flavorText,
            includeTrigger: true
        }) || 'No effect.';
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
        this.manager.consumables.addCharges(this, tier, 1);
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
        
        this.manager.consumables.removeCharges(this, tier, 1);
        this.renderQueue.updateAll();
        return true;
    }

    /**
     * Get tooltip for a specific tier
     */
    getTierTooltip(tier) {
        return TooltipBuilder.forConsumableTier(this, tier).build();
    }

    /**
     * Get default tooltip (shows overview of all tiers)
     */
    get tooltip() {
        return TooltipBuilder.forConsumable(this).build();
    }

    postDataRegistration() {
        // Resolve source job reference
        if (this._sourceJobId) {
            this.sourceJob = this.manager.jobs.getObjectByID(this._sourceJobId);
        }
        
        if (!this.category && this.type) {
            this.category = this.manager.consumableCategories.getObjectByID(`adventuring:${this.type}`);
        }
        
        // Process tier data
        for (const tierData of this._tiers) {
            const tier = tierData.tier;
            
            // Resolve materials
            const materials = new Map();
            if (tierData.materials) {
                for (const { id, count } of tierData.materials) {
                    const material = this.manager.materials.getObjectByID(id);
                    if (material) {
                        materials.set(material, count);
                    }
                }
            }
            
            // Convert effects to standardized format
            const effects = (tierData.effects || []).map(effectData => {
                return createEffect(effectData, this, this.getTierName(tier));
            });
            
            this.tiers.set(tier, {
                tier: tier,
                nameSuffix: tierData.nameSuffix || ['I', 'II', 'III', 'IV'][tier - 1],
                media: tierData.media,
                flavorText: tierData.flavorText || '',
                effects: effects,
                materials: materials
            });
        }
        
        delete this._tiers;
        delete this._sourceJobId;
        delete this._categoryId;
    }

    onLoad() {
        this.renderQueue.updateAll();
    }

    onClick() {
        if (this.manager.consumables.active) {
            // Select this consumable to show tier selection
            this.manager.consumables.selectConsumable(this);
        }
    }

    render() {
        this.renderIcon();
        this.renderCharges();
        this.renderTooltip();
        this.renderEquipped();
    }

    renderIcon() {
        if (!this.renderQueue.icon) return;
        this.component.icon.src = this.media;
        this.renderQueue.icon = false;
    }

    renderCharges() {
        if (!this.renderQueue.charges) return;
        // Show total charges across all tiers
        const total = this.totalCharges;
        this.component.charges.textContent = total;
        this.component.charges.classList.toggle('d-none', total <= 0);
        this.component.border.classList.toggle('opacity-40', total <= 0);
        this.renderQueue.charges = false;
    }

    renderTooltip() {
        if (!this.renderQueue.tooltip) return;
        this.component.setTooltipContent(this.tooltip);
        this.renderQueue.tooltip = false;
    }

    renderEquipped() {
        if (!this.renderQueue.equipped) return;
        this.component.border.classList.toggle('border-success', this.isEquipped);
        this.renderQueue.equipped = false;
    }
}
