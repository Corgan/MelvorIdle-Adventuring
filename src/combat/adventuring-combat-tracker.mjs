const { loadModule } = mod.getContext(import.meta);

/**
 * Per-hero combat statistics
 */
class HeroStats {
    constructor() {
        this.damageDealt = 0;
        this.damageTaken = 0;
        this.damageBlocked = 0;
        this.healing = 0;
        this.highestHit = 0;
        this.abilityUses = new Map();  // Map<Ability, count>
    }

    clone() {
        const cloned = new HeroStats();
        cloned.damageDealt = this.damageDealt;
        cloned.damageTaken = this.damageTaken;
        cloned.damageBlocked = this.damageBlocked;
        cloned.healing = this.healing;
        cloned.highestHit = this.highestHit;
        cloned.abilityUses = new Map(this.abilityUses);
        return cloned;
    }
}

/**
 * Per-monster combat statistics
 */
class MonsterStats {
    constructor() {
        this.damageDealt = 0;  // Damage dealt TO this monster
        this.damageTaken = 0;  // Damage taken FROM this monster
        this.highestHit = 0;   // Highest hit dealt TO this monster
    }

    clone() {
        const cloned = new MonsterStats();
        cloned.damageDealt = this.damageDealt;
        cloned.damageTaken = this.damageTaken;
        cloned.highestHit = this.highestHit;
        return cloned;
    }
}

/**
 * Per-ability usage statistics
 */
class AbilityStats {
    constructor() {
        this.uses = 0;
        this.damage = 0;
        this.healing = 0;
        this.highestHit = 0;
    }

    clone() {
        const cloned = new AbilityStats();
        cloned.uses = this.uses;
        cloned.damage = this.damage;
        cloned.healing = this.healing;
        cloned.highestHit = this.highestHit;
        return cloned;
    }
}

/**
 * Stats tracked during a single encounter (one fight).
 * Stores per-entity breakdowns; totals are computed via getters.
 */
export class EncounterStats {
    constructor(manager) {
        this.manager = manager;
        this.reset();
    }

    reset() {
        this.turnsElapsed = 0;
        this.tileType = 'encounter'; // 'encounter', 'boss', 'exit', 'special'
        
        // Per-entity tracking
        this.byHero = new Map();      // Map<Hero, HeroStats>
        this.byMonster = new Map();   // Map<Monster (base), MonsterStats>
        this.byAbility = new Map();   // Map<Ability, AbilityStats>
    }

    // ============ Computed Totals (getters) ============

    get damageDealt() {
        let total = 0;
        for (const stats of this.byHero.values()) {
            total += stats.damageDealt;
        }
        return total;
    }

    get damageTaken() {
        let total = 0;
        for (const stats of this.byHero.values()) {
            total += stats.damageTaken;
        }
        return total;
    }

    get damageBlocked() {
        let total = 0;
        for (const stats of this.byHero.values()) {
            total += stats.damageBlocked;
        }
        return total;
    }

    get healingReceived() {
        let total = 0;
        for (const stats of this.byHero.values()) {
            total += stats.healing;
        }
        return total;
    }

    get highestSingleHit() {
        let max = 0;
        for (const stats of this.byHero.values()) {
            if (stats.highestHit > max) max = stats.highestHit;
        }
        return max;
    }

    get abilitiesUsed() {
        return new Set(this.byAbility.keys());
    }

    // ============ Helper Methods ============

    _getHeroStats(hero) {
        if (!this.byHero.has(hero)) {
            this.byHero.set(hero, new HeroStats());
        }
        return this.byHero.get(hero);
    }

    _getMonsterStats(monster) {
        const base = monster?.base || monster;
        if (!base) return null;
        if (!this.byMonster.has(base)) {
            this.byMonster.set(base, new MonsterStats());
        }
        return this.byMonster.get(base);
    }

    _getAbilityStats(ability) {
        if (!ability) return null;
        if (!this.byAbility.has(ability)) {
            this.byAbility.set(ability, new AbilityStats());
        }
        return this.byAbility.get(ability);
    }

    /**
     * Clone this stats object (for history)
     * @returns {EncounterStats}
     */
    clone() {
        const cloned = new EncounterStats(this.manager);
        cloned.turnsElapsed = this.turnsElapsed;
        cloned.tileType = this.tileType;
        
        for (const [hero, stats] of this.byHero) {
            cloned.byHero.set(hero, stats.clone());
        }
        for (const [monster, stats] of this.byMonster) {
            cloned.byMonster.set(monster, stats.clone());
        }
        for (const [ability, stats] of this.byAbility) {
            cloned.byAbility.set(ability, stats.clone());
        }
        
        return cloned;
    }

