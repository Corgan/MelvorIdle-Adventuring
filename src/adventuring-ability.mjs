const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');

const { AdventuringAbilityUIComponent } = await loadModule('src/components/adventuring-ability.mjs');
const { AdventuringAbilityDetailsUIComponent } = await loadModule('src/components/adventuring-ability-details.mjs');

class AdventuringAbilityRenderQueue {
    constructor(){
        this.name = false;
        this.description = false;
        this.highlight = false;
        this.descriptionCharacter = false;
    }
}

class AdventuringAbilityHit {
    constructor(manager, game, data) {
        this.manager = manager;
        this.game = game;
        this.target = data.target;
        this.type = data.type;
        
        if(data.energy)
            this.energy = data.energy;
        if(data.base)
            this.base = data.base;
        if(data.scaling) {
            this._scaling = data.scaling;
            this.scaling = new AdventuringStats(this.manager, this.game);
        }
        if(data.delay)
            this.delay = data.delay;
        if(data.repeat)
            this.repeat = data.repeat;
    }

    postDataRegistration() {
        if(this._scaling !== undefined) {
            this._scaling.forEach(({ id, value }) => {
                this.scaling.set(id, value);
            });
            delete this._scaling;
        }
    }

    getAmount(stats, isDesc=false) {
        let amount = this.base !== undefined ? this.base : 0;
        if(isDesc) {
            let ret = amount;
            if(this.scaling !== undefined) {
                let showScale = !stats || stats.size === 0;
                ret += [...this.scaling].reduce((str, [stat, scale]) => {
                    let value = showScale ? scale : Math.floor(stats.get(stat) * scale);
                    let statImg = `<img class="skill-icon-xxs" style="height: .66rem; width: .66rem; margin-top: 0;" src="${stat.media}">`
                    return str + ` + ${value} ${statImg}`;
                }, '');
            }
            return ret;
        } else {
            if(this.scaling !== undefined)
                amount += [...this.scaling].reduce((bonus, [stat, scale]) => {
                    return bonus + (stats.get(stat) * scale)
                }, 0);
            return Math.floor(amount);
        }
    }
}

export class AdventuringAbility extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;
        this.name = data.name;
        this.description = data.description;
        this.hits = data.hits.map(hit => new AdventuringAbilityHit(this.manager, this.game, hit));
        if(data.energy)
            this.energy = data.energy;
        if(data.cost)
            this.cost = data.cost;
        this.isEnemy = data.isEnemy === true;
        this.requirements = data.requirements;
        this.highlight = false;

        this.component = new AdventuringAbilityUIComponent(this.manager, this.game, this);

        this.details = new AdventuringAbilityDetailsUIComponent(this.manager, this.game, this);

        this.renderQueue = new AdventuringAbilityRenderQueue();
    }

    postDataRegistration() {
        this.hits.forEach(hit => hit.postDataRegistration());
    }

    unlockedBy(job) {
        if(this.isEnemy)
            return false;
        if(this.requirements.length == 0)
            return false;
        return this.requirements.reduce((unlockedBy, requirement) => {
            if(requirement.type == "current_job_level" && job.id === requirement.job)
                return true;
            if(requirement.type == "job_level" && job.id === requirement.job)
                return true;
            return unlockedBy;
        }, false);
    }

    get unlocked() {
        if(this.isEnemy)
            return false;
        if(this.requirements.length == 0)
            return true;
        return this.requirements.reduce((equipable, requirement) => {
            if(requirement.type == "job_level" || requirement.type == "current_job_level") {
                let job = this.manager.jobs.getObjectByID(requirement.job);
                if(job === undefined)
                    return false;
                if(this.manager.getMasteryLevel(job) < requirement.level)
                    return false;
            }
            return equipable;
        }, true);
    }

    canEquip(character) {
        if(this.isEnemy)
            return false;
        if(this.requirements.length == 0)
            return true;
        return this.requirements.reduce((equipable, requirement) => {

            if(requirement.type == "current_job_level") {
                if(character.combatJob.id === requirement.job) {
                    if(this.manager.getMasteryLevel(character.combatJob) < requirement.level)
                        return false;
                } else if(character.passiveJob.id === requirement.job) {
                    if(this.manager.getMasteryLevel(character.passiveJob) < requirement.level)
                        return false;
                } else {
                    return false;
                }
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

    getDescription(stats, isDesc=false) {
        return this.hits.reduce((desc, hit, i) =>  desc.replace(`{hit.${i}.amount}`, hit.getAmount(stats, isDesc)), this.description);
    }

    setHighlight(highlight) {
        this.highlight = highlight;
        this.renderQueue.highlight = true;
    }

    render() {
        this.renderName();
        this.renderDescription();
        this.renderHighlight();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        if(this.unlocked) {
            this.component.name.textContent = this.name;
            this.details.name.textContent = this.name;
        } else {
            this.component.name.textContent = "???";
            this.details.name.textContent = "???";
        }

        this.renderQueue.name = false;
    }

    renderDescription() {
        if(!this.renderQueue.description)
            return;

        if(this.unlocked) {
            let stats = false;
            if(this.renderQueue.descriptionCharacter)
                stats = this.renderQueue.descriptionCharacter.stats;

            this.component.description.innerHTML = this.getDescription(stats, true);
            
            this.details.description.innerHTML = this.getDescription(false, true);

        } else {
            this.details.description.textContent = "???";
        }

        this.renderQueue.description = false;
    }

    renderHighlight() {
        if(!this.renderQueue.highlight)
            return;

        this.component.styling.classList.toggle('bg-combat-menu-selected', this.highlight && this.unlocked);

        this.renderQueue.highlight = false;
    }
}