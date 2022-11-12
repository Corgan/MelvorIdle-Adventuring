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

    get validSlots() {
        let valid = [];
        if(this.base !== undefined) {
            valid = this.base.validSlots;

            if(this.base.validSlots.includes("Quiver") && this.base.occupiesSlots.includes("Weapon"))
                valid = valid.map(slot => slot == "Quiver" ? "Weapon" : slot);
        }
        return valid;
    }

    get occupiesSlots() {
        let occupies = [];
        if(this.base !== undefined) {
            occupies = this.base.occupiesSlots;

            if(this.base.validSlots.includes("Quiver") && this.base.occupiesSlots.includes("Weapon"))
                occupies = occupies.filter(slot => slot != "Weapon")
        }
        return occupies;
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
            this.base = reader.getNamespacedObject(this.game.items.equipment);
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