    // ============ Serialization ============

    encode(writer) {
        writer.writeUint32(this.turnsElapsed);

        // Encode byHero - use hero index in party as key since heroes aren't namespaced
        const heroEntries = [...this.byHero.entries()];
        writer.writeUint8(heroEntries.length);
        for (const [hero, stats] of heroEntries) {
            // Write hero position index (0-3) as identifier
            const heroIndex = this.manager.party?.all?.indexOf(hero) ?? -1;
            writer.writeInt8(heroIndex);
            writer.writeFloat64(stats.damageDealt);
            writer.writeFloat64(stats.damageTaken);
            writer.writeFloat64(stats.damageBlocked);
            writer.writeFloat64(stats.healing);
            writer.writeFloat64(stats.highestHit);
            
            // Encode ability uses
            const abilityEntries = [...stats.abilityUses.entries()];
            writer.writeUint16(abilityEntries.length);
            for (const [ability, count] of abilityEntries) {
                writer.writeNamespacedObject(ability);
                writer.writeUint32(count);
            }
        }

        // Encode byMonster
        const monsterEntries = [...this.byMonster.entries()];
        writer.writeUint16(monsterEntries.length);
        for (const [monster, stats] of monsterEntries) {
            writer.writeNamespacedObject(monster);
            writer.writeFloat64(stats.damageDealt);
            writer.writeFloat64(stats.damageTaken);
            writer.writeFloat64(stats.highestHit);
        }

        // Encode byAbility
        const abilityEntries = [...this.byAbility.entries()];
        writer.writeUint16(abilityEntries.length);
        for (const [ability, stats] of abilityEntries) {
            writer.writeNamespacedObject(ability);
            writer.writeUint32(stats.uses);
            writer.writeFloat64(stats.damage);
            writer.writeFloat64(stats.healing);
            writer.writeFloat64(stats.highestHit);
        }
    }

    decode(reader, version) {
        this.turnsElapsed = reader.getUint32();

        // Decode byHero
        this.byHero = new Map();
        const heroCount = reader.getUint8();
        for (let i = 0; i < heroCount; i++) {
            const heroIndex = reader.getInt8();
            const stats = new HeroStats();
            stats.damageDealt = reader.getFloat64();
            stats.damageTaken = reader.getFloat64();
            stats.damageBlocked = reader.getFloat64();
            stats.healing = reader.getFloat64();
            stats.highestHit = reader.getFloat64();
            
            // Decode ability uses
            const abilityCount = reader.getUint16();
            for (let j = 0; j < abilityCount; j++) {
                const ability = reader.getNamespacedObject(this.manager.abilities);
                const count = reader.getUint32();
                if (ability && typeof ability !== 'string') {
                    stats.abilityUses.set(ability, count);
                }
            }

            // Resolve hero from index after party is loaded
            if (heroIndex >= 0 && this.manager.party?.all?.[heroIndex]) {
                this.byHero.set(this.manager.party.all[heroIndex], stats);
            }
        }

        // Decode byMonster
        this.byMonster = new Map();
        const monsterCount = reader.getUint16();
        for (let i = 0; i < monsterCount; i++) {
            const monster = reader.getNamespacedObject(this.manager.monsters);
            const stats = new MonsterStats();
            stats.damageDealt = reader.getFloat64();
            stats.damageTaken = reader.getFloat64();
            stats.highestHit = reader.getFloat64();
            if (monster && typeof monster !== 'string') {
                this.byMonster.set(monster, stats);
            }
        }

        // Decode byAbility
        this.byAbility = new Map();
        const abilityCount = reader.getUint16();
        for (let i = 0; i < abilityCount; i++) {
            const ability = reader.getNamespacedObject(this.manager.abilities);
            const stats = new AbilityStats();
            stats.uses = reader.getUint32();
            stats.damage = reader.getFloat64();
            stats.healing = reader.getFloat64();
            stats.highestHit = reader.getFloat64();
            if (ability && typeof ability !== 'string') {
                this.byAbility.set(ability, stats);
            }
        }
    }
}

