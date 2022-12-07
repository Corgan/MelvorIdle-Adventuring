const { loadModule } = mod.getContext(import.meta);

export class AdventuringDungeonTile extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.name = data.name;
        this._media = data.media;
        this.alwaysShowIcon = data.alwaysShowIcon !== undefined && data.alwaysShowIcon;

        if(data.requirements !== undefined)
            this.requirements = data.requirements;
        if(data.weight !== undefined)
            this.weight = data.weight;
        if(data.floor_max !== undefined)
            this.floor_max = data.floor_max;
        if(data.dungeon_max !== undefined)
            this.dungeon_max = data.dungeon_max;
        if(data.effects !== undefined)
            this.effects = data.effects;
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    get spawnable() {
        if(this.requirements === undefined)
            return false;
        for(let requirement of this.requirements) {
            if(requirement.type == "current_job") {
                if(!this.manager.party.all.some(member => (member.combatJob !== undefined && member.combatJob.id === requirement.job) || (member.passiveJob !== undefined && member.passiveJob.id === requirement.job)))
                    return false;
            }
        }
        return true;
    }

    get activatable() {
        if(this.requirements === undefined)
            return true;
        for(let requirement of this.requirements) {
            if(requirement.type == "current_job") {
                if(!this.manager.party.all.some(member => !member.dead && ((member.combatJob !== undefined && member.combatJob.id === requirement.job) || (member.passiveJob !== undefined && member.passiveJob.id === requirement.job))))
                    return false;
            }
        }
        return true;
    }
}