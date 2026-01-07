const { loadModule } = mod.getContext(import.meta);

const { AdventuringMasteryAction } = await loadModule('src/core/adventuring-mastery-action.mjs');
const { AdventuringItemBaseElement } = await loadModule('src/items/components/adventuring-item-base.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { RequirementsChecker, formatRequirements, getEffectDescriptionsList, AdventuringEquipmentRenderQueue, buildDescription, getLockedMedia, StatCalculator } = await loadModule('src/core/adventuring-utils.mjs');

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
        
        // Tiered upgrade materials (higher upgrade levels require later-game materials)
        if(data.upgradeMaterials !== undefined) {
            this._upgradeMaterials = data.upgradeMaterials;
        }
        this.upgradeMaterials = new Map(); // Map<threshold, Material[]>

        this._type = data.type;
        this.maxUpgrades = 10;
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
            this._base.forEach(({ id, amount }) => {
                this.base.set(id, amount);
            });
            delete this._base;
        }

        if(this._scaling !== undefined) {
            this._scaling.forEach(({ id, amount }) => {
                this.scaling.set(id, amount);
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
        
        // Parse tiered upgrade materials
        if(this._upgradeMaterials !== undefined) {
            for (const [threshold, matIds] of Object.entries(this._upgradeMaterials)) {
                const materials = [];
                for (const matId of matIds) {
                    const material = this.manager.materials.getObjectByID(matId);
                    if (material !== undefined) {
                        materials.push(material);
                    }
                }
                if (materials.length > 0) {
                    this.upgradeMaterials.set(parseInt(threshold), materials);
                }
            }
            delete this._upgradeMaterials;
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
        // Calculate base stats with level scaling and mastery bonus
        const statBonus = this.getMasteryEffectValue('equipment_stats_percent');
        StatCalculator.calculateWithScaling(this.stats, this.base, this.scaling, this.level, statBonus);
        
        // Masterful rank: Apply normalization to bring all items to same power level
        if (this.isMasterful) {
            this.applyMasterfulScaling();
        }
    }
    
    /**
     * Apply Masterful rank scaling - normalizes all Masterful items to same power level
     * This brings lower-tier items up to high-tier power when both are Masterful
     */
    applyMasterfulScaling() {
        const multiplier = this.getMasterfulMultiplier();
        if (multiplier > 1) {
            StatCalculator.applyMultiplier(this.stats, multiplier);
        }
    }
    
    /**
     * Get the multiplier needed to bring this item to Masterful power level
     * Higher tier items get lower multipliers, lower tier items get higher multipliers
     */
    getMasterfulMultiplier() {
        const tier = this.tier || 1;
        const maxTier = 10; // Assumed max tier
        
        // Inverse relationship: lower tier gets bigger boost
        // Tier 10 items get 1.0x, tier 1 items get 1.9x
        const multiplier = 1 + (maxTier - tier) * 0.1;
        
        return multiplier;
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
                
                // Add tiered upgrade materials (if any apply to next upgrade level)
                const tieredMats = this.getUpgradeTierMaterials();
                for (const material of tieredMats) {
                    const cost = this.getUpgradeTierCost(material);
                    const owned = this.manager.stash.materialCounts.get(material) || 0;
                    const color = owned >= cost ? 'text-success' : 'text-danger';
                    costItems.push(tooltip.iconValue(material.media, `<span class="${color}">${cost}</span> <small class="text-muted">(${owned})</small>`));
                }
                
                tooltip.hint(`${upgradeOrUnlock} Cost:`);
                tooltip.statRow(...costItems);
            }
        } else {
            // Item is locked - show unlock requirements
            tooltip.unlockRequirements(this.requirements, this.manager);
        }
        
        return tooltip.build();
    }

    get name() {
        const baseName = this._name;
        // Add "Mastered" prefix at level 99 equipment mastery
        if (this.unlocked && this.hasUnlock('mastered_variant')) {
            return `Mastered ${baseName}`;
        }
        return baseName;
    }

    get media() {
        return getLockedMedia(this);
    }

    get level() {
        return this.manager.getMasteryLevel(this);
    }

    get levelCap() {
        // 10 upgrade levels: 1→10, 2→20, ..., 9→90, 10→99
        if (this.upgradeLevel >= this.maxUpgrades) {
            return 99;
        }
        return this.upgradeLevel * 10;
    }
    
    /**
     * Check if this item has been upgraded to Masterful rank
     */
    get isMasterful() {
        return this.manager.armory.masterfulItems?.has(this) || false;
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
        
        // Must reach current level cap before upgrading
        // This ensures players USE equipment to level it before upgrading
        if(this.level < this.levelCap)
            return false;
        
        // Check base materials
        for(let material of this.materials.keys()) {
            if(this.getCost(material) > this.manager.stash.materialCounts.get(material))
                return false;
        }
        
        // Check tiered upgrade materials (higher upgrade levels need later-game materials)
        const tieredMats = this.getUpgradeTierMaterials();
        for (const material of tieredMats) {
            const cost = this.getUpgradeTierCost(material);
            if (cost > (this.manager.stash.materialCounts.get(material) || 0))
                return false;
        }
        
        return true;
    }
    
    /**
     * Get materials required for the current upgrade tier
     * Materials are REPLACED at each tier (not cumulative)
     * +1 to +3: uses threshold 1 materials
     * +4 to +6: uses threshold 4 materials
     * +7 to +10: uses threshold 7 materials
     */
    getUpgradeTierMaterials() {
        const nextLevel = this.upgradeLevel + 1;
        
        // Find the highest threshold that applies to our next upgrade level
        let activeThreshold = 1;
        for (const threshold of this.upgradeMaterials.keys()) {
            if (nextLevel >= threshold && threshold > activeThreshold) {
                activeThreshold = threshold;
            }
        }
        
        // Return only the materials for that threshold
        return this.upgradeMaterials.get(activeThreshold) || [];
    }
    
    /**
     * Get cost for a tiered upgrade material (flat cost, doesn't scale with level)
     */
    getUpgradeTierCost(material) {
        // Tiered materials have a flat cost of 1-3 based on tier
        return Math.ceil((this.upgradeLevel + 1) / 3);
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
        return getEffectDescriptionsList(this.effects, this.manager);
    }

    getCost(material) {
        let amount = this.materials.get(material);
        if(amount === undefined) return 0;
        
        // Apply upgrade cost modifier from mastery
        const costReduction = this.manager.modifiers.getUpgradeCostReduction(this);
        
        // Linear scaling: (upgradeLevel + 1) * amount
        // Level 0→1: 1x, 1→2: 2x, 2→3: 3x, 3→4: 4x, ..., 9→10: 10x
        const baseCost = (this.upgradeLevel + 1) * amount;
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

        // Just select/deselect items - no equipping from armory
        if(this.manager.armory.selectedItem === this) {
            this.manager.armory.clearSelected();
        } else {
            this.manager.armory.selectItem(this);
        }
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