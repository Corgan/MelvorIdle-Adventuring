const { loadModule } = mod.getContext(import.meta);

const { AdventuringJobUIComponent } = await loadModule('src/components/adventuring-job.mjs');

class AdventuringJobRenderQueue {
    constructor(){
        this.name = false;
        this.icon = false;
        this.clickable = false;
    }
}

export class AdventuringJob extends MasteryAction {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.component = new AdventuringJobUIComponent(this.manager, this.game);
        this.renderQueue = new AdventuringJobRenderQueue();

        this.name = data.name;
        this.renderQueue.name = true;

        this._media = data.media;
        this.renderQueue.icon = true;

        this.level = data.level;
        this.levelScaling = data.levelScaling;

        this.allowedItems = data.allowedItems;
        
        this.isMilestoneReward = data.isMilestoneReward;
        this.alwaysMultiple = data.alwaysMultiple;

        this.component.clickable.onclick = () => {
            if(this.unlocked)
                this.viewDetails();
        }
        this.renderQueue.clickable = true;
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    get unlocked() {
        return this.level <= this.manager.level;
    }

    get levels() {
        let masteryLevel = this.manager.getMasteryLevel(this);
        return Object.fromEntries(Object.entries(this.levelScaling).map(([skill, scale]) => [skill, Math.floor(masteryLevel * scale)]))
    }

    viewDetails() {
        this.manager.jobdetails.setJob(this);
        this.manager.jobdetails.render();
        this.manager.jobdetails.go();
    }

    render() {
        if(!this.isMilestoneReward)
            return;
        
        if(this.unlocked) {
            let { xp, level, percent } = this.manager.getMasteryProgress(this);

            this.component.name.textContent = this.name;
            this.component.level.textContent = ` (${level})`;
            this.component.icon.src = this.media;
            this.component.clickable.classList.toggle('pointer-enabled', true);

            this.component.masteryProgress.setFixedPosition(percent);
        } else {
            this.component.name.textContent = "???";
            this.component.level.textContent = "";
            this.component.icon.src = this.getMediaURL('melvor:assets/media/main/question.svg');
            this.component.masteryProgress.setFixedPosition(0);
            this.component.clickable.classList.toggle('pointer-enabled', false);
        }
    }
}