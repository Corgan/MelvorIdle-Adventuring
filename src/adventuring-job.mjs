const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');
const { AdventuringJobUIComponent } = await loadModule('src/components/adventuring-job.mjs');
const { AdventuringJobSummaryUIComponent } = await loadModule('src/components/adventuring-job-summary.mjs');

class AdventuringJobRenderQueue {
    constructor(){
        this.name = false;
        this.icon = false;
        this.clickable = false;
        this.mastery = false;
    }
}

export class AdventuringJob extends MasteryAction {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.component = new AdventuringJobUIComponent(this.manager, this.game, this);
        this.summary = new AdventuringJobSummaryUIComponent(this.manager, this.game, this);
        this.renderQueue = new AdventuringJobRenderQueue();

        this._name = data.name;
        this.renderQueue.name = true;

        this._media = data.media;
        this.renderQueue.icon = true;

        this.level = data.level;
        this._scaling = data.scaling;
        this.scaling = new AdventuringStats(this.manager, this.game);
        
        this.stats = new AdventuringStats(this.manager, this.game);

        this.isPassive = data.isPassive === true;

        if(data.allowedItems)
            this.allowedItems = data.allowedItems;
        
        this.isMilestoneReward = data.isMilestoneReward;
        this.alwaysMultiple = data.alwaysMultiple;

        this.component.clickable.onclick = () => {
            if(this.unlocked)
                this.viewDetails();
        }
        this.renderQueue.clickable = true;
    }

    get name() {
        return this.unlocked ? this._name : "???";
    }

    get media() {
        return this.unlocked ? this.getMediaURL(this._media) : this.getMediaURL('melvor:assets/media/main/question.svg');
    }

    get unlocked() {
        return this.level <= this.manager.level;
    }

    get allowMultiple() {
        return this.alwaysMultiple || this.manager.getMasteryLevel(this) >= 99;
    }
    
    calculateStats() {
        this.stats.reset();

        let masteryLevel = this.manager.getMasteryLevel(this);
        
        this.scaling.forEach((value, stat) => {
            this.stats.set(stat, Math.floor(masteryLevel * value));
        });
    }

    postDataRegistration() {
        if(this._scaling !== undefined) {
            this._scaling.forEach(({ id, value }) => {
                this.scaling.set(id, value);
            });
            delete this._scaling;
        }
    }

    viewDetails() {
        this.manager.jobdetails.setJob(this);
        this.manager.jobdetails.render();
        this.manager.jobdetails.go();
    }

    render() {
        this.component.name.textContent = this.name;
        this.component.icon.src = this.media;
        this.summary.name.textContent = this.name;
        this.summary.icon.src = this.media;

        if(this.unlocked) {
            let { xp, level, percent } = this.manager.getMasteryProgress(this);

            this.component.level.textContent = this.id !== "adventuring:none" ? ` (${level})` : "";
            this.component.clickable.classList.toggle('pointer-enabled', true);

            this.component.masteryProgress.setFixedPosition(percent);

            this.summary.level.textContent = this.id !== "adventuring:none" ? ` (${level})` : "";
        } else {
            this.component.level.textContent = "";
            this.component.clickable.classList.toggle('pointer-enabled', false);

            this.component.masteryProgress.setFixedPosition(0);

            this.summary.level.textContent = "";
        }
    }
}