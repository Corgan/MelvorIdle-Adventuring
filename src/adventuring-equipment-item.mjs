const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');

export class AdventuringEquipmentItem {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.stats = new AdventuringStats(this.manager, this.game);
    }

    get tooltip() {
        let html = '<div>'
        html += `<div><span>${this.name}</span></div>`
        this.stats.forEach((value, stat) => {
            let statImg = `<img class="skill-icon-xxs" style="height: .66rem; width: .66rem; margin-top: 0;" src="${stat.media}">`
            html += `<div><small>+${value}${statImg}</small></div>`;
        });

        html += `</br><div><small>${this.type.name}</small></div>`;

        let validJobs = this.jobs.filter(job => job.id !== "adventuring:none");
        if(validJobs.length > 0) {
            html += `<div><small>Usable By: `;
            let jobList = validJobs.map(job => job.name).join(', ');
            if(this.jobs.length == this.manager.jobs.size)
                jobList = "Any";
            html += `${jobList}</small></div>`;
        }
        html += '</div>'
        return html;
    }

    get name() {
        let name = "";
        if(this.base !== undefined) {
            name = this.base.name;
            if(this.suffix !== undefined) {
                name += ' ' + this.suffix.name;
            }
        }
        return name;
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
            writer.writeBoolean(this.suffix !== undefined)
            if(this.suffix !== undefined)
                writer.writeNamespacedObject(this.suffix);

            writer.writeComplexMap(this.stats, (key, value, writer) => {
                writer.writeNamespacedObject(key);
                writer.writeUint8(value);
            });
        }
    }

    decode(reader, version) {
        if(reader.getBoolean()) {
            this.base = reader.getNamespacedObject(this.manager.baseItems);
            if(reader.getBoolean())
                this.suffix = reader.getNamespacedObject(this.manager.suffixes);
            
            this.stats = reader.getComplexMap((reader) => {
                let key = reader.getNamespacedObject(this.manager.stats);
                let value = reader.getUint8();
                return { key, value };
            });
        }
    }
}

// Prefix
// Suffix
