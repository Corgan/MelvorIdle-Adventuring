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
        if(data.upgradeMaterials !== undefined) {
            this._upgradeMaterials = data.upgradeMaterials;
        }
        this.upgradeMaterials = new Map(); // Map<threshold, Material[]>

        this._type = data.type;
        this.maxUpgrades = 10;
        this.selected = false;
        this.highlight = false;
        this.effects = data.effects || [];
        this.requirements = data.requirements || [];
        this._reqChecker = null; // Created in postDataRegistration
        this.set = null;
        this.tier = (data.tier !== undefined) ? data.tier : 1;
        this.flavorText = data.flavorText;
        this.customDescription = data.customDescription;
        this.isArtifact = data.isArtifact === true;
        if(data.tiers !== undefined) {
            this._tiers = data.tiers; // Raw tier data, parsed in postDataRegistration
        }
        this.tiers = []; // Parsed tier data: [{name, base, scaling, effects, materials}]

        this.component.clickable.onclick = () => {
            this.slotClicked();
        }
    }

    get masteryCategoryId() {
        return 'adventuring:equipment';
    }

    get description() {
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
        if(this.requirements.length > 0) {
            this._reqChecker = new RequirementsChecker(this.manager, this.requirements);
        }
        if(this._tiers !== undefined && this._tiers.length > 0) {
            this.tiers = this._tiers.map((tierData, tierIndex) => {
                const tier = {
                    name: tierData.name || this._name,
                    base: new AdventuringStats(this.manager, this.game),
                    scaling: new AdventuringStats(this.manager, this.game),
                    effects: tierData.effects || [],
                    materials: new Map()
                };
                if(tierData.base) {
                    tierData.base.forEach(({ id, amount }) => {
                        tier.base.set(id, amount);
                    });
                }
                if(tierData.scaling) {
                    tierData.scaling.forEach(({ id, amount }) => {
                        tier.scaling.set(id, amount);
                    });
                }
                if(tierData.materials) {
                    tierData.materials.forEach(({ id, qty }) => {
                        const material = this.manager.materials.getObjectByID(id);
                        if(material !== undefined) {
                            tier.materials.set(material, qty);
                        }
                    });
                }

                return tier;
            });
            delete this._tiers;
            this.applyArtifactTier(this.artifactTier);
        }
        this._computeCachedProperties();
    }

    _computeCachedProperties() {
        this._cachedJobs = this.manager.jobs.allObjects.filter(
            job => job.allowedItems !== undefined && job.allowedItems.includes(this.type)
        );
        if(this.type !== undefined && this.type.slots !== undefined) {
            this._cachedSlots = this.type.slots.map(
                slotType => this.manager.itemSlots.getObjectByID(slotType)
            );
        } else {
            this._cachedSlots = [];
        }
        if(this.type !== undefined && this.type.occupies !== undefined) {
            this._cachedOccupies = this.type.occupies.map(
                slotType => this.manager.itemSlots.getObjectByID(slotType)
            );
        } else {
            this._cachedOccupies = [];
        }
        if(this.type !== undefined && this.type.pairs !== undefined) {
            this._cachedPairs = this.type.pairs.map(
                pair => this.manager.itemTypes.getObjectByID(pair)
            );
        } else {
            this._cachedPairs = [];
        }
    }

    getEffectiveLevel(character) {
        const itemLevel = this.level;
        if (!character || !character.combatJob) return itemLevel;

        const jobLevel = this.manager.getMasteryLevel(character.combatJob);
        return Math.min(itemLevel, jobLevel);
    }

    isLevelCapped(character) {
        if (!character || !character.combatJob) return false;
        const jobLevel = this.manager.getMasteryLevel(character.combatJob);
        return this.level > jobLevel;
    }

    calculateStats(character = null) {
        const effectiveLevel = character ? this.getEffectiveLevel(character) : this.level;
        const statBonus = this.getMasteryEffectValue('equipment_stats_percent');
        StatCalculator.calculateWithScaling(this.stats, this.base, this.scaling, effectiveLevel, statBonus);
        if (this.isMasterful) {
            this.applyMasterfulScaling();
        }
    }

    applyMasterfulScaling() {
        const multiplier = this.getMasterfulMultiplier();
        if (multiplier > 1) {
            StatCalculator.applyMultiplier(this.stats, multiplier);
        }
    }

    getMasterfulMultiplier() {
        const tier = this.tier || 1;
        const maxTier = 10; // Assumed max tier
        const multiplier = 1 + (maxTier - tier) * 0.1;

        return multiplier;
    }

    get tooltip() {
        const character = this.currentSlot?.equipment?.character || null;
        const tooltip = TooltipBuilder.forEquipment(this, this.manager, character);

        if(this.unlocked) {
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
            tooltip.unlockRequirements(this.requirements, this.manager, { item: this });
        }

        return tooltip.build();
    }

    get name() {
        if(this.isArtifact && this.tiers.length > 0) {
            const tier = this.tiers[this.artifactTier];
            if(tier) return tier.name;
        }

        const baseName = this._name;
        if (this.unlocked && this.hasUnlock('mastered_variant')) {
            return `Mastered ${baseName}`;
        }
        return baseName;
    }

    get artifactTier() {
        if(!this.isArtifact) return 0;
        return this.manager.armory.artifactTiers.get(this) || 0;
    }

    get canPrestige() {
        if(!this.isArtifact) return false;
        if(this.artifactTier >= this.tiers.length - 1) return false; // Already max tier
        if(this.level < 99) return false; // Must be level 99
        const nextTier = this.tiers[this.artifactTier + 1];
        if(!nextTier || !nextTier.materials) return false;

        for(const [material, cost] of nextTier.materials) {
            const owned = this.manager.stash.materialCounts.get(material) || 0;
            if(owned < cost) return false;
        }

        return true;
    }

    get prestigeMaterials() {
        if(!this.isArtifact || this.artifactTier >= this.tiers.length - 1) {
            return new Map();
        }
        const nextTier = this.tiers[this.artifactTier + 1];
        return nextTier ? nextTier.materials : new Map();
    }

    applyArtifactTier(tierIndex) {
        if(!this.isArtifact || this.tiers.length === 0) return;

        const tier = this.tiers[tierIndex] || this.tiers[0];
        if(!tier) return;
        this.base.reset();
        tier.base.forEach((value, stat) => {
            this.base.set(stat, value);
        });
        this.scaling.reset();
        tier.scaling.forEach((value, stat) => {
            this.scaling.set(stat, value);
        });
        this.effects = tier.effects || [];
        this.calculateStats();
    }

    get media() {
        return getLockedMedia(this);
    }

    get level() {
        return this.manager.getMasteryLevel(this);
    }

    get levelCap() {
        if (this.upgradeLevel >= this.maxUpgrades) {
            return 99;
        }
        return this.upgradeLevel * 10;
    }

    get isMasterful() {
        if (this.manager.armory.masterfulItems && this.manager.armory.masterfulItems.has(this)) {
            return true;
        }
        return false;
    }

    get dropped() {
        if (this.manager.armory.droppedItems && this.manager.armory.droppedItems.get(this) === true) {
            return true;
        }
        return false;
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
        if(this.level < this.levelCap)
            return false;
        for(let material of this.materials.keys()) {
            if(this.getCost(material) > this.manager.stash.materialCounts.get(material))
                return false;
        }
        const tieredMats = this.getUpgradeTierMaterials();
        for (const material of tieredMats) {
            const cost = this.getUpgradeTierCost(material);
            if (cost > (this.manager.stash.materialCounts.get(material) || 0))
                return false;
        }

        return true;
    }

    getUpgradeTierMaterials() {
        const nextLevel = this.upgradeLevel + 1;
        let activeThreshold = 1;
        for (const threshold of this.upgradeMaterials.keys()) {
            if (nextLevel >= threshold && threshold > activeThreshold) {
                activeThreshold = threshold;
            }
        }
        return this.upgradeMaterials.get(activeThreshold) || [];
    }

    getUpgradeTierCost(material) {
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
        return this._cachedJobs || [];
    }

    get slots() {
        return this._cachedSlots || [];
    }

    get occupies() {
        return this._cachedOccupies || [];
    }

    get pairs() {
        return this._cachedPairs || [];
    }

    get requirementsMet() {
        if(!this._reqChecker) return true;
        return this._reqChecker.check({ item: this });
    }

    getEffectDescriptions() {
        return getEffectDescriptionsList(this.effects, this.manager);
    }

    getCost(material) {
        let amount = this.materials.get(material);
        if(amount === undefined) return 0;
        const costReduction = this.manager.modifiers.getUpgradeCostReduction(this);
        const baseCost = (this.upgradeLevel + 1) * amount;
        return Math.max(1, Math.floor(baseCost * (1 + costReduction)));
    }

    addXP(xp) {
        let { currentXP, level, percent, nextLevelXP } = this.manager.getMasteryProgress(this);
        if(level < this.levelCap) {
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