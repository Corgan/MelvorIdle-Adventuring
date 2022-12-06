const { loadModule } = mod.getContext(import.meta);

const { AdventuringCharacter, AdventuringCharacterRenderQueue } = await loadModule('src/adventuring-character.mjs');

class AdventuringEnemyRenderQueue extends AdventuringCharacterRenderQueue {
    constructor() {
        super(...arguments);
        this.card = false;
    }

    updateAll() {
        super.updateAll();
        this.card = true;
    }
}

export class AdventuringEnemy extends AdventuringCharacter {
    constructor(manager, game, party) {
        super(manager, game, party);

        this.renderQueue = new AdventuringEnemyRenderQueue();
    }

    setMonster(monster, spawned=true) {
        if(typeof monster === "string")
            monster = this.manager.monsters.getObjectByID(monster);

        this.base = monster;
        this.renderQueue.name = true;
        this.renderQueue.icon = true;

        monster.stats.forEach(({ id, value }) => {
            this.stats.set(id, value);
        })
        this.stats.renderQueue.stats = true;

        this.xp = monster.xp;
        
        this.setGenerator(this.manager.generators.getObjectByID(monster.generator));

        this.setSpender(this.manager.spenders.getObjectByID(monster.spender));

        if(spawned) {
            this.manager.bestiary.registerSeen(this.base);
            this.renderQueue.name = true;
            this.renderQueue.icon = true;
            
            this.hitpoints = this.maxHitpoints;
            this.renderQueue.hitpoints = true;

            this.energy = 0;
            this.renderQueue.energy = true;

            this.dead = false;

            this.component.splash.queue = [];
        }
    }

    get name() {
        return this.base !== undefined ? this.base.name : "???";
    }

    get media() {
        return this.base !== undefined ? this.base.media : this.getMediaURL('melvor:assets/media/main/question.svg');
    }

    onDeath() {
        super.onDeath();
        if(this.xp) {
            this.manager.addXP(this.xp);

            this.manager.party.all.filter(member => !member.dead).forEach(member => {
                let xp = this.manager.encounter.currentTurn === member ? this.xp : Math.floor(this.xp * 0.5);

                if(member.combatJob.isMilestoneReward)
                    member.combatJob.addXP(xp);

                member.equipment.slots.forEach((equipmentSlot, slotType) => {
                    if(!equipmentSlot.empty && !equipmentSlot.occupied) {
                        equipmentSlot.item.addXP(xp);
                    }
                });
            });

            this.manager.dungeon.area.addXP(this.xp);

            this.base.addXP(this.xp);

            let { id, qty } = this.base.lootGenerator.getEntry();
            this.manager.stash.add(id, qty);
        }
    }
    
    render() {
        super.render();
    }
    
    encode(writer) {
        super.encode(writer);
        writer.writeBoolean(this.base !== undefined);
        if (this.base !== undefined)
            writer.writeNamespacedObject(this.base);
        return writer;
    }

    decode(reader, version) {
        super.decode(reader, version);
        if (reader.getBoolean()) {
            const base = reader.getNamespacedObject(this.manager.monsters);
            this.setMonster(base, false);
        }
    }
}