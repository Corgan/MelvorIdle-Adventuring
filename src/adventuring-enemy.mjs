const { loadModule } = mod.getContext(import.meta);

const { AdventuringCharacter, AdventuringCharacterRenderQueue } = await loadModule('src/adventuring-character.mjs');

class AdventuringEnemyRenderQueue extends AdventuringCharacterRenderQueue {
    constructor() {
        super(...arguments);
    }
}

export class AdventuringEnemy extends AdventuringCharacter {
    constructor(manager, game, party) {
        super(manager, game, party);
        this.name = "";
        this.media = cdnMedia('assets/media/main/question.svg');

        this.renderQueue = new AdventuringEnemyRenderQueue();
    }

    setMonster(monsterId, spawned=true) {
        let monster = this.manager.monsters.getObjectByID(monsterId);

        this.base = monsterId;

        this.media = monster.media;
        this.renderQueue.icon = true;
        this.card.setIcon(this.media);

        this.name = monster.name;
        this.renderQueue.name = true;
        this.card.setName(this.name);

        monster.stats.forEach(({ id, value }) => {
            this.stats.set(id, value);
        })
        
        this.stats.renderQueue.stats = true;

        this.xp = monster.xp;
        
        this.setGenerator(this.manager.generators.getObjectByID(monster.generator));

        this.setSpender(this.manager.spenders.getObjectByID(monster.spender));

        if(spawned) {
            this.hitpoints = this.maxHitpoints;
            this.renderQueue.hitpoints = true;

            this.energy = 0;
            this.renderQueue.energy = true;

            this.dead = false;

            this.component.splash.queue = [];
        }
    }

    onDeath() {
        super.onDeath();
        if(this.xp) {
            this.manager.addXP(this.xp);
            this.manager.party.all.filter(member => !member.dead).forEach(member => {
                if(member.combatJob.isMilestoneReward) {
                    this.manager.log.add(`${member.name} gains ${this.xp} ${member.combatJob.name} xp`);
                    this.manager.addMasteryXP(member.combatJob, this.xp);
                    this.manager.addMasteryPoolXP(this.xp);
                }
            });
        }
    }
    
    render() {
        super.render();
    }
    
    encode(writer) {
        super.encode(writer);
        writer.writeBoolean(this.base !== undefined);
        if (this.base !== undefined)
            writer.writeString(this.base);
        return writer;
    }

    decode(reader, version) {
        super.decode(reader, version);
        if (reader.getBoolean()) {
            const base = reader.getString();
            this.setMonster(base, false);
        }
    }
}