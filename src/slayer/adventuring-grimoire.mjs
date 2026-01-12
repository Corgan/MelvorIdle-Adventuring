
export class AdventuringGrimoire {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;

        this.learnedAbilities = new Set();

        this.baseLearnChance = 0.5;
    }

    tryLearn(hero, enemy, learnType, learnBonus = 0) {
        if(!enemy || !enemy.base) return null;

        const ability = learnType === 'generator' ? enemy.generator : enemy.spender;
        if(!ability || !ability.isEnemy) return null;

        if(this.learnedAbilities.has(ability.id)) return null;

        const chance = this.baseLearnChance * (1 + learnBonus / 100);
        if(Math.random() * 100 > chance) return null;

        this.learnedAbilities.add(ability.id);

        this.manager.achievementManager.markDirty();

        this.manager.log.add(`${hero.name} learned ${ability.name}!`);
        if(typeof notifyPlayer === 'function' && !loadingOfflineProgress) {
            notifyPlayer(this.manager, `Learned: ${ability.name}!`, 'success');
        }

        return ability;
    }

    hasLearned(abilityId) {
        return this.learnedAbilities.has(abilityId);
    }

    getLearnedForArea(area, type) {
        const abilitySet = new Set();
        const abilities = [];
        const monsters = area.monsters || [];
        const abilityKey = type === 'generator' ? 'generator' : 'spender';
        const registry = type === 'generator' ? this.manager.generators : this.manager.spenders;

        for(const monster of monsters) {
            const abilityId = monster[abilityKey];
            if(abilityId && this.learnedAbilities.has(abilityId) && !abilitySet.has(abilityId)) {
                abilitySet.add(abilityId);
                const ability = registry.getObjectByID(abilityId);
                if(ability) abilities.push(ability);
            }
        }

        return abilities;
    }

    getLearnedCountForArea(area) {
        const generators = this.getLearnedForArea(area, 'generator');
        const spenders = this.getLearnedForArea(area, 'spender');
        return generators.length + spenders.length;
    }

    resetAll() {
        this.learnedAbilities.clear();
    }

    encode(writer) {
        writer.writeUint32(this.learnedAbilities.size);
        for(const abilityId of this.learnedAbilities) {
            const ability = this.manager.getAbilityByID(abilityId);
            writer.writeNamespacedObject(ability);
        }
        return writer;
    }

    decode(reader, version) {
        const count = reader.getUint32();
        for(let i = 0; i < count; i++) {
            let ability = reader.getNamespacedObject(this.manager.generators);
            if (typeof ability === 'string') {
                ability = this.manager.spenders.getObjectByID(ability);
            }
            if (ability && typeof ability !== 'string') {
                this.learnedAbilities.add(ability.id);
            }
        }
    }
}
