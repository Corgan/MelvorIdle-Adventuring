/**
 * Grimoire - Tracks learned enemy abilities for the Slayer job.
 * 
 * Simple Set of learned ability IDs.
 * Uses monster → area reverse lookup for area-based filtering.
 * UI is rendered in the ability selector tooltip with area drill-down.
 */
export class AdventuringGrimoire {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        
        // Set of learned ability IDs
        this.learnedAbilities = new Set();
        
        // Base learn chance (0.5% = 1 in 200 on average)
        this.baseLearnChance = 0.5;
    }
    
    /**
     * Attempt to learn an ability from an enemy.
     */
    tryLearn(hero, enemy, learnType, learnBonus = 0) {
        if(!enemy?.base) return null;
        
        const ability = learnType === 'generator' ? enemy.generator : enemy.spender;
        if(!ability?.isEnemy) return null;
        
        // Already learned?
        if(this.learnedAbilities.has(ability.id)) return null;
        
        // Roll to learn
        const chance = this.baseLearnChance * (1 + learnBonus / 100);
        if(Math.random() * 100 > chance) return null;
        
        // Learn it
        this.learnedAbilities.add(ability.id);
        
        // Notify
        this.manager.log.add(`${hero.name} learned ${ability.name}!`);
        if(typeof notifyPlayer === 'function') {
            notifyPlayer(this.manager, `Learned: ${ability.name}!`, 'success');
        }
        
        return ability;
    }
    
    /**
     * Check if an ability has been learned.
     */
    hasLearned(abilityId) {
        return this.learnedAbilities.has(abilityId);
    }
    
    /**
     * Get learned abilities for an area by type.
     * Uses monster → ability reverse lookup, deduplicates.
     */
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
    
    /**
     * Count learned abilities for an area (both types).
     */
    getLearnedCountForArea(area) {
        const generators = this.getLearnedForArea(area, 'generator');
        const spenders = this.getLearnedForArea(area, 'spender');
        return generators.length + spenders.length;
    }
    
    encode(writer) {
        writer.writeUint32(this.learnedAbilities.size);
        for(const abilityId of this.learnedAbilities) {
            writer.writeString(abilityId);
        }
        return writer;
    }
    
    decode(reader, version) {
        const count = reader.getUint32();
        for(let i = 0; i < count; i++) {
            const abilityId = reader.getString();
            this.learnedAbilities.add(abilityId);
        }
    }
}
