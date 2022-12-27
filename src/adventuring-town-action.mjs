const { loadModule } = mod.getContext(import.meta);

export class AdventuringTownAction extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        if(data.name !== undefined)
            this.name = data.name;

        if(data.media !== undefined)
            this._media = data.media;

        this._status = data.status;

        this.requirements = data.requirements;
        this.effects = data.effects;
    }

    get status() { // Fix this one day
        if(typeof this._status === "string") {
            return this._status;
        } else {
            if(this._status.length > 0) {
                return this._status[Math.floor(Math.random()*this._status.length)];
            }
        }
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    onLoad() {

    }

    postDataRegistration() {

    }

    execute(character, building) {
        this.effects.forEach(effect => {
            if(effect.type === "revive") {
                let { amount } = effect;
                character.revive({ amount });
            }
            if(effect.type === "heal") {
                let amount = Math.floor(effect.amount * character.maxHitpoints);
                character.heal({ amount });
            }
            if(effect.type === "work") {
                building.page.doWork(character);
            }
        });
    }

    canDo(character) {
        if(this.requirements.length == 0)
            return true;
        return this.requirements.reduce((doable, requirement) => {
            if(requirement.type == "dead") {
                if(!character.dead)
                    return false;
            }
            if(requirement.type == "current_job") {
                if((character.combatJob === undefined || character.combatJob.id !== requirement.job) && (character.passiveJob === undefined || character.passiveJob.id !== requirement.job))
                    return false;
            }
            if(requirement.type == "comparison") {
                let operand;
                if(requirement.operand === "hitpoint_pct")
                    operand = character.hitpointsPercent;
                if(requirement.operand === "material_count") {
                    let material = this.manager.materials.getObjectByID(requirement.material);
                    let count = this.manager.stash.materialCounts.get(material);
                    if(material === undefined || count === undefined)
                        return false;
                    operand = count;
                }

                if(operand === undefined)
                    return false;

                if(requirement.operator === "lt" && requirement.amount <= operand)
                    return false;

                if(requirement.operator === "gt" && requirement.amount >= operand)
                    return false;

                if(requirement.operator === "eq" && requirement.amount !== operand)
                    return false;
            }
            return doable;
        }, true);
    }
}