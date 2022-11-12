const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringTrainerUIComponent } = await loadModule('src/components/adventuring-trainer.mjs');

export class AdventuringTrainer extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = new AdventuringTrainerUIComponent(this.manager, this.game);

        this.masteryJobs = [];
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
        this.masteryJobs = this.manager.jobs.allObjects.filter(job => job.isMilestoneReward);

        this.masteryJobs.forEach(job => {
            job.component.mount(this.component.jobs);
        });
    }

    render() {
        this.masteryJobs.forEach(job => {
            job.render();
        });
    }
}