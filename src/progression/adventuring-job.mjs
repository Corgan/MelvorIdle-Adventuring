const { loadModule } = mod.getContext(import.meta);

const { AdventuringMasteryAction } = await loadModule('src/core/adventuring-mastery-action.mjs');
const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');
const { AdventuringJobElement } = await loadModule('src/progression/components/adventuring-job.mjs');
const { AdventuringJobSummaryElement } = await loadModule('src/progression/components/adventuring-job-summary.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { addMasteryXPWithBonus, RequirementsChecker, AdventuringMasteryRenderQueue, getLockedMedia, UNKNOWN_MEDIA } = await loadModule('src/core/adventuring-utils.mjs');

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
        this._scaling = data.scaling;
        this.scaling = new AdventuringStats(this.manager, this.game);

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
        if (this._reqChecker === undefined) return true;
        return this._reqChecker.check();
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

    calculateStats() {
        this.stats.reset();

        const statBonus = this.manager.party.getJobStatBonus(this);

        this.scaling.forEach((value, stat) => {
            const baseValue = Math.floor(this.level * value);
            this.stats.set(stat, Math.floor(baseValue * (1 + statBonus)));
        });
    }

    /**
     * Get all passive effects for this job that the character can use.
     * @param {Object} character - The character using this job
     * @returns {Array} Array of flat effects with source metadata
     */
    getPassiveEffects(character) {
        const results = [];
        const passives = this.manager.getPassivesForJob(this);

        for (const passive of passives) {
            if (!passive.canEquip(character)) continue;
            if (!passive.effects) continue;
            
            for (const effect of passive.effects) {
                // Create effect object that preserves methods from the original effect
                const effectObj = {
                    ...effect,
                    source: passive,
                    sourceName: `${this.name} (${passive.name})`,
                    sourceType: 'jobPassive'
                };
                // Preserve getAmount and getStacks methods if they exist
                if (typeof effect.getAmount === 'function') {
                    effectObj.getAmount = effect.getAmount.bind(effect);
                }
                if (typeof effect.getStacks === 'function') {
                    effectObj.getStacks = effect.getStacks.bind(effect);
                }
                results.push(effectObj);
            }
        }

        return results;
    }

    /**
     * Get job passive effects for a trigger type.
     * @param {Object} character - The character using this job
     * @param {string} triggerType - The trigger type to filter by
     * @returns {Array} Array of flat effects with source metadata
     */
    getPassivesForTrigger(character, triggerType) {
        return this.getPassiveEffects(character).filter(e => e.trigger === triggerType);
    }

    postDataRegistration() {
        this._reqChecker = new RequirementsChecker(this.manager, this.requirements);

        if(this._scaling !== undefined) {
            this._scaling.forEach(({ id, amount }) => {
                this.scaling.set(id, amount);
            });
            delete this._scaling;
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