const { loadModule } = mod.getContext(import.meta);

const { AdventuringMasteryAction } = await loadModule('src/core/adventuring-mastery-action.mjs');
const { AdventuringItemBaseElement } = await loadModule('src/items/components/adventuring-item-base.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { RequirementsChecker, formatRequirements, describeEffect, describeEffectFull, formatTrigger, AdventuringEquipmentRenderQueue, buildDescription } = await loadModule('src/core/adventuring-utils.mjs');

const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');

export class AdventuringItemBase extends AdventuringMasteryAction {
    constructor(namespace, data, manager, game) {
        super(namespace, data, manager, game);

        this._name = data.name;
        this._media = data.media;

        if(data.scaling !== undefined)
            this._scaling = data.scaling;
        if(data.base !== undefined)
            this._base = data.base;

        this.scaling = new AdventuringStats(this.manager, this.game);
        this.base = new AdventuringStats(this.manager, this.game);
        this.stats = new AdventuringStats(this.manager, this.game);

        this.component = createElement('adventuring-item-base');
        this.renderQueue = new AdventuringEquipmentRenderQueue();

        if(data.materials !== undefined) {
            this._materials = data.materials;
            this.materials = new Map();
        }

        this._type = data.type;
        this.maxUpgrades = 12;
        this.selected = false;
        this.highlight = false;
        
        // Special effects for unique items (trigger-based)
        this.effects = data.effects || [];
        
        // Unlock requirements (skill_level, job_level, etc.)
        this.requirements = data.requirements || [];
        this._reqChecker = null; // Created in postDataRegistration
        
        // Equipment set membership (set by AdventuringEquipmentSet.postDataRegistration)
        this.set = null;
        
        // Item tier (for sorting/filtering)
        this.tier = data.tier ?? 1;
        
        // Optional flavor text and custom description override
        this.flavorText = data.flavorText;
        this.customDescription = data.customDescription;

        this.component.clickable.onclick = () => {
            this.slotClicked();
        }
    }

    get masteryCategoryId() {
        return 'adventuring:equipment';
    }
    
    /**
     * Get the description for this item.
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
        
        return buildDescription({
            effects: this.effects,
            manager: this.manager,
            flavorText: this.flavorText,
            includeTrigger: true
        });
    }

    onLoad() {
        this.calculateStats();
        this.renderQueue.tooltip = true;
        this.renderQueue.icon = true;
        this.renderQueue.upgrade = true;
        this.renderQueue.selected = true;
        this.renderQueue.highlight = true;
        this.renderQueue.equipped = true;
        this.renderQueue.newBadge = true;
    }

    postDataRegistration() {
        if(this._base !== undefined) {
            this._base.forEach(({ id, value }) => {
                this.base.set(id, value);
            });
            delete this._base;
        }

        if(this._scaling !== undefined) {
            this._scaling.forEach(({ id, value }) => {
                this.scaling.set(id, value);
            });
            delete this._scaling;
        }

        if(this._materials !== undefined) {
            this._materials.forEach(({ id, qty }) => {
                let material = this.manager.materials.getObjectByID(id);
                if(material !== undefined)
                    this.materials.set(material, qty);
            });
            delete this._materials;
        }

        if(this._type !== undefined) {
            this.type = this.manager.itemTypes.getObjectByID(this._type);
            delete this._type;
        }
        
        // Create requirements checker
        if(this.requirements.length > 0) {
            this._reqChecker = new RequirementsChecker(this.manager, this.requirements);
        }
    }

    calculateStats() {
        this.stats.reset();

        this.base.forEach((value, stat) => this.stats.set(stat, value));
        this.scaling.forEach((value, stat) => this.stats.set(stat, this.stats.get(stat) + Math.floor(this.level * value)));

        // Apply equipment_stats_percent mastery bonus (level 99)
        const statBonus = this.getMasteryEffectValue('equipment_stats_percent');
        if (statBonus > 0) {
            this.stats.forEach((value, stat) => {
                const bonus = Math.floor(value * statBonus / 100);
                this.stats.set(stat, value + bonus);
            });
        }
    }

    get tooltip() {
        const tooltip = TooltipBuilder.forEquipment(this, this.manager);

        if(this.unlocked) {
            // Requirements (for items that have unlock requirements)
            if(this.requirements.length > 0) {
                tooltip.separator();
                tooltip.hint('Requirements:');
                formatRequirements(this.requirements, this.manager).forEach(({ text, met }) => {
                    if(met) {
                        tooltip.text(`<i class="fa fa-check text-success mr-1"></i>${text}`, 'text-success');
                    } else {
                        tooltip.text(`<i class="fa fa-times text-danger mr-1"></i>${text}`, 'text-danger');
                    }
                });
            }

            // Upgrade cost
            if(this.materials !== undefined) {
                let upgradeOrUnlock = (this.upgradeLevel === 0 ? 'Unlock': 'Upgrade');
                tooltip.separator();
                const costItems = [];
                this.materials.forEach((amount, material) => {
                    const cost = this.getCost(material);
                    const owned = material.count;
                    const color = owned >= cost ? 'text-success' : 'text-danger';
                    costItems.push(tooltip.iconValue(material.media, `<span class="${color}">${cost}</span> <small class="text-muted">(${owned})</small>`));
                });
                tooltip.hint(`${upgradeOrUnlock} Cost:`);
                tooltip.statRow(...costItems);
            }
        }
        
        return tooltip.build();
    }

    get name() {
        const baseName = this._name;
        // Add "Mastered" prefix at level 99 equipment mastery
        if (this.unlocked && this.hasMasteryEffect('unlock_mastered_variant')) {
            return `Mastered ${baseName}`;
        }
        return baseName;
    }

    get media() {
        return this.unlocked ? this.getMediaURL(this._media) : this.getMediaURL('melvor:assets/media/main/question.png');
    }

    get level() {
        return this.manager.getMasteryLevel(this);
    }

    get levelCap() {
        return this.upgradeLevel * 10;
    }

    get upgradeLevel() {
        return this.manager.armory.upgradeLevels.get(this);
    }

    get unlocked() {
        return this.manager.armory.unlocked.get(this) === true;
    }

    get category() {
        return this.manager.categories.getObjectByID('adventuring:Equipment');
    }

    get upgradeable() {
        if(this.upgradeLevel >= this.maxUpgrades)
            return false;
        if(this.materials === undefined)
            return false;
        for(let material of this.materials.keys()) {
            if(this.getCost(material) > this.manager.stash.materialCounts.get(material))
                return false;
        }
        return true;
    }

    get equipped() {
        for(let member of this.manager.party.all) {
            for(let slot of this.slots) {
                let equipmentSlot = member.equipment.slots.get(slot);
                if(equipmentSlot.item === this)
                    return true;
            }
        }
        return false;
    }

    get currentSlot() {
        for(let member of this.manager.party.all) {
            for(let slot of this.slots) {
                let equipmentSlot = member.equipment.slots.get(slot);
                if(equipmentSlot.item === this)
                    return equipmentSlot;
            }
        }
    }

    get jobs() {
        let jobs = this.manager.jobs.allObjects.filter(job => job.allowedItems !== undefined && job.allowedItems.includes(this.type));
        return jobs;
    }

    get slots() {
        let slots = [];
        if(this.type !== undefined && this.type.slots !== undefined)
            slots = this.type.slots.map(slotType => this.manager.itemSlots.getObjectByID(slotType));
        return slots;
    }

    get occupies() {
        let occupies = [];
        if(this.type.occupies !== undefined)
            occupies = this.type.occupies.map(slotType => this.manager.itemSlots.getObjectByID(slotType));
        return occupies;
    }

    get pairs() {
        let pairs = [];
        if(this.type.pairs !== undefined)
            pairs = this.type.pairs.map(pair => this.manager.itemTypes.getObjectByID(pair))
        return pairs;
    }

    /**
     * Check if all requirements are met to unlock/craft this item
     * @returns {boolean} True if requirements are met (or no requirements exist)
     */
    get requirementsMet() {
        if(!this._reqChecker) return true;
        return this._reqChecker.check();
    }
    
    /**
     * Get formatted effect descriptions for tooltip display
     * @returns {Array<string>} Array of effect description strings
     */
    getEffectDescriptions() {
        if(!this.effects || this.effects.length === 0) return [];
        
        return this.effects.map(effect => {
            // Use description if explicitly provided
            if(effect.description) return effect.description;
            
            // Build description from effect data
            let trigger = formatTrigger(effect.trigger);
            let desc = describeEffect(effect, this.manager);
            
            // Add chance if applicable (chance is whole percent, 100 = always)
            if(effect.chance !== undefined && effect.chance < 100) {
                desc = `${effect.chance}% chance: ${desc}`;
            }
            
            // Combine trigger and description for non-passive effects
            if(trigger && effect.trigger !== 'passive') {
                return `${trigger}: ${desc}`;
            }
            
            return desc;
        });
    }

    getCost(material) {
        let amount = this.materials.get(material);
        if(amount === undefined) return 0;
        
        // Apply upgrade cost modifier from mastery
        const costReduction = this.manager.modifiers.getUpgradeCostReduction(this);
        const baseCost = Math.pow(5, this.upgradeLevel) * amount;
        return Math.max(1, Math.floor(baseCost * (1 + costReduction)));
    }

    addXP(xp) {
        let { currentXP, level, percent, nextLevelXP } = this.manager.getMasteryProgress(this);
        if(level < this.levelCap) {
            // Apply equipment mastery XP bonus from modifier system
            const xpBonus = this.manager.modifiers.getMasteryXPBonus(this);
            const modifiedXP = Math.floor(xp * (1 + xpBonus));
            
            this.manager.addMasteryXP(this, modifiedXP);
            this.manager.addMasteryPoolXP(modifiedXP);
        }
        this.renderQueue.tooltip = true;
        this.manager.party.all.forEach(member => member.equipment.slots.forEach(equipmentSlot => {
            equipmentSlot.renderQueue.icon = true;
            equipmentSlot.renderQueue.upgrade = true;
        }));
    }

    slotClicked() {
        if(!this.manager.armory.active)
            return;

        if(!this.unlocked)
            return;

        if(this.manager.armory.selectedItem !== undefined) {
            if(this.manager.armory.selectedItem === this) {
                if(this.manager.armory.selectedItem.currentSlot !== undefined)
                    this.manager.armory.selectedItem.currentSlot.setEmpty();
                this.manager.armory.clearSelected();
            } else {
                this.manager.armory.selectItem(this);
            }
        } else {
            this.manager.armory.selectItem(this);
        }

        this.manager.party.all.forEach(member => member.calculateStats());
    }

    setSelected(selected) {
        this.selected = selected;
        this.renderQueue.selected = true;
        this.renderQueue.highlight = true;
        this.renderQueue.equipped = true;
    }

    setHighlight(highlight) {
        this.highlight = highlight;
        this.renderQueue.highlight = true;
        this.renderQueue.selected = true;
        this.renderQueue.equipped = true;
    }

    render() {
        this.renderTooltip();
        this.renderIcon();
        this.renderUpgrade();
        this.renderSelected();
        this.renderHighlight();
        this.renderEquipped();
        this.renderNewBadge();
    }

    renderTooltip() {
        if(!this.renderQueue.tooltip)
            return;

        this.component.setTooltipContent(this.tooltip);

        this.renderQueue.tooltip = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        this.component.icon.src = this.media;
        this.component.lock.classList.toggle('invisible', !this.unlocked || this.upgradeLevel > 0);

        this.renderQueue.icon = false;
    }

    renderSelected() {
        if(!this.renderQueue.selected)
            return;

        this.component.border.classList.toggle('border-success', this.selected);

        this.renderQueue.selected = false;
    }

    renderHighlight() {
        if(!this.renderQueue.highlight)
            return;

        this.component.border.classList.toggle('border-warning', this.highlight && !this.selected);

        this.renderQueue.highlight = false;
    }

    renderUpgrade() {
        if(!this.renderQueue.upgrade)
            return;

        this.component.upgrade.classList.toggle('d-none', this.upgradeLevel === 0);
        this.component.upgrade.textContent = this.level;

        this.renderQueue.upgrade = false;
    }

    renderEquipped() {
        if(!this.renderQueue.equipped)
            return;

        this.component.border.classList.toggle('opacity-40', this.equipped && !(this.selected || this.highlight));
        this.component.icon.classList.toggle('opacity-40', this.equipped && (this.selected || this.highlight));

        this.renderQueue.equipped = false;
    }

    renderNewBadge() {
        if(!this.renderQueue.newBadge)
            return;

        const isNew = this.manager.armory.isNew(this);
        this.component.newBadge.classList.toggle('d-none', !isNew);

        this.renderQueue.newBadge = false;
    }
}