/**
 * Stats tracked during an entire run (area attempt).
 * Aggregates encounter stats and maintains history.
 * Stores per-entity breakdowns; totals are computed via getters.
 */
export class RunStats {
    constructor(manager) {
        this.manager = manager;
        this.reset();
    }

    reset() {
        this.turnsElapsed = 0;

        // Accumulated per-entity stats (across all encounters)
        this.byHero = new Map();      // Map<Hero, HeroStats>
        this.byMonster = new Map();   // Map<Monster (base), MonsterStats>
        this.byAbility = new Map();   // Map<Ability, AbilityStats>

        // Encounter history
        this.encounters = [];          // EncounterStats[]

        // Run context (set at run start)
        this.partySize = 0;
        this.equipmentWorn = new Set();  // Set<Equipment> - snapshot at run start
        this.area = null;                 // Area entity
        this.difficulty = null;           // Difficulty entity
    }

    // ============ Computed Totals (getters) ============

    get damageDealt() {
        let total = 0;
        for (const stats of this.byHero.values()) {
            total += stats.damageDealt;
        }
        return total;
    }

    get damageTaken() {
        let total = 0;
        for (const stats of this.byHero.values()) {
            total += stats.damageTaken;
        }
        return total;
    }

    get damageBlocked() {
        let total = 0;
        for (const stats of this.byHero.values()) {
            total += stats.damageBlocked;
        }
        return total;
    }

    get healingReceived() {
        let total = 0;
        for (const stats of this.byHero.values()) {
            total += stats.healing;
        }
        return total;
    }

    get highestSingleHit() {
        let max = 0;
        for (const stats of this.byHero.values()) {
            if (stats.highestHit > max) max = stats.highestHit;
        }
        return max;
    }

    get abilitiesUsed() {
        return new Set(this.byAbility.keys());
    }

    get isSolo() {
        return this.partySize === 1;
    }

    // ============ Context ============

    /**
     * Set run context at the start of a run
     * @param {Object} options - { area, difficulty, party }
     */
    setContext(options) {
        const { area, difficulty, party } = options;
        this.area = area || null;
        this.difficulty = difficulty || null;
        
        if (party) {
            // Count active heroes (those with combat jobs)
            const noneJob = this.manager.cached?.noneJob;
            this.partySize = party.filter(h => h.combatJob && h.combatJob !== noneJob).length;
            
            // Snapshot equipment worn at run start
            this.equipmentWorn = new Set();
            for (const hero of party) {
                if (hero.equipment) {
                    for (const item of hero.equipment.equippedItems) {
                        if (item) {
                            this.equipmentWorn.add(item.base || item);
                        }
                    }
                }
            }
        }
    }

    // ============ Helper Methods ============

    _getHeroStats(hero) {
        if (!this.byHero.has(hero)) {
            this.byHero.set(hero, new HeroStats());
        }
        return this.byHero.get(hero);
    }

    _getMonsterStats(monster) {
        if (!this.byMonster.has(monster)) {
            this.byMonster.set(monster, new MonsterStats());
        }
        return this.byMonster.get(monster);
    }

    _getAbilityStats(ability) {
        if (!this.byAbility.has(ability)) {
            this.byAbility.set(ability, new AbilityStats());
        }
        return this.byAbility.get(ability);
    }

    // ============ Aggregation ============

    /**
     * Aggregate an encounter's stats into this run
     * @param {EncounterStats} encounterStats
     */
    aggregateEncounter(encounterStats) {
        this.turnsElapsed += encounterStats.turnsElapsed;

        // Merge hero stats
        for (const [hero, encStats] of encounterStats.byHero) {
            const runStats = this._getHeroStats(hero);
            runStats.damageDealt += encStats.damageDealt;
            runStats.damageTaken += encStats.damageTaken;
            runStats.damageBlocked += encStats.damageBlocked;
            runStats.healing += encStats.healing;
            if (encStats.highestHit > runStats.highestHit) {
                runStats.highestHit = encStats.highestHit;
            }
            // Merge ability uses
            for (const [ability, count] of encStats.abilityUses) {
                const current = runStats.abilityUses.get(ability) || 0;
                runStats.abilityUses.set(ability, current + count);
            }
        }

        // Merge monster stats
        for (const [monster, encStats] of encounterStats.byMonster) {
            const runStats = this._getMonsterStats(monster);
            runStats.damageDealt += encStats.damageDealt;
            runStats.damageTaken += encStats.damageTaken;
            if (encStats.highestHit > runStats.highestHit) {
                runStats.highestHit = encStats.highestHit;
            }
        }

        // Merge ability stats
        for (const [ability, encStats] of encounterStats.byAbility) {
            const runStats = this._getAbilityStats(ability);
            runStats.uses += encStats.uses;
            runStats.damage += encStats.damage;
            runStats.healing += encStats.healing;
            if (encStats.highestHit > runStats.highestHit) {
                runStats.highestHit = encStats.highestHit;
            }
        }

        // Keep encounter history (clone to preserve state)
        this.encounters.push(encounterStats.clone());
    }

