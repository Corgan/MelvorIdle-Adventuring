const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringTrainerElement } = await loadModule('src/components/adventuring-trainer.mjs');

export class AdventuringTrainer extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-trainer');

        this.masteryJobs = [];
        this.jobsByCategory = {
            'all': [],
            'combat-tier0': [],
            'combat-tier1': [],
            'combat-tier2': [],
            'combat-tier3': [],
            'combat-tier4': [],
            'passive': []
        };
        this.currentFilter = 'all';
        
        this.component.back.onclick = () => this.back();
        this.component.categoryFilter.onchange = () => this.onFilterChange();
    }

    get active() {
        if(this.manager.jobdetails.active)
            return true;
        return super.active;
    }

    back() {
        if(this.active) {
            this.manager.town.setBuilding(undefined);
        }
    }

    onLoad() {
        super.onLoad();
    }

    onShow() {
        this.manager.party.all.forEach(member => member.setLocked(false));
    }

    onHide() {
        this.manager.party.all.forEach(member => member.setLocked(true));
    }

    /**
     * Determine the tier category of a job based on its tier property
     * Uses the job's data-driven tier value instead of hardcoded lists
     */
    getJobTier(job) {
        if(job.isPassive) return 'passive';
        
        // Use the job's tier property (0-4+)
        const tier = job.tier ?? 0;
        if(tier <= 4) {
            return `combat-tier${tier}`;
        }
        // Tier 5+ jobs fall into tier4 category for UI purposes
        return 'combat-tier4';
    }

    onFilterChange() {
        this.currentFilter = this.component.categoryFilter.value;
        this.updateVisibleJobs();
    }

    updateVisibleJobs() {
        const jobsToShow = this.currentFilter === 'all' 
            ? this.masteryJobs 
            : this.jobsByCategory[this.currentFilter];
        
        this.masteryJobs.forEach(job => {
            const shouldShow = jobsToShow.includes(job);
            job.component.classList.toggle('d-none', !shouldShow);
        });
    }

    /**
     * Get the minimum job level requirement for a job
     */
    getMinJobLevelRequirement(job) {
        const jobReqs = job.requirements.filter(r => r.type === 'job_level');
        if(jobReqs.length === 0) return 0;
        return Math.min(...jobReqs.map(r => r.level));
    }

    /**
     * Get the total levels required across all job_level requirements
     */
    getTotalLevelRequirement(job) {
        return job.requirements
            .filter(r => r.type === 'job_level')
            .reduce((sum, r) => sum + r.level, 0);
    }

    /**
     * Sort jobs by: job level requirement, then total levels required, then name
     */
    sortJobsByRequirements(jobs) {
        return jobs.sort((a, b) => {
            // First by minimum job level requirement
            const aMinLevel = this.getMinJobLevelRequirement(a);
            const bMinLevel = this.getMinJobLevelRequirement(b);
            if(aMinLevel !== bMinLevel) return aMinLevel - bMinLevel;
            
            // Then by total levels required
            const aTotalLevels = this.getTotalLevelRequirement(a);
            const bTotalLevels = this.getTotalLevelRequirement(b);
            if(aTotalLevels !== bTotalLevels) return aTotalLevels - bTotalLevels;
            
            // Finally by name
            return a.name.localeCompare(b.name);
        });
    }

    postDataRegistration() {
        // Categorize all milestone jobs
        let combatJobs = this.manager.jobs.allObjects.filter(job => job.isMilestoneReward && !job.isPassive);
        let passiveJobs = this.manager.jobs.allObjects.filter(job => job.isMilestoneReward && job.isPassive);

        // Sort combat jobs by tier then by requirements
        combatJobs.forEach(job => {
            const tier = this.getJobTier(job);
            this.jobsByCategory[tier].push(job);
        });
        
        // Sort each tier by requirements (job level, total levels, then name)
        this.jobsByCategory['combat-tier0'] = this.sortJobsByRequirements(this.jobsByCategory['combat-tier0']);
        this.jobsByCategory['combat-tier1'] = this.sortJobsByRequirements(this.jobsByCategory['combat-tier1']);
        this.jobsByCategory['combat-tier2'] = this.sortJobsByRequirements(this.jobsByCategory['combat-tier2']);
        this.jobsByCategory['combat-tier3'] = this.sortJobsByRequirements(this.jobsByCategory['combat-tier3']);
        this.jobsByCategory['combat-tier4'] = this.sortJobsByRequirements(this.jobsByCategory['combat-tier4']);
        
        // Add passive jobs sorted by requirements
        this.jobsByCategory['passive'] = this.sortJobsByRequirements(passiveJobs);

        // Build all jobs list in order: tier0, tier1, tier2, tier3, tier4, passive
        this.masteryJobs = [
            ...this.jobsByCategory['combat-tier0'],
            ...this.jobsByCategory['combat-tier1'],
            ...this.jobsByCategory['combat-tier2'],
            ...this.jobsByCategory['combat-tier3'],
            ...this.jobsByCategory['combat-tier4'],
            ...this.jobsByCategory['passive']
        ];
        
        // Add all to the 'all' category
        this.jobsByCategory['all'] = this.masteryJobs;

        // Mount all jobs to DOM
        this.masteryJobs.forEach(job => {
            job.component.mount(this.component.jobs);
        });
    }

    render() {
        this.masteryJobs.forEach(job => job.render());
    }
}