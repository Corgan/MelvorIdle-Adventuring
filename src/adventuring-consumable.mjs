const { loadModule } = mod.getContext(import.meta);

const { AdventuringConsumableElement } = await loadModule('src/components/adventuring-consumable.mjs');
const { TooltipBuilder } = await loadModule('src/adventuring-tooltip.mjs');
const { createEffect, describeEffect, describeEffectFull } = await loadModule('src/adventuring-utils.mjs');

class AdventuringConsumableRenderQueue {
    constructor() {
        this.icon = false;
        this.charges = false;
        this.tooltip = false;
        this.equipped = false;
    }
    updateAll() {
        this.icon = true;
        this.charges = true;
        this.tooltip = true;
        this.equipped = true;
    }
}

export class AdventuringConsumable extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._media = data.media;
        this._categoryId = data.category; // Reference resolved in postDataRegistration
        this.category = null;
        this.type = data.type; // Legacy - use category instead
        this.flavorText = data.flavorText; // Optional flavor text for tooltip
        this.customDescription = data.customDescription; // Optional override for auto-generated description
        this.effects = data.effects || [];
        
        // Source: "tavern" (purchased at tavern) or "craft" (crafted from materials)
        this.source = data.source || 'craft';
        
        // Duration for tavern drinks (becomes initial charges when purchased)
        this.duration = data.duration || 0;
        this.tier = data.tier || 1;
        
        // Max charges for craftable consumables
        this.maxCharges = data.maxCharges || data.charges || 1;
        this.triggerType = data.triggerType;
        
        // Duration mode: "charges" (consumed per use) or "runs" (consumed per dungeon run)
        this.durationMode = data.durationMode || 'charges';
        
        // Target: "self" (single hero) or "party" (all heroes)
        this.target = data.target || 'self';

        // Materials for crafting/purchasing
        if(data.materials !== undefined) {
            this._materials = data.materials;
            this.materials = new Map();
        }

        this.component = createElement('adventuring-consumable');
        this.renderQueue = new AdventuringConsumableRenderQueue();

        this.component.clickable.onclick = () => this.onClick();
    }
    
    get isTavernDrink() {
        return this.source === 'tavern';
    }

    get name() {
        return this._name;
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    get charges() {
        return this.manager.consumables.getCharges(this);
    }

    get isEquipped() {
        return this.manager.consumables.isEquipped(this);
    }
    
    get isActive() {
        if(this.isTavernDrink) {
            return this.charges > 0;
        }
        return this.isEquipped && this.charges > 0;
    }
    
    get costText() {
        if(!this.materials || this.materials.size === 0) return '';
        const parts = [];
        this.materials.forEach((qty, mat) => {
            if(mat.isCurrency) {
                // For currencies, use a short name
                if(mat.id === 'adventuring:currency') {
                    parts.push(`${qty} coins`);
                } else if(mat.id === 'adventuring:slayer_coins') {
                    parts.push(`${qty} slayer coins`);
                } else {
                    parts.push(`${qty} ${mat.name}`);
                }
            } else {
                parts.push(`${qty} ${mat.name}`);
            }
        });
        return parts.join(', ');
    }
    
    get effectText() {
        return this.effects.map(e => describeEffect(e, this.manager)).join(', ');
    }
    
    /**
     * Get the description for this consumable.
     * Priority: customDescription > auto-generated from effects
     * FlavorText is appended after the description.
     */
    get description() {
        // Custom description takes priority
        if(this.customDescription) {
            return this.flavorText 
                ? `${this.customDescription}\n\n${this.flavorText}`
                : this.customDescription;
        }
        
        // Generate from effects
        const effectDescs = this.effects.map(e => describeEffectFull(e, this.manager));
        const generated = effectDescs.join('. ');
        
        // Append flavor text if present
        if(this.flavorText) {
            return generated ? `${generated}.\n\n${this.flavorText}` : this.flavorText;
        }
        
        return generated || 'No effect.';
    }
    
    canAfford() {
        if(!this.materials || this.materials.size === 0) return false;
        let canAfford = true;
        this.materials.forEach((qty, mat) => {
            if(this.manager.stash.getCount(mat) < qty) canAfford = false;
        });
        return canAfford;
    }
    
    purchase() {
        if(!this.canAfford()) return false;

        // Deduct materials
        this.materials.forEach((qty, mat) => {
            this.manager.stash.remove(mat, qty);
        });

        // Add charges (duration = number of runs = number of charges)
        this.manager.consumables.addTavernDrinkCharges(this, this.duration);
        this.manager.log.add(`Bought ${this.name} - ${this.effectText} for ${this.duration} runs`);
        return true;
    }

    get tooltip() {
        const typeLabel = this.type ? (this.type.charAt(0).toUpperCase() + this.type.slice(1)) : 'Consumable';
        const tooltip = TooltipBuilder.create()
            .header(this.name, this.media)
            .subheader(typeLabel)
            .hint(this.description)
            .separator();
        
        if(this.isTavernDrink) {
            // Show runs remaining for tavern drinks (charges = runs)
            if(this.charges > 0) {
                tooltip.bonus(`Active: ${this.charges} runs remaining`);
            }
        } else {
            // Show charges for charge-based consumables
            tooltip.warning(`Charges: ${this.charges}/${this.maxCharges}`);
        }
        
        if(this.materials !== undefined && this.materials.size > 0 && this.charges < this.maxCharges) {
            tooltip.separator().hint('Craft Cost:');
            const costItems = [];
            this.materials.forEach((qty, material) => {
                const owned = material.count;
                const color = owned >= qty ? 'text-success' : 'text-danger';
                costItems.push(tooltip.iconValue(material.media, `<span class="${color}">${qty}</span> <small class="text-muted">(${owned})</small>`));
            });
            tooltip.statRow(...costItems);
        }
        
        return tooltip.build();
    }

    postDataRegistration() {
        // Resolve category reference
        if(this._categoryId) {
            this.category = this.manager.consumableCategories.getObjectByID(this._categoryId);
        }
        // Fallback: try to resolve from legacy 'type' field
        if(!this.category && this.type) {
            this.category = this.manager.consumableCategories.getObjectByID(`adventuring:${this.type}`);
        }
        
        // Resolve material references
        if(this._materials !== undefined) {
            this._materials.forEach(({ id, qty }) => {
                const material = this.manager.materials.getObjectByID(id);
                if(material !== undefined)
                    this.materials.set(material, qty);
            });
            delete this._materials;
        }
        
        // Convert effects to standardized format with source info
        this.effects = this.effects.map(effectData => {
            return createEffect(
                {
                    trigger: effectData.trigger || 'passive',
                    type: effectData.type,
                    stat: effectData.stat,
                    value: effectData.value
                },
                this,
                this.name
            );
        });
    }

    onLoad() {
        this.renderQueue.updateAll();
    }

    onClick() {
        if(this.manager.consumables.active) {
            // Toggle equip/unequip
            if(this.isEquipped) {
                this.manager.consumables.unequip(this);
            } else {
                this.manager.consumables.equip(this);
            }
        }
    }

    /**
     * Craft additional charges
     */
    craft() {
        if(this.charges >= this.maxCharges) return false;
        
        // Check materials
        for(const [material, qty] of this.materials) {
            if(this.manager.stash.materialCounts.get(material) < qty) {
                return false;
            }
        }

        // Deduct materials
        for(const [material, qty] of this.materials) {
            this.manager.stash.remove(material, qty);
        }

        // Add charge
        this.manager.consumables.addCharges(this, 1);
        this.renderQueue.updateAll();
        return true;
    }

    /**
     * Use one charge
     */
    useCharge() {
        if(this.charges <= 0) return false;
        this.manager.consumables.removeCharges(this, 1);
        this.renderQueue.updateAll();
        return true;
    }

    render() {
        this.renderIcon();
        this.renderCharges();
        this.renderTooltip();
        this.renderEquipped();
    }

    renderIcon() {
        if(!this.renderQueue.icon) return;
        this.component.icon.src = this.media;
        this.renderQueue.icon = false;
    }

    renderCharges() {
        if(!this.renderQueue.charges) return;
        this.component.charges.textContent = this.charges;
        this.component.charges.classList.toggle('d-none', this.charges <= 0);
        this.component.border.classList.toggle('opacity-40', this.charges <= 0);
        this.renderQueue.charges = false;
    }

    renderTooltip() {
        if(!this.renderQueue.tooltip) return;
        if(this.component.tooltip === undefined) return;
        this.component.tooltip.setContent(this.tooltip);
        this.renderQueue.tooltip = false;
    }

    renderEquipped() {
        if(!this.renderQueue.equipped) return;
        this.component.border.classList.toggle('border-success', this.isEquipped);
        this.renderQueue.equipped = false;
    }
}
