const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');

const { AdventuringBestiaryElement } = await loadModule('src/entities/components/adventuring-bestiary.mjs');

export class AdventuringBestiary extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-bestiary');
        this.seen = new Map();
        this.viewed = new Map();  // Track if monster has been viewed in UI
        this.killCounts = new Map();

        this.monsters = [];
    }

    onLoad() {
        super.onLoad();
    }

    onShow() {
        this.manager.party.setAllLocked(this.manager.isActive);
        // Mark all visible seen monsters as viewed
        this.markAllViewed();
    }

    onHide() {
        this.manager.party.setAllLocked(this.manager.isActive);
    }

    /**
     * Mark a monster as viewed in the UI (removes NEW badge)
     */
    markViewed(monster) {
        if(typeof monster === "string")
            monster = this.manager.monsters.getObjectByID(monster);
        if(this.seen.get(monster) && !this.viewed.get(monster)) {
            this.viewed.set(monster, true);
            monster.renderQueue.updateAll();
        }
    }

    /**
     * Mark all seen monsters as viewed
     */
    markAllViewed() {
        this.seen.forEach((seen, monster) => {
            if(seen && !this.viewed.get(monster)) {
                this.viewed.set(monster, true);
                monster.renderQueue.updateAll();
            }
        });
    }

    /**
     * Check if a monster is new (seen but not viewed)
     */
    isNew(monster) {
        return this.seen.get(monster) === true && this.viewed.get(monster) !== true;
    }

    /**
     * Count how many monsters are new
     */
    getNewCount() {
        let count = 0;
        this.seen.forEach((seen, monster) => {
            if(seen && !this.viewed.get(monster)) count++;
        });
        return count;
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
        
        const wasNew = !this.seen.has(monster) || !this.seen.get(monster);
        const wasEmpty = this.seen.size === 0;
        this.seen.set(monster, true);

        monster.renderQueue.updateAll();

        // Track unique monster discovery for achievements
        if(wasNew && this.manager.achievementManager) {
            this.manager.achievementManager.recordUniqueMonster();
        }

        // Trigger bestiary tutorial on first monster discovery
        if(wasEmpty) {
            this.manager.tutorialManager.checkTriggers('event', { event: 'firstMonsterSeen' });
        }
    }

    /**
     * Record a monster kill
     */
    registerKill(monster) {
        if(typeof monster === "string")
            monster = this.manager.monsters.getObjectByID(monster);
        
        const currentKills = this.killCounts.get(monster) || 0;
        const newKills = currentKills + 1;
        this.killCounts.set(monster, newKills);

        monster.renderQueue.updateAll();

        // Track for achievements
        if(this.manager.achievementManager) {
            this.manager.achievementManager.recordKill(monster);
        }
    }

    /**
     * Get the kill count for a monster
     */
    getKillCount(monster) {
        if(typeof monster === "string")
            monster = this.manager.monsters.getObjectByID(monster);
        return this.killCounts.get(monster) || 0;
    }

    reset() {
        this.seen.clear();
        this.viewed.clear();
        this.killCounts.clear();
        this.monsters.forEach(monster => {
            monster.renderQueue.updateAll();
        });
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
        writer.writeComplexMap(this.killCounts, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeUint32(value);
        });
        writer.writeComplexMap(this.viewed, (key, value, writer) => {
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
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.manager.monsters);
            let value = reader.getUint32();
            if(typeof key !== "string")
                this.killCounts.set(key, value);
        });
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.manager.monsters);
            let value = reader.getBoolean();
            if(typeof key !== "string")
                this.viewed.set(key, value);
        });
    }
}