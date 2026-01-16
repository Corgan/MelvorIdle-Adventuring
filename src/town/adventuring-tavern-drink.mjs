const { loadModule } = mod.getContext(import.meta);

const { createEffect, describeEffectsInline, buildDescription } = await loadModule('src/core/adventuring-utils.mjs');
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

export class AdventuringTavernDrink extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._media = data.media;

        this._tiers = data.tiers || [];
        this.tiers = new Map(); // Map<tierNumber, tierData>

        this.component = createElement('adventuring-tavern-drink');
        this.renderQueue = new AdventuringTavernDrinkRenderQueue();

        if (typeof this.component.setOnClick === 'function') {
            this.component.setOnClick(() => this.onClick());
        } else if (this.component.clickable) {
            this.component.clickable.onclick = () => this.onClick();
        }
    }

    onClick() {
        this.manager.tavern.selectDrink(this);
        this.manager.tavern.render();
    }

    get name() {
        return this._name;
    }

    get description() {
        return this.getTierFlavorText(1);
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
        return this.manager.tavern.getCharges(this, tier);
    }

    get totalCharges() {
        let total = 0;
        for (let t = 1; t <= 4; t++) {
            total += this.getCharges(t);
        }
        return total;
    }

    get equippedTier() {
        return this.manager.tavern.getEquippedTier(this);
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

        return buildDescription({
            effects,
            manager: this.manager,
            flavorText,
            includeTrigger: true
        }) || 'No effect.';
    }

    getTierCostText(tier) {
        const materials = this.getTierMaterials(tier);
        if (!materials || materials.size === 0) return 'Free';

        const parts = [];
        for (const [mat, qty] of materials) {
            parts.push(`${qty} ${mat.name}`);
        }
        return parts.join(', ');
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

        this.manager.tavern.addCharges(this, tier, 1);
        this.manager.log.add(`Crafted ${this.getTierName(tier)}`, {
            category: 'town'
        });
        this.renderQueue.updateAll();
        return true;
    }

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

        for (const tierData of this._tiers) {
            const tier = tierData.tier;

            const effects = (tierData.effects || []).map(effectData => {
                return createEffect({
                    ...effectData,
                    trigger: 'passive'
                }, this, this.getTierName(tier));
            });

            const materials = new Map();

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

        return writer;
    }

    decode(reader, version) {

        return reader;
    }
}