    /**
     * Clone this stats object (for history)
     * @returns {RunStats}
     */
    clone() {
        const cloned = new RunStats(this.manager);
        cloned.turnsElapsed = this.turnsElapsed;
        cloned.partySize = this.partySize;
        cloned.equipmentWorn = new Set(this.equipmentWorn);
        cloned.area = this.area;
        cloned.difficulty = this.difficulty;
        
        for (const [hero, stats] of this.byHero) {
            cloned.byHero.set(hero, stats.clone());
        }
        for (const [monster, stats] of this.byMonster) {
            cloned.byMonster.set(monster, stats.clone());
        }
        for (const [ability, stats] of this.byAbility) {
            cloned.byAbility.set(ability, stats.clone());
        }
        cloned.encounters = this.encounters.map(e => e.clone());
        
        return cloned;
    }

    // ============ Serialization ============

    encode(writer) {
        writer.writeUint32(this.turnsElapsed);
        writer.writeUint8(this.partySize);

        // Encode area and difficulty
        writer.writeBoolean(this.area !== null);
        if (this.area) {
            writer.writeNamespacedObject(this.area);
        }
        writer.writeBoolean(this.difficulty !== null);
        if (this.difficulty) {
            writer.writeNamespacedObject(this.difficulty);
        }

        // Encode byHero
        const heroEntries = [...this.byHero.entries()];
        writer.writeUint8(heroEntries.length);
        for (const [hero, stats] of heroEntries) {
            const heroIndex = this.manager.party?.all?.indexOf(hero) ?? -1;
            writer.writeInt8(heroIndex);
            writer.writeFloat64(stats.damageDealt);
            writer.writeFloat64(stats.damageTaken);
            writer.writeFloat64(stats.damageBlocked);
            writer.writeFloat64(stats.healing);
            writer.writeFloat64(stats.highestHit);
            
            const abilityEntries = [...stats.abilityUses.entries()];
            writer.writeUint16(abilityEntries.length);
            for (const [ability, count] of abilityEntries) {
                writer.writeNamespacedObject(ability);
                writer.writeUint32(count);
            }
        }

        // Encode byMonster
        const monsterEntries = [...this.byMonster.entries()];
        writer.writeUint16(monsterEntries.length);
        for (const [monster, stats] of monsterEntries) {
            writer.writeNamespacedObject(monster);
            writer.writeFloat64(stats.damageDealt);
            writer.writeFloat64(stats.damageTaken);
            writer.writeFloat64(stats.highestHit);
        }

        // Encode byAbility
        const abilityEntries = [...this.byAbility.entries()];
        writer.writeUint16(abilityEntries.length);
        for (const [ability, stats] of abilityEntries) {
            writer.writeNamespacedObject(ability);
            writer.writeUint32(stats.uses);
            writer.writeFloat64(stats.damage);
            writer.writeFloat64(stats.healing);
            writer.writeFloat64(stats.highestHit);
        }

        // Encode equipmentWorn
        writer.writeSet(this.equipmentWorn, (item, w) => {
            w.writeNamespacedObject(item);
        });

        // Encode encounter history
        writer.writeArray(this.encounters, (encounter, w) => {
            encounter.encode(w);
        });
    }

