const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');

const { AdventuringTrainerElement } = await loadModule('src/town/components/adventuring-trainer.mjs');

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
        this.manager.party.setAllLocked(false);
    }

    onHide() {
        this.manager.party.setAllLocked(true);
    }

    getJobTier(job) {
        if(job.isPassive) return 'passive';
        const tier = (job.tier !== undefined) ? job.tier : 0;
        if(tier <= 4) {
            return `combat-tier${tier}`;
        }
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

    getMinJobLevelRequirement(job) {
        const jobReqs = job.requirements.filter(r => r.type === 'job_level');
        if(jobReqs.length === 0) return 0;
        return Math.min(...jobReqs.map(r => r.level));
    }

    getTotalLevelRequirement(job) {
        return job.requirements
            .filter(r => r.type === 'job_level')
            .reduce((sum, r) => sum + r.level, 0);
    }

    sortJobsByRequirements(jobs) {
        return jobs.sort((a, b) => {
            const aMinLevel = this.getMinJobLevelRequirement(a);
            const bMinLevel = this.getMinJobLevelRequirement(b);
            if(aMinLevel !== bMinLevel) return aMinLevel - bMinLevel;
            const aTotalLevels = this.getTotalLevelRequirement(a);
            const bTotalLevels = this.getTotalLevelRequirement(b);
            if(aTotalLevels !== bTotalLevels) return aTotalLevels - bTotalLevels;
            return a.name.localeCompare(b.name);
        });
    }

    postDataRegistration() {
        let combatJobs = this.manager.jobs.allObjects.filter(job => job.isMilestoneReward && !job.isPassive);
        let passiveJobs = this.manager.jobs.allObjects.filter(job => job.isMilestoneReward && job.isPassive);
        combatJobs.forEach(job => {
            const tier = this.getJobTier(job);
            this.jobsByCategory[tier].push(job);
        });
        this.jobsByCategory['combat-tier0'] = this.sortJobsByRequirements(this.jobsByCategory['combat-tier0']);
        this.jobsByCategory['combat-tier1'] = this.sortJobsByRequirements(this.jobsByCategory['combat-tier1']);
        this.jobsByCategory['combat-tier2'] = this.sortJobsByRequirements(this.jobsByCategory['combat-tier2']);
        this.jobsByCategory['combat-tier3'] = this.sortJobsByRequirements(this.jobsByCategory['combat-tier3']);
        this.jobsByCategory['combat-tier4'] = this.sortJobsByRequirements(this.jobsByCategory['combat-tier4']);
        this.jobsByCategory['passive'] = this.sortJobsByRequirements(passiveJobs);
        this.masteryJobs = [
            ...this.jobsByCategory['combat-tier0'],
            ...this.jobsByCategory['combat-tier1'],
            ...this.jobsByCategory['combat-tier2'],
            ...this.jobsByCategory['combat-tier3'],
            ...this.jobsByCategory['combat-tier4'],
            ...this.jobsByCategory['passive']
        ];
        this.jobsByCategory['all'] = this.masteryJobs;
        this.masteryJobs.forEach(job => {
            job.component.mount(this.component.jobs);
        });
    }

    render() {
        this.masteryJobs.forEach(job => job.render());
    }
}