const { loadModule } = mod.getContext(import.meta);

const { AdventuringConsumableElement } = await loadModule('src/items/components/adventuring-consumable.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { createEffect, describeEffectsInline, buildDescription } = await loadModule('src/core/utils/adventuring-utils.mjs');

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

export class AdventuringConsumable extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._media = data.media;
        this._sourceJobId = data.sourceJob; // Resolved in postDataRegistration
        this.sourceJob = null;

        // Order position for sorting (processed by manager._buildAllSortOrders)
        this.orderPosition = data.orderPosition || null;
        this.sortOrder = 9999;

        this.category = null;

        this.customDescription = data.customDescription;

        this.target = data.target || 'self';

        this._tiers = data.tiers || [];
        this.tiers = new Map(); // Map<tierNumber, tierData>

        this.component = createElement('adventuring-consumable');
        this.renderQueue = new AdventuringConsumableRenderQueue();

        this.component.clickable.onclick = () => this.onClick();
    }

    get name() {
        return this._name;
    }

    getTierName(tier) {
        const tierData = this.tiers.get(tier);
        if (!tierData) return this._name;
        return tierData.nameSuffix ? `${this._name} ${tierData.nameSuffix}` : this._name;
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    getTierMedia(tier) {
        const tierData = this.tiers.get(tier);
        if (tierData && tierData.media) {
            return this.getMediaURL(tierData.media);
        }
        return this.media;
    }

    getTierEffects(tier) {
        const tierData = this.tiers.get(tier);
        return tierData ? tierData.effects : [];
    }

    getTierMaterials(tier) {
        const tierData = this.tiers.get(tier);
        return tierData ? tierData.materials : new Map();
    }

    getTierFlavorText(tier) {
        const tierData = this.tiers.get(tier);
        return tierData ? tierData.flavorText : '';
    }

    getCharges(tier) {
        return this.manager.consumables.getCharges(this, tier);
    }

    get totalCharges() {
        let total = 0;
        for (let t = 1; t <= 4; t++) {
            total += this.getCharges(t);
        }
        return total;
    }

    get equippedTier() {
        return this.manager.consumables.getEquippedTier(this);
    }

    get isEquipped() {
        return this.equippedTier > 0;
    }

    get isActive() {
        const tier = this.equippedTier;
        return tier > 0 && this.getCharges(tier) > 0;
    }

    getTierEffectText(tier) {
        const effects = this.getTierEffects(tier);
        return describeEffectsInline(effects, this.manager);
    }

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

    canAffordTier(tier) {
        const materials = this.getTierMaterials(tier);
        if (!materials || materials.size === 0) return false;

        for (const [mat, qty] of materials) {
            if (this.manager.stash.getCount(mat) < qty) return false;
        }
        return true;
    }

    craftTier(tier) {
        const materials = this.getTierMaterials(tier);
        if (!materials || materials.size === 0) return false;

        for (const [mat, qty] of materials) {
            if (this.manager.stash.getCount(mat) < qty) return false;
        }

        for (const [mat, qty] of materials) {
            this.manager.stash.remove(mat, qty);
        }

        this.manager.consumables.addCharges(this, tier, 1);
        this.renderQueue.updateAll();
        return true;
    }

    useCharge() {
        const tier = this.equippedTier;
        if (tier <= 0) return false;
        if (this.getCharges(tier) <= 0) return false;

        this.manager.consumables.removeCharges(this, tier, 1);
        this.renderQueue.updateAll();
        return true;
    }

    getTierTooltip(tier) {
        return TooltipBuilder.forConsumableTier(this, tier).build();
    }

    get tooltip() {
        return TooltipBuilder.forConsumable(this).build();
    }

    postDataRegistration() {

        if (this._sourceJobId) {
            this.sourceJob = this.manager.jobs.getObjectByID(this._sourceJobId);
        }

        if (!this.category && this.type) {
            this.category = this.manager.consumableCategories.getObjectByID(`adventuring:${this.type}`);
        }

        for (const tierData of this._tiers) {
            const tier = tierData.tier;

            const materials = new Map();
            if (tierData.materials) {
                for (const { id, count } of tierData.materials) {
                    const material = this.manager.materials.getObjectByID(id);
                    if (material) {
                        materials.set(material, count);
                    }
                }
            }

            const effects = (tierData.effects || []).map(effectData => {
                return createEffect(effectData, [{ type: 'consumable', name: this.getTierName(tier), ref: this }]);
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