    decode(reader, version) {
        this.turnsElapsed = reader.getUint32();
        this.partySize = reader.getUint8();

        // Decode area and difficulty
        if (reader.getBoolean()) {
            this.area = reader.getNamespacedObject(this.manager.areas);
            if (typeof this.area === 'string') this.area = null;
        }
        if (reader.getBoolean()) {
            this.difficulty = reader.getNamespacedObject(this.manager.difficulties);
            if (typeof this.difficulty === 'string') this.difficulty = null;
        }

        // Decode byHero
        this.byHero = new Map();
        const heroCount = reader.getUint8();
        for (let i = 0; i < heroCount; i++) {
            const heroIndex = reader.getInt8();
            const stats = new HeroStats();
            stats.damageDealt = reader.getFloat64();
            stats.damageTaken = reader.getFloat64();
            stats.damageBlocked = reader.getFloat64();
            stats.healing = reader.getFloat64();
            stats.highestHit = reader.getFloat64();
            
            const abilityCount = reader.getUint16();
            for (let j = 0; j < abilityCount; j++) {
                const ability = reader.getNamespacedObject(this.manager.abilities);
                const count = reader.getUint32();
                if (ability && typeof ability !== 'string') {
                    stats.abilityUses.set(ability, count);
                }
            }

            if (heroIndex >= 0 && this.manager.party?.all?.[heroIndex]) {
                this.byHero.set(this.manager.party.all[heroIndex], stats);
            }
        }

        // Decode byMonster
        this.byMonster = new Map();
        const monsterCount = reader.getUint16();
        for (let i = 0; i < monsterCount; i++) {
            const monster = reader.getNamespacedObject(this.manager.monsters);
            const stats = new MonsterStats();
            stats.damageDealt = reader.getFloat64();
            stats.damageTaken = reader.getFloat64();
            stats.highestHit = reader.getFloat64();
            if (monster && typeof monster !== 'string') {
                this.byMonster.set(monster, stats);
            }
        }

        // Decode byAbility
        this.byAbility = new Map();
        const abilityCount = reader.getUint16();
        for (let i = 0; i < abilityCount; i++) {
            const ability = reader.getNamespacedObject(this.manager.abilities);
            const stats = new AbilityStats();
            stats.uses = reader.getUint32();
            stats.damage = reader.getFloat64();
            stats.healing = reader.getFloat64();
            stats.highestHit = reader.getFloat64();
            if (ability && typeof ability !== 'string') {
                this.byAbility.set(ability, stats);
            }
        }

        // Decode equipmentWorn
        this.equipmentWorn = new Set();
        reader.getSet((r) => {
            const item = r.getNamespacedObject(this.manager.baseItems);
            if (item && typeof item !== 'string') {
                this.equipmentWorn.add(item);
            }
        });

        // Decode encounter history
        this.encounters = [];
        reader.getArray((r) => {
            const encounter = new EncounterStats(this.manager);
            encounter.decode(r, version);
            this.encounters.push(encounter);
        });
    }
}

/**
 * Central combat statistics tracker.
 * Manages encounter stats, run stats, and session history.
 */
export class CombatTracker {
    constructor(manager) {
        this.manager = manager;
        
        // Current encounter stats (active fight)
        this.encounter = new EncounterStats(manager);
        
        // Current run stats (active area attempt)
        this.run = new RunStats(manager);
        
        // Session history (past runs, not persisted)
        this.history = [];

        // Register conductor listeners for stat tracking
        this.manager.conductor.listen('after_damage_delivered', (type, context) => {
            this._onDamageDelivered(context);
        });
        
        this.manager.conductor.listen('after_damage_received', (type, context) => {
            this._onDamageReceived(context);
        });
        
        this.manager.conductor.listen('after_heal_delivered', (type, context) => {
            this._onHealDelivered(context);
        });
        
        this.manager.conductor.listen(['generator', 'spender'], (type, context) => {
            this._onAbilityUsed(context);
        });
    }

    /**
     * Handle damage delivered event - tracks damage dealt by source
     */
    _onDamageDelivered(context) {
        const { source, target, damageDealt, ability } = context;
        if (!source || !target || !damageDealt || damageDealt <= 0) return;
        
        // Hero dealing damage to enemy
        if (source.isHero && !target.isHero) {
            const heroStats = this.encounter._getHeroStats(source);
            heroStats.damageDealt += damageDealt;
            if (damageDealt > heroStats.highestHit) {
                heroStats.highestHit = damageDealt;
            }
            
            // Track by monster
            const monsterStats = this.encounter._getMonsterStats(target);
            if (monsterStats) {
                monsterStats.damageDealt += damageDealt;
                if (damageDealt > monsterStats.highestHit) {
                    monsterStats.highestHit = damageDealt;
                }
            }
            
            // Track by ability
            if (ability) {
                const abilityStats = this.encounter._getAbilityStats(ability);
                if (abilityStats) {
                    abilityStats.damage += damageDealt;
                    if (damageDealt > abilityStats.highestHit) {
                        abilityStats.highestHit = damageDealt;
                    }
                }
            }
        }
        
        // Enemy dealing damage to hero (damage taken)
        if (!source.isHero && target.isHero) {
            const heroStats = this.encounter._getHeroStats(target);
            heroStats.damageTaken += damageDealt;
            
            // Track by monster (damage from this monster)
            const monsterStats = this.encounter._getMonsterStats(source);
            if (monsterStats) {
                monsterStats.damageTaken += damageDealt;
            }
        }
    }

