const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');

const { AdventuringAbilityElement } = await loadModule('src/components/adventuring-ability.mjs');
const { AdventuringAbilityDetailsElement } = await loadModule('src/components/adventuring-ability-details.mjs');

class AdventuringAbilityRenderQueue {
    constructor() {
        this.name = false;
        this.description = false;
        this.highlight = false;
        this.descriptionCharacter = false;
    }

    queueAll() {
        this.name = true;
        this.description = true;
        this.highlight = true;
    }
}

class AdventuringAbilityHitEffect {
    constructor(manager, game, ability, hit, data) {
        this.manager = manager;
        this.game = game;
        this.hit = hit;
        this.ability = ability;
        this.type = data.type;

        if(data.id !== undefined)
            this.id = data.id;
        
        if(data.energy !== undefined)
            this.energy = data.energy;

        if(data.amount !== undefined) {
            this.amount = { base: data.amount.base };
            if(data.amount.scaling !== undefined) {
                this.amount._scaling = data.amount.scaling;
                this.amount.scaling = new AdventuringStats(this.manager, this.game);
            }
        }

        if(data.stacks !== undefined) {
            this.stacks = { base: data.stacks.base };
            if(data.stacks.scaling !== undefined) {
                this.stacks._scaling = data.stacks.scaling;
                this.stacks.scaling = new AdventuringStats(this.manager, this.game);
            }
        }
    }

    postDataRegistration() {
        if(this.amount !== undefined && this.amount._scaling !== undefined) {
            this.amount._scaling.forEach(({ id, value }) => {
                this.amount.scaling.set(id, value);
            });
            delete this.amount._scaling;
        } else {
            if(this.type === "buff" || this.type === "debuff") {
                let aura = this.manager.auras.getObjectByID(this.id);
                if(aura !== undefined && aura.amount !== undefined) {
                    this.amount = { base: aura.amount };
                }
            }
        }
        if(this.stacks !== undefined && this.stacks._scaling !== undefined) {
            this.stacks._scaling.forEach(({ id, value }) => {
                this.stacks.scaling.set(id, value);
            });
            delete this.stacks._scaling;
        } else {
            if(this.type === "buff" || this.type === "debuff") {
                let aura = this.manager.auras.getObjectByID(this.id);
                if(aura !== undefined && aura.stacks !== undefined) {
                    this.stacks = { base: aura.stacks };
                }
            }
        }
    }

    getAmount(stats, isDesc=false) {
        let amount = this.amount !== undefined && this.amount.base !== undefined ? this.amount.base : 0;
        if(isDesc) {
            let ret = amount;
            if(this.amount !== undefined && this.amount.scaling !== undefined) {
                let showScale = stats === undefined || stats.size === 0;
                ret += [...this.amount.scaling].reduce((str, [stat, scale]) => {
                    let value = showScale ? scale : Math.floor(stats.get(stat) * scale);
                    let statImg = `<img class="skill-icon-xxs" style="height: .66rem; width: .66rem; margin-top: 0;" src="${stat.media}">`
                    return str + ` + ${value} ${statImg}`;
                }, '');
            }
            return ret;
        } else {
            if(this.amount !== undefined && this.amount.scaling !== undefined && stats !== undefined)
                amount += [...this.amount.scaling].reduce((bonus, [stat, scale]) => {
                    return bonus + (stats.get(stat) * scale)
                }, 0);
            return Math.floor(amount);
        }
    }

    getStacks(stats, isDesc=false) {
        let stacks = this.stacks !== undefined && this.stacks.base !== undefined ? this.stacks.base : 0;
        if(isDesc) {
            let ret = stacks;
            if(this.stacks !== undefined && this.stacks.scaling !== undefined) {
                let showScale = stats === undefined || stats.size === 0;
                ret += [...this.stacks.scaling].reduce((str, [stat, scale]) => {
                    let value = showScale ? scale : Math.floor(stats.get(stat) * scale);
                    let statImg = `<img class="skill-icon-xxs" style="height: .66rem; width: .66rem; margin-top: 0;" src="${stat.media}">`
                    return str + ` + ${value} ${statImg}`;
                }, '');
            }
            return ret;
        } else {
            if(this.stacks !== undefined && this.stacks.scaling !== undefined && stats !== undefined)
                stacks += [...this.stacks.scaling].reduce((bonus, [stat, scale]) => {
                    return bonus + (stats.get(stat) * scale)
                }, 0);
            return Math.floor(stacks);
        }
    }
}

class AdventuringAbilityHit {
    constructor(manager, game, ability, data) {
        this.manager = manager;
        this.game = game;
        this.ability = ability;
        this.target = data.target;
        this.party = data.party;

        this.effects = data.effects.map(effect => new AdventuringAbilityHitEffect(this.manager, this.game, this.ability, this, effect));

        if(data.delay !== undefined)
            this.delay = data.delay;
        if(data.repeat !== undefined)
            this.repeat = data.repeat;
    }

    postDataRegistration() {
        this.effects.forEach(effect => effect.postDataRegistration());
    }
}

export class AdventuringAbility extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;
        this.name = data.name;
        this.description = data.description;
        this.hits = data.hits.map(hit => new AdventuringAbilityHit(this.manager, this.game, this, hit));
        if(data.energy)
            this.energy = data.energy;
        if(data.cost)
            this.cost = data.cost;
        this.isEnemy = data.isEnemy === true;
        this.requirements = data.requirements;
        this.highlight = false;

        this.component = createElement('adventuring-ability');

        this.details = createElement('adventuring-ability-details');

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
                if(character.combatJob !== undefined && character.combatJob.id === requirement.job) {
                    if(this.manager.getMasteryLevel(character.combatJob) < requirement.level)
                        return false;
                } else if(character.passiveJob !== undefined && character.passiveJob.id === requirement.job) {
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
        return this.hits.reduce((desc, hit, i) => {
            return hit.effects.reduce((hitDesc, effect, e) => {
                hitDesc = hitDesc.replace(`{hit.${i}.effect.${e}.amount}`, effect.getAmount(stats, isDesc));
                hitDesc = hitDesc.replace(`{hit.${i}.effect.${e}.stacks}`, effect.getStacks(stats, isDesc));
                return hitDesc;
            }, desc);
        }, this.description);
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
            let stats = undefined;
            if(this.renderQueue.descriptionCharacter)
                stats = this.renderQueue.descriptionCharacter.stats;

            this.component.description.innerHTML = this.getDescription(stats, true);
            
            this.details.description.innerHTML = this.getDescription(undefined, true);

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