const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');

const { AdventuringCrossroadsElement } = await loadModule('src/dungeon/components/adventuring-crossroads.mjs');

export class AdventuringCrossroads extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-crossroads');

        this.areas = [];
    }

    get active() {
        if(this.manager.dungeon.active)
            return true;
        return super.active;
    }

    onLoad() {
        super.onLoad();
    }

    onShow() {
        this.manager.party.setAllLocked(false);
        this.areas.forEach(area => {
            area.renderQueue.autoRepeat = true;
        });
    }

    onHide() {
        this.manager.party.setAllLocked(true);
    }

    postDataRegistration() {
        this.areas = [...this.manager.areas.allObjects].sort((a, b) => {
            return a.getUnlockLevel() - b.getUnlockLevel();
        });

        this.areas.forEach(area => {
            area.component.mount(this.component.areas);
        });
    }

    render() {
        this.areas.forEach(area => area.render());
    }

    encode(writer) {
        writer.writeUint16(this.areas.length);
        this.areas.forEach(area => {
            writer.writeNamespacedObject(area);
            const difficulty = area.selectedDifficulty;
            writer.writeBoolean(difficulty !== null);
            if(difficulty !== null) {
                writer.writeNamespacedObject(difficulty);
            }
            writer.writeUint16(area.bestEndlessStreak);
        });
        writer.writeBoolean(this.manager.autoRepeatArea !== null);
        if(this.manager.autoRepeatArea !== null) {
            writer.writeNamespacedObject(this.manager.autoRepeatArea);
        }
        return writer;
    }

    decode(reader, version) {
        const areaCount = reader.getUint16();
        for(let i = 0; i < areaCount; i++) {
            const area = reader.getNamespacedObject(this.manager.areas);
            const hasDifficulty = reader.getBoolean();
            let difficulty = null;
            if(hasDifficulty) {
                difficulty = reader.getNamespacedObject(this.manager.difficulties);
            }
            const bestStreak = reader.getUint16();
            if(typeof area !== "string") {
                if(typeof difficulty !== "string" && difficulty !== null) {
                    area.selectedDifficulty = difficulty;
                }
                area.bestEndlessStreak = bestStreak;
            }
        }
        const hasAutoRepeat = reader.getBoolean();
        if(hasAutoRepeat) {
            const autoRepeatArea = reader.getNamespacedObject(this.manager.areas);
            if(typeof autoRepeatArea !== "string") {
                this.manager.autoRepeatArea = autoRepeatArea;
            }
        }
    }
}