    /**
     * Handle damage received event - tracks blocked damage
     */
    _onDamageReceived(context) {
        const { source, attacker, damageBlocked } = context;
        if (!source || !source.isHero || !damageBlocked || damageBlocked <= 0) return;
        
        const heroStats = this.encounter._getHeroStats(source);
        heroStats.damageBlocked += damageBlocked;
    }

    /**
     * Handle heal delivered event
     */
    _onHealDelivered(context) {
        const { source, target, amount, ability } = context;
        if (!target || !amount || amount <= 0) return;
        
        // Only track healing on heroes
        if (target.isHero) {
            const heroStats = this.encounter._getHeroStats(target);
            heroStats.healing += amount;
            
            // Track by ability
            if (ability) {
                const abilityStats = this.encounter._getAbilityStats(ability);
                if (abilityStats) {
                    abilityStats.healing += amount;
                }
            }
        }
    }

    /**
     * Handle ability used event (generator or spender)
     */
    _onAbilityUsed(context) {
        const { source, ability } = context;
        if (!source || !ability) return;
        
        // Only track for heroes
        if (source.isHero) {
            // Track ability uses
            const abilityStats = this.encounter._getAbilityStats(ability);
            if (abilityStats) {
                abilityStats.uses++;
            }
            
            const heroStats = this.encounter._getHeroStats(source);
            const currentUses = heroStats.abilityUses.get(ability) || 0;
            heroStats.abilityUses.set(ability, currentUses + 1);
            
            // Track turn
            this.encounter.turnsElapsed++;
        }
    }

    /**
     * Called when starting a new area run
     * @param {Object} options - { area, difficulty, party }
     */
    startRun(options) {
        this.run.reset();
        this.run.setContext(options);
        this.encounter.reset();
    }

    /**
     * Called when starting a new encounter within a run
     * @param {string} tileType - Type of tile: 'encounter', 'boss', 'exit', 'special'
     */
    startEncounter(tileType = 'encounter') {
        this.encounter.reset();
        this.encounter.tileType = tileType;
    }

    /**
     * Called when an encounter ends (victory or defeat)
     */
    endEncounter() {
        // Aggregate encounter stats into run stats
        this.run.aggregateEncounter(this.encounter);
        // Reset for next encounter
        this.encounter.reset();
    }

    /**
     * Called when a run ends (area complete, abandoned, or died)
     * @param {Object} options - { completed, died }
     */
    endRun({ completed = true, died = false } = {}) {
        // Store outcome on the run before cloning
        this.run.outcome = completed ? 'completed' : (died ? 'died' : 'abandoned');
        
        // Add to session history (non-persistent)
        this.history.push(this.run.clone());
        
        // Keep history bounded (last 50 runs)
        if (this.history.length > 50) {
            this.history.shift();
        }
        
        // Reset for next run
        this.run.reset();
        this.encounter.reset();
    }

    /**
     * For endless mode - continue the run without resetting
     * Just aggregates current encounter and prepares for next
     */
    continueEndlessWave() {
        this.run.aggregateEncounter(this.encounter);
        this.encounter.reset();
    }

    /**
     * Get current context for achievement triggers
     * @returns {Object} Context object with encounter and run stats
     */
    getContext() {
        return {
            encounterStats: this.encounter,
            runStats: this.run,
            area: this.run.area,
            difficulty: this.run.difficulty,
            partySize: this.run.partySize
        };
    }

    /**
     * Clear all run history
     */
    clearHistory() {
        this.history = [];
    }

    encode(writer) {
        // Only persist current run and encounter (if mid-run)
        this.encounter.encode(writer);
        this.run.encode(writer);
        // History is not persisted
    }

    decode(reader, version) {
        this.encounter.decode(reader, version);
        this.run.decode(reader, version);
        this.history = []; // Reset history on load
    }
}
