const { loadModule } = mod.getContext(import.meta);


const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringEquipment } = await loadModule('src/adventuring-equipment.mjs');
const { AdventuringStashUIComponent } = await loadModule('src/components/adventuring-stash.mjs');

export class AdventuringStash extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.materialCounts = new Map();
        this.unlocked = new Map();

        this.component = new AdventuringStashUIComponent(this.manager, this.game, this);
    }

    onLoad() {
        super.onLoad();
    }

    onShow() {
        this.manager.party.all.forEach(member => member.setLocked(this.manager.isActive));
    }

    onHide() {
        this.manager.party.all.forEach(member => member.setLocked(this.manager.isActive));
    }

    postDataRegistration() {
        this.manager.materials.forEach(material => {
            this.materialCounts.set(material, 0);
            material.component.mount(this.component.materials);
        });
    }

    unlock(item) {
        this.unlocked.set(item, true);
        item.renderQueue.updateAll();
        this.manager.armory.checkUnlocked();
    }

    add(material, qty) {
        if(typeof material === "string")
            material = this.manager.materials.getObjectByID(material);
        let count = this.materialCounts.get(material);
        if(count !== undefined) {
            if(!material.unlocked)
                this.unlock(material);
            this.materialCounts.set(material, count + qty);
            material.renderQueue.name = true;
            material.renderQueue.icon = true;
            material.renderQueue.count = true;
            this.manager.log.add(`Found ${qty} ${material.name}`);
        }
    }

    remove(material, qty) {
        if(typeof material === "string")
            material = this.manager.materials.getObjectByID(material);
        let count = this.materialCounts.get(material);
        if(count !== undefined) {
            let amount = Math.max(0, count - qty);
            this.materialCounts.set(material, amount);
            material.renderQueue.count = true;
        }
    }

    render() {
        this.materialCounts.forEach((count, material) => material.render());
    }

    encode(writer) {
        writer.writeComplexMap(this.materialCounts, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeUint32(value);
        });
        writer.writeComplexMap(this.unlocked, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeBoolean(value);
        });

        return writer;
    }

    decode(reader, version) {
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.manager.materials);
            let value = reader.getUint32();
            if(typeof key !== "string") {
                this.materialCounts.set(key, value);
            }
        });
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.manager.materials);
            let value = reader.getBoolean();
            if(typeof key !== "string" && key.id !== "adventuring:none")
                this.unlocked.set(key, value);
        });
    }
}