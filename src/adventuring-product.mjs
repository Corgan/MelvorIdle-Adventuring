const { loadModule } = mod.getContext(import.meta);

export class AdventuringProduct extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._item = data.item;
        this.count = data.count;

        this.requirements = data.requirements;
        this.materials = data.materials;
    }

    get name() {
        return this.item.name;
    }

    get media() {
        return this.item.media;
    }

    onLoad() {

    }

    postDataRegistration() {
        this.item = this.game.items.getObjectByID(this._item);
        delete this._item;
    }

    create() {
        for(let mat of this.materials) {
            let material = this.manager.materials.getObjectByID(mat.id);
            this.manager.stash.remove(material, mat.count);
        }
        return { 
            item: this.item,
            count: this.count
        }
    }

    canMake(character) {
        if(this.materials.length > 0) {
            for(let material of this.materials) {
                let mat = this.manager.materials.getObjectByID(material.id);
                if(this.manager.stash.materialCounts.get(mat) < material.count)
                    return false;
            }
        }
        if(this.requirements.length == 0)
            return true;
        return this.requirements.reduce((doable, requirement) => {
            if(requirement.type == "job_level") {
                let job = this.manager.jobs.getObjectByID(requirement.job);
                if(job === undefined)
                    return false;
                if(this.manager.getMasteryLevel(job) < requirement.level)
                    return false;
            }
            if(requirement.type == "current_job") {
                if((character.combatJob === undefined || character.combatJob.id !== requirement.job) && (character.passiveJob === undefined || character.passiveJob.id !== requirement.job))
                    return false;
            }
            return doable;
        }, true);
    }
}