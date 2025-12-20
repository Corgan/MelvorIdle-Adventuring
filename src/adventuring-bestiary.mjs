const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringBestiaryElement } = await loadModule('src/components/adventuring-bestiary.mjs');

export class AdventuringBestiary extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-bestiary');
        this.seen = new Map();

        this.monsters = [];
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
        this.monsters = this.manager.monsters.allObjects;

        this.monsters.forEach(monster => {
            monster.component.mount(this.component.monsters);
        });
    }

    registerSeen(monster) {
        if(typeof monster === "string")
            monster = this.manager.monsters.getObjectByID(monster);
        this.seen.set(monster, true);

        monster.renderQueue.updateAll();
    }

    render() {
        this.monsters.forEach(monster => {
            monster.render();
        });
    }

    encode(writer) {
        writer.writeComplexMap(this.seen, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeBoolean(value);
        });
        return writer;
    }

    decode(reader, version) {
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.manager.monsters);
            let value = reader.getBoolean();
            if(typeof key !== "string")
                this.seen.set(key, value);
        });
    }
}