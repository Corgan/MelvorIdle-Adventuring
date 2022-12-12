const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringTrainerUIComponent } = await loadModule('src/components/adventuring-trainer.mjs');

export class AdventuringTrainer extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = new AdventuringTrainerUIComponent(this.manager, this.game, this);

        this.masteryJobs = [];
        this.component.back.onclick = () => this.back();
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

    postDataRegistration() {
        let combatJobs = this.manager.jobs.allObjects.filter(job => job.isMilestoneReward && !job.isPassive).sort((a,b)=> a.level - b.level);
        let passiveJobs = this.manager.jobs.allObjects.filter(job => job.isMilestoneReward && job.isPassive).sort((a,b)=> a.level - b.level);


        this.masteryJobs = [...combatJobs, ...passiveJobs];

        this.masteryJobs.forEach(job => {
            job.component.mount(this.component.jobs);
        });
    }

    render() {
        this.masteryJobs.forEach(job => job.render());
    }
}