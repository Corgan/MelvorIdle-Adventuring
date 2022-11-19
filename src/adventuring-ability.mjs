const { loadModule } = mod.getContext(import.meta);

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
        if(data.scaling)
            this.scaling = data.scaling;
        if(data.delay)
            this.delay = data.delay;
        if(data.repeat)
            this.repeat = data.repeat;
    }

    getAmount(levels, isDesc=false) {
        let amount = this.base !== undefined ? this.base : 0;
        if(isDesc) {
            let ret = amount;
            if(this.scaling !== undefined) {
                let showScale = Object.keys(levels).length === 0;
                ret += Object.entries(this.scaling).reduce((str, [skill, scale]) => {
                    let level = levels[skill] !== undefined ? levels[skill] : 0;
                    let value = showScale ? scale : Math.floor(level * scale);
                    let skillLowerCase = skill.toLowerCase();
                    let skillImg = `<img class="skill-icon-xxs" style="height: .66rem; width: .66rem; margin-top: 0;" src="assets/media/skills/${skillLowerCase}/${skillLowerCase}.svg">`
                    return str + ` + ${value} ${skillImg}`;
                }, '');
            }
            return ret;
        } else {
            if(this.scaling !== undefined)
                amount += Object.entries(this.scaling).reduce((bonus, [skill, scale]) => {
                    let level = levels[skill] !== undefined ? levels[skill] : 0;
                    return bonus + (level * scale)
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

        this.component = new AdventuringAbilityUIComponent();

        this.details = new AdventuringAbilityDetailsUIComponent();

        this.component.styling.onclick = () => {
            if(this.component.selectorCharacter !== undefined && this.component.selectorType !== undefined) {
                if(this.component.selectorType == 'generator') {
                    this.component.selectorCharacter.setGenerator(this);
                }
                if(this.component.selectorType == 'spender') {
                    this.component.selectorCharacter.setSpender(this);
                }

                this.component.selectorCharacter = undefined;
                this.component.selectorType = undefined;
                Swal.close();
            }
        }

        this.renderQueue = new AdventuringAbilityRenderQueue();
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
                if(character.job.id !== requirement.job)
                    return false;
                if(this.manager.getMasteryLevel(character.job) < requirement.level)
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

    getDescription(levels={}, isDesc=false) {
        return this.hits.reduce((desc, hit, i) =>  desc.replace(`{hit.${i}.amount}`, hit.getAmount(levels, isDesc)), this.description);
    }

    selectTargets(heroes, enemies) {
        let targets = [];


        return targets;
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
            let levels = {};
            if(this.renderQueue.descriptionCharacter)
                levels = this.renderQueue.descriptionCharacter.levels;
                this.component.description.innerHTML = this.getDescription(levels, true);
            
            this.details.description.innerHTML = this.getDescription({}, true);

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