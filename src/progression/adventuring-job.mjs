const { loadModule } = mod.getContext(import.meta);

const { AdventuringMasteryAction } = await loadModule('src/core/adventuring-mastery-action.mjs');
const { AdventuringStats } = await loadModule('src/core/stats/adventuring-stats.mjs');
const { AdventuringJobElement } = await loadModule('src/progression/components/adventuring-job.mjs');
const { AdventuringJobSummaryElement } = await loadModule('src/progression/components/adventuring-job-summary.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { RequirementsChecker } = await loadModule('src/core/utils/requirements-checker.mjs');
const { addMasteryXPWithBonus, getLockedMedia, UNKNOWN_MEDIA, filterEffects } = await loadModule('src/core/utils/adventuring-utils.mjs');
const { AdventuringMasteryRenderQueue } = await loadModule('src/core/utils/render-queues.mjs');
const { AdventuringScalableEffect } = await loadModule('src/combat/adventuring-scalable-effect.mjs');

export class AdventuringJob extends AdventuringMasteryAction {
    constructor(namespace, data, manager, game) {
        super(namespace, data, manager, game);

        this.component = createElement('adventuring-job');
        this.summary = createElement('adventuring-job-summary');
        this.summary.setJob(this);
        this.renderQueue = new AdventuringMasteryRenderQueue();

        this._name = data.name;

        this._media = data.media;

        this.requirements = data.requirements || [];

        // Order position for sorting (processed by manager._buildAllSortOrders)
        this.orderPosition = data.orderPosition || null;
        this.sortOrder = 9999;

        this._effects = data.effects;

        this.stats = new AdventuringStats(this.manager, this.game);

        this.isPassive = data.isPassive === true;


        let tier = this.isPassive ? 0 : this.detectTierFromRequirements(data.requirements);
        if (data.tier !== undefined) {
            tier = data.tier;
        }
        this.tier = tier;

        if(data.allowedItems !== undefined)
            this._allowedItems = data.allowedItems;

        this.isMilestoneReward = data.isMilestoneReward !== undefined && data.isMilestoneReward;
        this.alwaysMultiple = data.alwaysMultiple !== undefined && data.alwaysMultiple;

        this.component.clickable.onclick = () => {
            if(this.unlocked)
                this.viewDetails();
        }
    }

    get masteryCategoryId() {
        return 'adventuring:jobs';
    }

    get name() {
        return this._name;
    }

    get media() {
        return getLockedMedia(this);
    }

    get level() {
        return this.manager.getMasteryLevel(this);
    }

    get unlocked() {
        // Fast path: once unlocked, always unlocked
        if (this._unlockedCached) return true;
        if (this._reqChecker === undefined) return true;
        const result = this._reqChecker.check();
        if (result) this._unlockedCached = true;
        return result;
    }

    detectTierFromRequirements(requirements) {
        if(!requirements || requirements.length === 0) return 0;

        const jobReqs = requirements.filter(r => r.type === 'job_level');
        if(jobReqs.length === 0) return 0;
        if(jobReqs.length === 1 && (jobReqs[0].level || 0) <= 25) return 1;
        if(jobReqs.length >= 2 || (jobReqs[0].level || 0) > 25) return 2;
        return 1;
    }

    get category() {
        return this.manager.categories.getObjectByID('adventuring:Jobs');
    }

    get tooltip() {
        return TooltipBuilder.forJob(this, this.manager).build();
    }

    get allowMultiple() {
        return this.alwaysMultiple || this.hasUnlock('multi_job_assignment');
    }

    onLoad() {
        this.renderQueue.name = true;
        this.renderQueue.tooltip = true;
        this.renderQueue.icon = true;
        this.renderQueue.clickable = true;
        this.renderQueue.mastery = true;
    }

    /**
     * Get per-level stat scaling for this job (for UI display).
     * Returns Map of stat -> scaling amount per level.
     */
    getStatScaling() {
        const scaling = new Map();
        if (!this.statEffects) return scaling;
        
        for (const effect of this.statEffects) {
            if (!effect.amount?.propertyScaling) continue;
            const levelScale = effect.amount.propertyScaling.get('level');
            if (levelScale !== undefined) {
                const stat = this.manager.stats.getObjectByID(effect.stat);
                if (stat) scaling.set(stat, levelScale);
            }
        }
        return scaling;
    }

    calculateStats() {
        this.stats.reset();

        const statBonus = this.manager.party.getJobStatBonus(this);

        // Calculate stats from statEffects using the effect system
        if (this.statEffects) {
            const context = { combatJob: this };
            for (const effect of this.statEffects) {
                const stat = this.manager.stats.getObjectByID(effect.stat);
                if (!stat) continue;
                
                const baseValue = effect.getAmount(null, null, context);
                this.stats.set(stat, Math.floor(baseValue * (1 + statBonus)));
            }
        }
    }

    /**
     * Get all effects from this job (stats + passives) for effectCache.
     * @param {Object} character - The character using this job
     * @param {string} jobType - 'combatJob' or 'passiveJob'
     * @param {Object} filters - Optional filters (trigger, type, etc.)
     * @returns {Array} Array of effect objects with getAmount methods
     */
    getEffects(character, jobType = 'combatJob', filters = {}) {
        const results = [];
        const job = this;

        // 1. Stat effects from job data (scale with level)
        if (this.statEffects && this.statEffects.length > 0) {
            for (const effect of this.statEffects) {
                // Base scaling effect (from level)
                const scalingEffect = {
                    trigger: 'passive',
                    type: 'stat_flat',
                    stat: effect.stat,
                    sourcePath: [
                        { type: jobType, name: `${this.name} (Lv.${this.level})`, ref: this },
                        { type: 'jobScaling', name: 'Level Scaling', ref: this }
                    ],
                    getAmount: (source, displayMode, context) => {
                        const jobForScaling = context?.[jobType] || job;
                        return effect.getAmount(source, displayMode, { 
                            ...context, 
                            [jobType]: jobForScaling 
                        });
                    }
                };
                results.push(scalingEffect);
                
                // Mastery bonus effect (separate line if there's a mastery bonus)
                if (job._cachedMasteryBonus > 0) {
                    const masteryEffect = {
                        trigger: 'passive',
                        type: 'stat_flat',
                        stat: effect.stat,
                        sourcePath: [
                            { type: jobType, name: `${this.name} (Lv.${this.level})`, ref: this },
                            { type: 'jobMastery', name: 'Mastery', ref: this }
                        ],
                        getAmount: (source, displayMode, context) => {
                            const jobForScaling = context?.[jobType] || job;
                            const baseAmount = effect.getAmount(source, displayMode, { 
                                ...context, 
                                [jobType]: jobForScaling 
                            });
                            return Math.floor(baseAmount * job._cachedMasteryBonus);
                        }
                    };
                    results.push(masteryEffect);
                }
            }
        }

        // 2. Passive effects from job passives (unlocked abilities)
        const passives = this.manager.getPassivesForJob(this);
        for (const passive of passives) {
            if (!passive.canEquip(character)) continue;
            if (!passive.effects) continue;
            
            for (const effect of passive.effects) {
                const effectObj = {
                    ...effect,
                    sourcePath: [{ type: 'jobPassive', name: `${this.name} (${passive.name})`, ref: passive }]
                };
                if (typeof effect.getAmount === 'function') {
                    effectObj.getAmount = effect.getAmount.bind(effect);
                }
                if (typeof effect.getStacks === 'function') {
                    effectObj.getStacks = effect.getStacks.bind(effect);
                }
                results.push(effectObj);
            }
        }

        // Apply filters
        return filterEffects(results, filters);
    }

    postDataRegistration() {
        this._reqChecker = new RequirementsChecker(this.manager, this.requirements);

        // Convert stat effects from data
        this.statEffects = [];
        
        if (this._effects !== undefined) {
            for (const effectData of this._effects) {
                if (effectData.trigger === 'passive' && effectData.type === 'stat_flat') {
                    // Create scalable effect - data must include scaleFrom
                    const effect = new AdventuringScalableEffect(this.manager, this.game, effectData);
                    effect.postDataRegistration();
                    effect.sourceJob = this;
                    this.statEffects.push(effect);
                }
            }
            delete this._effects;
        }
        if(this._allowedItems !== undefined) {
            this.allowedItems = [];
            this._allowedItems.forEach(_type => {
                let type = this.manager.itemTypes.getObjectByID(_type);
                this.allowedItems.push(type);
            });
            delete this._allowedItems;
        }
    }

    /**
     * Update cached mastery bonus for this job.
     * Called before stat calculations to avoid circular dependency.
     */
    updateCachedMasteryBonus() {
        this._cachedMasteryBonus = this.manager.party?.getJobStatBonus(this) || 0;
    }

    addXP(xp) {
        addMasteryXPWithBonus(this.manager, this, xp);
        this.manager.party.forEach(member => (member.renderQueue.jobs = true));
    }

    viewDetails() {
        this.manager.jobdetails.setJob(this);
        this.manager.jobdetails.render();
        this.manager.jobdetails.go();
    }

    render() {
        this.renderName();
        this.renderTooltip();
        this.renderIcon();
        this.renderClickable();
        this.renderMastery();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        if(this.unlocked) {
            this.component.nameText.textContent = this.name;
            this.summary.nameText.textContent = this.name;
            this.component.level.textContent = ` (${this.level})`;
            this.summary.level.textContent = ` (${this.level})`;
        } else {
            this.component.nameText.textContent = "???";
            this.component.level.textContent = "";
            this.summary.level.textContent = "";
        }

        this.renderQueue.name = false;
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

        if(this.unlocked) {
            this.component.icon.src = this.media;
            this.summary.icon.src = this.media;
        } else {
            this.component.icon.src = this.getMediaURL(UNKNOWN_MEDIA);
        }

        this.renderQueue.icon = false;
    }

    renderClickable() {
        if(!this.renderQueue.clickable)
            return;

        this.component.clickable.classList.toggle('pointer-enabled', this.unlocked);

        this.renderQueue.clickable = false;
    }

    renderMastery() {
        if(!this.renderQueue.mastery)
            return;

        let { xp, level, percent } = this.manager.getMasteryProgress(this);

        if(this.id !== 'adventuring:none') {
            if(this.unlocked) {
                this.component.masteryProgress.setFixedPosition(percent);
            } else {
                this.component.masteryProgress.setFixedPosition(0);
            }
        }

        this.renderQueue.mastery = false;
    }
}