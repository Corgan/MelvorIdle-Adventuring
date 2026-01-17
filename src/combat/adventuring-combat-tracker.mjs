const { loadModule } = mod.getContext(import.meta);

/**
 * Stats tracked during a single encounter (one fight).
 */
export class EncounterStats {
    constructor(manager) {
        this.manager = manager;
        this.reset();
    }

    reset() {
        this.damageTaken = 0;
        this.damageDealt = 0;
        this.healingReceived = 0;
        this.turnsElapsed = 0;
        this.highestSingleHit = 0;
        this.abilitiesUsed = new Set();           // Set<Ability> - entity references
        this.damageDealtByMonster = new Map();    // Map<Monster, number> - base monster refs
        this.damageTakenByMonster = new Map();    // Map<Monster, number> - base monster refs
    }

    get wasFlawless() {
        return this.damageTaken === 0;
    }

    /**
     * Record damage dealt to a target
     * @param {number} amount - Damage amount
     * @param {Object} target - The target entity (enemy instance)
     */
    recordDamageDealt(amount, target) {
        this.damageDealt += amount;
        if (amount > this.highestSingleHit) {
            this.highestSingleHit = amount;
        }
        
        // Track by base monster if target has one
        if (target?.base) {
            const current = this.damageDealtByMonster.get(target.base) || 0;
            this.damageDealtByMonster.set(target.base, current + amount);
        }
    }

    /**
     * Record damage taken from an attacker
     * @param {number} amount - Damage amount
     * @param {Object} attacker - The attacker entity (enemy instance)
     */
    recordDamageTaken(amount, attacker) {
        this.damageTaken += amount;
        
        // Track by base monster if attacker has one
        if (attacker?.base) {
            const current = this.damageTakenByMonster.get(attacker.base) || 0;
            this.damageTakenByMonster.set(attacker.base, current + amount);
        }
    }

    /**
     * Record healing received
     * @param {number} amount - Healing amount
     */
    recordHealing(amount) {
        this.healingReceived += amount;
    }

    /**
     * Record an ability being used
     * @param {Object} ability - The ability entity
     */
    recordAbilityUsed(ability) {
        if (ability) {
            this.abilitiesUsed.add(ability);
        }
    }

    /**
     * Record a turn passing
     */
    recordTurn() {
        this.turnsElapsed++;
    }

    /**
     * Clone this stats object (for history)
     * @returns {EncounterStats}
     */
    clone() {
        const cloned = new EncounterStats(this.manager);
        cloned.damageTaken = this.damageTaken;
        cloned.damageDealt = this.damageDealt;
        cloned.healingReceived = this.healingReceived;
        cloned.turnsElapsed = this.turnsElapsed;
        cloned.highestSingleHit = this.highestSingleHit;
        cloned.abilitiesUsed = new Set(this.abilitiesUsed);
        cloned.damageDealtByMonster = new Map(this.damageDealtByMonster);
        cloned.damageTakenByMonster = new Map(this.damageTakenByMonster);
        return cloned;
    }

    encode(writer) {
        writer.writeFloat64(this.damageTaken);
        writer.writeFloat64(this.damageDealt);
        writer.writeFloat64(this.healingReceived);
        writer.writeUint32(this.turnsElapsed);
        writer.writeFloat64(this.highestSingleHit);

        // Encode abilitiesUsed as Set of namespaced IDs
        writer.writeSet(this.abilitiesUsed, (ability, w) => {
            w.writeNamespacedObject(ability);
        });

        // Encode damageDealtByMonster as Map
        writer.writeMap(
            this.damageDealtByMonster,
            (monster, w) => w.writeNamespacedObject(monster),
            (value, w) => w.writeFloat64(value)
        );

        // Encode damageTakenByMonster as Map
        writer.writeMap(
            this.damageTakenByMonster,
            (monster, w) => w.writeNamespacedObject(monster),
            (value, w) => w.writeFloat64(value)
        );
    }

    decode(reader, version) {
        this.damageTaken = reader.getFloat64();
        this.damageDealt = reader.getFloat64();
        this.healingReceived = reader.getFloat64();
        this.turnsElapsed = reader.getUint32();
        this.highestSingleHit = reader.getFloat64();

        // Decode abilitiesUsed
        this.abilitiesUsed = new Set();
        reader.getSet((r) => {
            // Try to resolve ability from various sources
            let ability = r.getNamespacedObject(this.manager.generators);
            if (!ability || typeof ability === 'string') {
                ability = r.getNamespacedObject(this.manager.spenders);
            }
            if (ability && typeof ability !== 'string') {
                this.abilitiesUsed.add(ability);
            }
        });

        // Decode damageDealtByMonster
        this.damageDealtByMonster = new Map();
        reader.getMap(
            (r) => r.getNamespacedObject(this.manager.monsters),
            (r) => r.getFloat64(),
            (monster, value) => {
                if (monster && typeof monster !== 'string') {
                    this.damageDealtByMonster.set(monster, value);
                }
            }
        );

        // Decode damageTakenByMonster
        this.damageTakenByMonster = new Map();
        reader.getMap(
            (r) => r.getNamespacedObject(this.manager.monsters),
            (r) => r.getFloat64(),
            (monster, value) => {
                if (monster && typeof monster !== 'string') {
                    this.damageTakenByMonster.set(monster, value);
                }
            }
        );
    }
}

/**
 * Stats tracked during an entire run (area attempt).
 * Aggregates encounter stats and maintains history.
 */
export class RunStats {
    constructor(manager) {
        this.manager = manager;
        this.reset();
    }

