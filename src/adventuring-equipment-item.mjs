const { loadModule } = mod.getContext(import.meta);

export class AdventuringEquipmentItem {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.name = "";
        this.levels = new Map();
    }

    get tooltip() {
        let html = '<div>'
        html += `<div><span>${this.name}</span></div>`
        this.levels.forEach((level, skill) => {
            html += `<div><small>${skill} => ${level}</small></div>`;
        });
        html += '</div>'
        return html;
    }

    get media() {
        return this.base !== undefined ? this.base.media : cdnMedia("assets/media/main/question.svg");
    }

    get type() {
        if(this.base !== undefined) {
            let type = this.manager.itemTypes.getObjectByID(this.base.type);
            return type
        }
        return false;
    }

    get jobs() {
        let jobs = [];
        if(this.base !== undefined)
            jobs = this.base.jobs;
        return jobs;
    }

    get slots() {
        let slots = [];
        if(this.base !== undefined)
            slots = this.base.slots;
        return slots;
    }

    get occupies() {
        let occupies = [];
        if(this.base !== undefined)
            occupies = this.base.occupies;
        return occupies;
    }

    get pairs() {
        let pairs = [];
        if(this.base !== undefined)
            pairs = this.base.pairs;
        return pairs;
    }

    encode(writer) {
        writer.writeBoolean(this.base !== undefined)
        if(this.base !== undefined) {
            writer.writeNamespacedObject(this.base);
            writer.writeString(this.name);
            writer.writeComplexMap(this.levels, (key, value, writer) => {
                writer.writeString(key);
                writer.writeUint32(value);
            });
        }
    }

    decode(reader, version) {
        if(reader.getBoolean()) {
            this.base = reader.getNamespacedObject(this.manager.baseItems);
            this.name = reader.getString();
            this.levels = reader.getComplexMap((reader) => {
                let key = reader.getString();
                let value = reader.getUint32();
                return { key, value };
            });
        }
    }
}

// Prefix
// Suffix
