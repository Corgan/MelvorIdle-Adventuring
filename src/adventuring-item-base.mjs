const { loadModule } = mod.getContext(import.meta);

export class AdventuringItemBase extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.name = data.name;
        this._media = data.media;

        this.type = data.type;
        this.tier = data.tier;
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    get jobs() {
        let jobs = this.manager.jobs.allObjects.filter(job => job.allowedItems !== undefined && job.allowedItems.includes(this.type));
        return jobs;
    }

    get slots() {
        let slots = [];
        let type = this.manager.itemTypes.getObjectByID(this.type);
        if(type.slots !== undefined)
            slots = type.slots.map(slotType => this.manager.itemSlots.getObjectByID(slotType));;
        return slots;
    }

    get occupies() {
        let occupies = [];
        let type = this.manager.itemTypes.getObjectByID(this.type);
        if(type.occupies !== undefined)
            occupies = type.occupies.map(slotType => this.manager.itemSlots.getObjectByID(slotType));
        return occupies;
    }

    get pairs() {
        let pairs = [];
        let type = this.manager.itemTypes.getObjectByID(this.type);
        if(type.pairs !== undefined)
            pairs = type.pairs.map(pair => this.manager.itemTypes.getObjectByID(pair))
        return pairs;
    }
}