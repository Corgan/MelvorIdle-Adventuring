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
        
        // Listen for monster kills via conductor
        this.manager.conductor.listen('monster_killed', (type, context) => {
            if (context.monster) {
                this._onMonsterKilled(context.monster);
            }
        });
    }

    onShow() {
        this.manager.party.setAllLocked(this.manager.isActive);

        this.markAllViewed();
    }

    onHide() {
        this.manager.party.setAllLocked(this.manager.isActive);
    }

    markViewed(monster) {
        if(typeof monster === "string")
            monster = this.manager.monsters.getObjectByID(monster);
        if(this.seen.get(monster) && !this.viewed.get(monster)) {
            this.viewed.set(monster, true);
            monster.renderQueue.updateAll();
        }
    }

    markAllViewed() {
        this.seen.forEach((seen, monster) => {
            if(seen && !this.viewed.get(monster)) {
                this.viewed.set(monster, true);
                monster.renderQueue.updateAll();
            }
        });
    }

    isNew(monster) {
        return this.seen.get(monster) === true && this.viewed.get(monster) !== true;
    }

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

        if(wasNew && wasEmpty) {
            this.manager.conductor.trigger('monster_seen', { monster, isFirst: true });
        }
    }

    /**
     * Called via conductor when a monster is killed.
     * @param {Object} monster - The monster that was killed
     */
    _onMonsterKilled(monster) {
        if(typeof monster === "string")
            monster = this.manager.monsters.getObjectByID(monster);

        const currentKills = this.killCounts.get(monster) || 0;
        const newKills = currentKills + 1;
        this.killCounts.set(monster, newKills);

        monster.renderQueue.updateAll();

        if(this.manager.encounter && this.manager.encounter.party) {
            this.manager.encounter.party.all.forEach(enemy => {
                if(enemy.base === monster) {
                    enemy.renderQueue.iconTooltip = true;
                }
            });
        }

        if(this.manager.monsterdetails && this.manager.monsterdetails.monster === monster) {
            this.manager.monsterdetails.renderQueue.mastery = true;
        }
    }

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
        const seenMonsters = [...this.seen.entries()].filter(([_, v]) => v).map(([k]) => k);
        writer.writeUint32(seenMonsters.length);
        for (const monster of seenMonsters) {
            writer.writeNamespacedObject(monster);
        }

        const nonZeroKills = [...this.killCounts.entries()].filter(([_, count]) => count > 0);
        writer.writeUint32(nonZeroKills.length);
        for (const [monster, count] of nonZeroKills) {
            writer.writeNamespacedObject(monster);
            writer.writeUint32(count);
        }

        const viewedMonsters = [...this.viewed.entries()].filter(([_, v]) => v).map(([k]) => k);
        writer.writeUint32(viewedMonsters.length);
        for (const monster of viewedMonsters) {
            writer.writeNamespacedObject(monster);
        }
        return writer;
    }

    decode(reader, version) {
        const numSeen = reader.getUint32();
        for (let i = 0; i < numSeen; i++) {
            const key = reader.getNamespacedObject(this.manager.monsters);
            if (typeof key !== "string") {
                this.seen.set(key, true);
            }
        }

        const numKills = reader.getUint32();
        for (let i = 0; i < numKills; i++) {
            const key = reader.getNamespacedObject(this.manager.monsters);
            const value = reader.getUint32();
            if (typeof key !== "string") {
                this.killCounts.set(key, value);
            }
        }

        const numViewed = reader.getUint32();
        for (let i = 0; i < numViewed; i++) {
            const key = reader.getNamespacedObject(this.manager.monsters);
            if (typeof key !== "string") {
                this.viewed.set(key, true);
            }
        }
    }
}