    reset() {
        // Aggregated totals
        this.damageTaken = 0;
        this.damageDealt = 0;
        this.healingReceived = 0;
        this.turnsElapsed = 0;
        this.highestSingleHit = 0;

        // Accumulated Sets/Maps (across all encounters)
        this.abilitiesUsed = new Set();           // Set<Ability>
        this.damageDealtByMonster = new Map();    // Map<Monster, number>
        this.damageTakenByMonster = new Map();    // Map<Monster, number>

        // Encounter history
        this.encounters = [];                      // EncounterStats[]

        // Run context (set at run start)
        this.partySize = 0;
        this.equipmentWorn = new Set();           // Set<Equipment> - snapshot at run start
        this.area = null;                          // Area entity
        this.difficulty = null;                    // Difficulty entity
    }

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

    /**
     * Check if this was a solo run
     * @returns {boolean}
     */
    get isSolo() {
        return this.partySize === 1;
    }

    /**
     * Check if all encounters were flawless
     * @returns {boolean}
     */
    get wasFlawless() {
        return this.damageTaken === 0;
    }

    /**
     * Aggregate an encounter's stats into this run
     * @param {EncounterStats} encounterStats
     */
    aggregateEncounter(encounterStats) {
        // Add to totals
        this.damageTaken += encounterStats.damageTaken;
        this.damageDealt += encounterStats.damageDealt;
        this.healingReceived += encounterStats.healingReceived;
        this.turnsElapsed += encounterStats.turnsElapsed;
        
        // Track highest hit across run
        if (encounterStats.highestSingleHit > this.highestSingleHit) {
            this.highestSingleHit = encounterStats.highestSingleHit;
        }

        // Merge abilities used
        for (const ability of encounterStats.abilitiesUsed) {
            this.abilitiesUsed.add(ability);
        }

        // Merge damage by monster maps
        for (const [monster, damage] of encounterStats.damageDealtByMonster) {
            const current = this.damageDealtByMonster.get(monster) || 0;
            this.damageDealtByMonster.set(monster, current + damage);
        }
        for (const [monster, damage] of encounterStats.damageTakenByMonster) {
            const current = this.damageTakenByMonster.get(monster) || 0;
            this.damageTakenByMonster.set(monster, current + damage);
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
        cloned.damageTaken = this.damageTaken;
        cloned.damageDealt = this.damageDealt;
        cloned.healingReceived = this.healingReceived;
        cloned.turnsElapsed = this.turnsElapsed;
        cloned.highestSingleHit = this.highestSingleHit;
        cloned.abilitiesUsed = new Set(this.abilitiesUsed);
        cloned.damageDealtByMonster = new Map(this.damageDealtByMonster);
        cloned.damageTakenByMonster = new Map(this.damageTakenByMonster);
        cloned.encounters = this.encounters.map(e => e.clone());
        cloned.partySize = this.partySize;
        cloned.equipmentWorn = new Set(this.equipmentWorn);
        cloned.area = this.area;
        cloned.difficulty = this.difficulty;
        return cloned;
    }

    encode(writer) {
        writer.writeFloat64(this.damageTaken);
        writer.writeFloat64(this.damageDealt);
        writer.writeFloat64(this.healingReceived);
        writer.writeUint32(this.turnsElapsed);
        writer.writeFloat64(this.highestSingleHit);
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

        // Encode abilitiesUsed
        writer.writeSet(this.abilitiesUsed, (ability, w) => {
            w.writeNamespacedObject(ability);
        });

        // Encode damageDealtByMonster
        writer.writeMap(
            this.damageDealtByMonster,
            (monster, w) => w.writeNamespacedObject(monster),
            (value, w) => w.writeFloat64(value)
        );

        // Encode damageTakenByMonster
        writer.writeMap(
            this.damageTakenByMonster,
            (monster, w) => w.writeNamespacedObject(monster),
            (value, w) => w.writeFloat64(value)
        );

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
        this.damageTaken = reader.getFloat64();
        this.damageDealt = reader.getFloat64();
        this.healingReceived = reader.getFloat64();
        this.turnsElapsed = reader.getUint32();
        this.highestSingleHit = reader.getFloat64();
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

        // Decode abilitiesUsed
        this.abilitiesUsed = new Set();
        reader.getSet((r) => {
            let ability = r.getNamespacedObject(this.manager.generators);
            if (!ability || typeof ability === 'string') {
                ability = r.getNamespacedObject(this.manager.spenders);
            }
            if (ability && typeof ability !== 'string') {
                this.abilitiesUsed.add(ability);
            }
        });

        // Decode damageDealtByMonster
        this.damageDealtByMonster = new Map();
        reader.getMap(
            (r) => r.getNamespacedObject(this.manager.monsters),
            (r) => r.getFloat64(),
            (monster, value) => {
                if (monster && typeof monster !== 'string') {
                    this.damageDealtByMonster.set(monster, value);
                }
            }
        );

        // Decode damageTakenByMonster
        this.damageTakenByMonster = new Map();
        reader.getMap(
            (r) => r.getNamespacedObject(this.manager.monsters),
            (r) => r.getFloat64(),
            (monster, value) => {
                if (monster && typeof monster !== 'string') {
                    this.damageTakenByMonster.set(monster, value);
                }
            }
        );

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
     */
    startEncounter() {
        this.encounter.reset();
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
     * Called when a run ends (area complete or abandoned)
     * @param {boolean} completed - Whether the run was completed successfully
     */
    endRun(completed = true) {
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
            partySize: this.run.partySize,
            isSolo: this.run.isSolo
        };
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
