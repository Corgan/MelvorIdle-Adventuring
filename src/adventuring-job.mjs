const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');
const { AdventuringJobUIComponent } = await loadModule('src/components/adventuring-job.mjs');
const { AdventuringJobSummaryUIComponent } = await loadModule('src/components/adventuring-job-summary.mjs');

class AdventuringJobRenderQueue {
    constructor(){
        this.name = false;
        this.tooltip = false;
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

        this._media = data.media;

        this.requirements = data.requirements;
        this._scaling = data.scaling;
        this.scaling = new AdventuringStats(this.manager, this.game);
        
        this.stats = new AdventuringStats(this.manager, this.game);

        this.isPassive = data.isPassive === true;

        if(data.allowedItems !== undefined)
            this._allowedItems = data.allowedItems;
        
        this.isMilestoneReward = data.isMilestoneReward !== undefined && data.isMilestoneReward;
        this.alwaysMultiple = data.alwaysMultiple !== undefined && data.alwaysMultiple;

        this.component.clickable.onclick = () => {
            if(this.unlocked)
                this.viewDetails();
        }
    }

    get name() {
        return this.unlocked ? this._name : "???";
    }

    get media() {
        return this.unlocked ? this.getMediaURL(this._media) : this.getMediaURL('melvor:assets/media/main/question.svg');
    }

    get level() {
        return this.manager.getMasteryLevel(this);
    }

    get unlocked() {
        if(this.requirements.length == 0)
            return true;
        return this.requirements.reduce((equipable, requirement) => {
            if(requirement.type == "skill_level") {
                if(this.manager.level < requirement.level)
                    return false;
            }
            if(requirement.type == "job_level") {
                let job = this.manager.jobs.getObjectByID(requirement.job);
                if(job === undefined)
                    return false;
                if(this.manager.getMasteryLevel(job) < requirement.level)
                    return false;
            }
            return equipable;
        }, true);
    }

    get tooltip() {
        let html = '<div>';

        html += `<div><span>${this.name}</span></div>`;
        if(this.unlocked) {
            let { xp, level, percent, nextLevelXP } = this.manager.getMasteryProgress(this);
            html += `<div><small>Level ${level}</small></div>`;
            html += `<div><small>${xp} / ${nextLevelXP} XP</small></div>`;

            this.stats.forEach((value, stat) => {
                let statImg = `<img class="skill-icon-xxs" style="height: .66rem; width: .66rem; margin-top: 0;" src="${stat.media}">`
                html += `<div><small>+${value}${statImg}</small></div>`;
            });
        }
        html += '</div>'
        return html;
    }

    get allowMultiple() {
        return this.alwaysMultiple || this.manager.getMasteryLevel(this) >= 99;
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
        
        this.scaling.forEach((value, stat) => {
            this.stats.set(stat, Math.floor(this.level * value));
        });
    }

    postDataRegistration() {
        if(this._scaling !== undefined) {
            this._scaling.forEach(({ id, value }) => {
                this.scaling.set(id, value);
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
        this.manager.log.add(`${this.name} gains ${xp} mastery xp`)
        this.manager.addMasteryXP(this, xp);
        this.manager.addMasteryPoolXP(xp);
        this.renderQueue.tooltip = true;
        this.manager.party.all.forEach(member => (member.renderQueue.jobs = true));
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
            this.component.name.textContent = this.name;
            this.summary.name.textContent = this.name;
            this.component.level.textContent = ` (${this.level})`;
            this.summary.level.textContent = ` (${this.level})`;
        } else {
            this.component.name.textContent = "???";
            this.component.level.textContent = "";
            this.summary.level.textContent = "";
        }

        this.renderQueue.name = false;
    }

    renderTooltip() {
        if(!this.renderQueue.tooltip)
            return;

        this.component.tooltip.setContent(this.tooltip);

        this.renderQueue.tooltip = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        if(this.unlocked) {
            this.component.icon.src = this.media;
            this.summary.icon.src = this.media;
        } else {
            this.component.icon.src = this.getMediaURL('melvor:assets/media/main/question.svg');
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

        if(this.unlocked) {
            this.component.masteryProgress.setFixedPosition(percent);
        } else {
            this.component.masteryProgress.setFixedPosition(0);
        }

        this.renderQueue.mastery = false;
    }
}