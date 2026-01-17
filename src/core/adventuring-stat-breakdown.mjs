const { loadModule } = mod.getContext(import.meta);

/**
 * Represents a single contribution to a stat from one source
 */
export class StatContribution {
    /**
     * @param {string} source - Display name of the source (e.g., "Iron Sword", "Berserker")
     * @param {string} sourceType - Category type ('base', 'job', 'equipment', 'achievement', 'consumable', 'aura', etc.)
     * @param {Object} sourceRef - Reference to the actual source object (for icons, etc.)
     */
    constructor(source, sourceType, sourceRef = null) {
        this.source = source;
        this.sourceType = sourceType;
        this.sourceRef = sourceRef;
        this.flat = 0;
        this.percent = 0;
        this.subContributions = []; // For nested items (e.g., items under Equipment)
    }

    /**
     * Add flat and/or percent values
     */
    add(flat = 0, percent = 0) {
        this.flat += flat;
        this.percent += percent;
    }

    /**
     * Add a sub-contribution (e.g., individual equipment item)
     * @param {StatContribution} contrib
     */
    addSub(contrib) {
        this.subContributions.push(contrib);
    }

    /**
     * Check if this contribution has any value
     */
    get hasValue() {
        return this.flat !== 0 || this.percent !== 0 || this.subContributions.length > 0;
    }

    /**
     * Get total flat from this and all sub-contributions
     */
    get totalFlat() {
        let total = this.flat;
        for (const sub of this.subContributions) {
            total += sub.totalFlat;
        }
        return total;
    }

    /**
     * Get total percent from this and all sub-contributions
     */
    get totalPercent() {
        let total = this.percent;
        for (const sub of this.subContributions) {
            total += sub.totalPercent;
        }
        return total;
    }

    /**
     * Get icon for this contribution (if available)
     */
    get icon() {
        if (this.sourceRef && this.sourceRef.media) {
            return this.sourceRef.media;
        }
        return null;
    }
}

/**
 * Complete breakdown of a single stat showing all sources
 */
export class StatBreakdown {
    constructor(stat) {
        this.stat = stat;
        this.base = 0;
        this.positive = [];   // StatContribution[] - positive bonuses
        this.negative = [];   // StatContribution[] - negative modifiers
        this.combat = {
            buffs: [],        // StatContribution[] - combat buffs
            debuffs: []       // StatContribution[] - combat debuffs
        };
    }

    /**
     * Add a positive contribution
     * @param {StatContribution} contrib
     */
    addPositive(contrib) {
        if (contrib.hasValue) {
            this.positive.push(contrib);
        }
    }

    /**
     * Add a negative contribution
     * @param {StatContribution} contrib
     */
    addNegative(contrib) {
        if (contrib.hasValue) {
            this.negative.push(contrib);
        }
    }

    /**
     * Add a combat buff contribution
     * @param {StatContribution} contrib
     */
    addBuff(contrib) {
        if (contrib.hasValue) {
            this.combat.buffs.push(contrib);
        }
    }

    /**
     * Add a combat debuff contribution
     * @param {StatContribution} contrib
     */
    addDebuff(contrib) {
        if (contrib.hasValue) {
            this.combat.debuffs.push(contrib);
        }
    }

    /**
     * Total flat bonuses (positive - negative + combat)
     */
    get totalFlat() {
        let total = 0;
        for (const c of this.positive) total += c.totalFlat;
        for (const c of this.negative) total += c.totalFlat; // Already negative
        for (const c of this.combat.buffs) total += c.totalFlat;
        for (const c of this.combat.debuffs) total += c.totalFlat;
        return total;
    }

    /**
     * Total percent bonuses
     */
    get totalPercent() {
        let total = 0;
        for (const c of this.positive) total += c.totalPercent;
        for (const c of this.negative) total += c.totalPercent;
        for (const c of this.combat.buffs) total += c.totalPercent;
        for (const c of this.combat.debuffs) total += c.totalPercent;
        return total;
    }

    /**
     * Calculate final stat value using StatCalculator formula
     * (base + flat) * (1 + percent/100)
     */
    get finalValue() {
        const withFlat = this.base + this.totalFlat;
        const withPercent = withFlat * (1 + this.totalPercent / 100);
        return Math.floor(withPercent);
    }

    /**
     * Get all positive contributions total
     */
    get positiveTotal() {
        let flat = 0, percent = 0;
        for (const c of this.positive) {
            flat += c.totalFlat;
            percent += c.totalPercent;
        }
        return { flat, percent };
    }

    /**
     * Get all negative contributions total
     */
    get negativeTotal() {
        let flat = 0, percent = 0;
        for (const c of this.negative) {
            flat += c.totalFlat;
            percent += c.totalPercent;
        }
        return { flat, percent };
    }

    /**
     * Get all combat contributions total
     */
    get combatTotal() {
        let flat = 0, percent = 0;
        for (const c of this.combat.buffs) {
            flat += c.totalFlat;
            percent += c.totalPercent;
        }
        for (const c of this.combat.debuffs) {
            flat += c.totalFlat;
            percent += c.totalPercent;
        }
        return { flat, percent };
    }
}

/**
 * Cache for stat breakdowns - rebuilds when invalidated
 */
export class StatBreakdownCache {
    constructor(character, manager) {
        this.character = character;
        this.manager = manager;
        this.breakdowns = new Map(); // stat.id → StatBreakdown
        this.dirty = true;
    }

    /**
     * Mark cache as needing rebuild
     */
    invalidate() {
        this.dirty = true;
        this.breakdowns.clear();
    }

    /**
     * Rebuild all breakdowns from sources
     */
    rebuild() {
        if (!this.dirty) return;
        
        this.breakdowns.clear();
        
        // Initialize breakdown for each stat
        this.manager.stats.forEach(stat => {
            this.breakdowns.set(stat.id, new StatBreakdown(stat));
        });

        // Collect from all sources
        this._collectBaseStats();
        
        if (this.character.isHero) {
            this._collectJobStats();
            this._collectEquipmentStats();
            this._collectEffectBonuses();
        }
        
        this._collectCombatEffects();

        this.dirty = false;
    }

    /**
     * Get breakdown for a specific stat
     * @param {Object|string} stat - Stat object or stat ID
     * @returns {StatBreakdown}
     */
    getBreakdown(stat) {
        this.rebuild();
        
        const statId = typeof stat === 'string' ? stat : stat.id;
        return this.breakdowns.get(statId);
    }

    /**
     * Collect base stat values
     */
    _collectBaseStats() {
        this.manager.stats.forEach(stat => {
            const breakdown = this.breakdowns.get(stat.id);
            if (breakdown && stat.base !== undefined) {
                breakdown.base = stat.base;
            }
        });
    }

    /**
     * Collect job stat contributions (combat job + passive job)
     */
    _collectJobStats() {
        const combatJob = this.character.combatJob;
        const passiveJob = this.character.passiveJob;

        // Combat Job
        if (combatJob && combatJob !== this.manager.cached?.noneJob) {
            const jobBonus = this.manager.party?.getJobStatBonus(combatJob) || 0;
            const contrib = new StatContribution(
                `${combatJob.name} (Lv.${combatJob.level})`,
                'combatJob',
                combatJob
            );

            // Job stats come from scaling * level
            combatJob.scaling.forEach((scalingValue, stat) => {
                const baseFromLevel = Math.floor(combatJob.level * scalingValue);
                const masteryBonus = Math.floor(baseFromLevel * jobBonus);
                
                const breakdown = this.breakdowns.get(stat.id);
                if (breakdown) {
                    const subContrib = new StatContribution(combatJob.name, 'combatJob', combatJob);
                    subContrib.flat = baseFromLevel;
                    
                    if (masteryBonus > 0) {
                        const masteryContrib = new StatContribution('Job Mastery', 'mastery', null);
                        masteryContrib.flat = masteryBonus;
                        subContrib.addSub(masteryContrib);
                    }
                    
                    if (subContrib.flat > 0 || subContrib.subContributions.length > 0) {
                        breakdown.addPositive(subContrib);
                    }
                }
            });
        }

        // Passive Job (if different from combat job)
        if (passiveJob && passiveJob !== combatJob && passiveJob !== this.manager.cached?.noneJob) {
            const jobBonus = this.manager.party?.getJobStatBonus(passiveJob) || 0;

            passiveJob.scaling.forEach((scalingValue, stat) => {
                const baseFromLevel = Math.floor(passiveJob.level * scalingValue);
                const masteryBonus = Math.floor(baseFromLevel * jobBonus);
                
                const breakdown = this.breakdowns.get(stat.id);
                if (breakdown) {
                    const subContrib = new StatContribution(
                        `${passiveJob.name} (Passive, Lv.${passiveJob.level})`,
                        'passiveJob',
                        passiveJob
                    );
                    subContrib.flat = baseFromLevel;
                    
                    if (masteryBonus > 0) {
                        const masteryContrib = new StatContribution('Job Mastery', 'mastery', null);
                        masteryContrib.flat = masteryBonus;
                        subContrib.addSub(masteryContrib);
                    }
                    
                    if (subContrib.flat > 0 || subContrib.subContributions.length > 0) {
                        breakdown.addPositive(subContrib);
                    }
                }
            });
        }
    }

    /**
     * Collect equipment stat contributions
     */
    _collectEquipmentStats() {
        const equipment = this.character.equipment;
        if (!equipment) return;

        // Create a parent contribution for all equipment
        const equipmentContribs = new Map(); // stat.id → StatContribution (parent)

        // Individual items
        equipment.forEachEquipped((item, slot) => {
            if (!item || item === this.manager.cached?.noneItem) return;

            // Item stats (base + scaling)
            item.stats.forEach((value, stat) => {
                if (value === 0) return;
                
                let parentContrib = equipmentContribs.get(stat.id);
                if (!parentContrib) {
                    parentContrib = new StatContribution('Equipment', 'equipment', null);
                    equipmentContribs.set(stat.id, parentContrib);
                }

                const itemContrib = new StatContribution(item.name, 'equipmentItem', item);
                itemContrib.flat = value;
                parentContrib.addSub(itemContrib);
            });
        });

        // Equipment set bonuses
        if (this.manager.equipmentSets) {
            const setCounts = equipment.getSetPieceCounts();
            setCounts.forEach((count, set) => {
                if (count <= 0) return;
                
                // Get active set bonuses
                const setEffects = set.getActiveEffects(this.character);
                for (const effect of setEffects) {
                    if (effect.trigger !== 'passive') continue;
                    if (effect.type !== 'stat_flat' && effect.type !== 'stat_percent') continue;

                    const statId = effect.stat;
                    if (!statId) continue;

                    let parentContrib = equipmentContribs.get(statId);
                    if (!parentContrib) {
                        parentContrib = new StatContribution('Equipment', 'equipment', null);
                        equipmentContribs.set(statId, parentContrib);
                    }

                    const setContrib = new StatContribution(
                        `${set.name} (${count}/${set.pieces?.length || '?'})`,
                        'equipmentSet',
                        set
                    );
                    
                    if (effect.type === 'stat_flat') {
                        setContrib.flat = effect.amount || effect.value || 0;
                    } else if (effect.type === 'stat_percent') {
                        setContrib.percent = effect.amount || effect.value || 0;
                    }
                    
                    if (setContrib.hasValue) {
                        parentContrib.addSub(setContrib);
                    }
                }
            });
        }

        // Add equipment contributions to breakdowns
        equipmentContribs.forEach((contrib, statId) => {
            const breakdown = this.breakdowns.get(statId);
            if (breakdown && contrib.subContributions.length > 0) {
                breakdown.addPositive(contrib);
            }
        });
    }

    /**
     * Collect effect-based bonuses from EffectCache
     */
    _collectEffectBonuses() {
        if (!this.character.effectCache) return;

        // Get stat bonuses by source from character's effectCache
        const bySource = this._getStatBonusesBySource(this.character.effectCache);

        // Also get party-wide bonuses
        if (this.character.party?.effectCache) {
            const partyBonuses = this._getStatBonusesBySource(this.character.party.effectCache);
            // Merge party bonuses
            partyBonuses.forEach((statMap, sourceId) => {
                if (!bySource.has(sourceId)) {
                    bySource.set(sourceId, statMap);
                } else {
                    const existing = bySource.get(sourceId);
                    statMap.forEach((bonus, statId) => {
                        if (!existing.has(statId)) {
                            existing.set(statId, bonus);
                        } else {
                            const e = existing.get(statId);
                            e.flat += bonus.flat;
                            e.percent += bonus.percent;
                        }
                    });
                }
            });
        }

        // Map source IDs to display names and categories
        const sourceInfo = this._getSourceInfo();

        bySource.forEach((statMap, sourceId) => {
            const info = sourceInfo[sourceId] || { name: sourceId, type: 'other' };
            
            statMap.forEach((bonus, statId) => {
                const breakdown = this.breakdowns.get(statId);
                if (!breakdown) return;

                const contrib = new StatContribution(info.name, info.type, info.ref);
                contrib.flat = bonus.flat;
                contrib.percent = bonus.percent;

                // Categorize as positive or negative
                if (contrib.flat >= 0 && contrib.percent >= 0) {
                    breakdown.addPositive(contrib);
                } else if (contrib.flat <= 0 && contrib.percent <= 0) {
                    breakdown.addNegative(contrib);
                } else {
                    // Mixed - split into positive and negative
                    if (contrib.flat > 0 || contrib.percent > 0) {
                        const posContrib = new StatContribution(info.name, info.type, info.ref);
                        posContrib.flat = Math.max(0, contrib.flat);
                        posContrib.percent = Math.max(0, contrib.percent);
                        breakdown.addPositive(posContrib);
                    }
                    if (contrib.flat < 0 || contrib.percent < 0) {
                        const negContrib = new StatContribution(info.name, info.type, info.ref);
                        negContrib.flat = Math.min(0, contrib.flat);
                        negContrib.percent = Math.min(0, contrib.percent);
                        breakdown.addNegative(negContrib);
                    }
                }
            });
        });
    }

    /**
     * Get stat bonuses organized by source ID
     * @param {EffectCache} effectCache
     * @returns {Map<string, Map<string, {flat, percent}>>} sourceId → statId → {flat, percent}
     */
    _getStatBonusesBySource(effectCache) {
        effectCache.rebuild();
        
        const bySource = new Map();
        
        // Iterate through sources and collect their stat effects
        effectCache.sources.forEach((source, sourceId) => {
            // Skip auras - they're handled separately in combat effects
            if (sourceId === 'auras') return;
            
            try {
                const effects = source.getEffects();
                if (!Array.isArray(effects)) return;

                const statMap = new Map();

                for (const effect of effects) {
                    if (effect.trigger !== 'passive') continue;
                    
                    // Handle stat_flat and stat_percent
                    if (effect.type === 'stat_flat' || effect.type === 'stat_percent') {
                        const statId = effect.stat;
                        if (!statId) continue;

                        if (!statMap.has(statId)) {
                            statMap.set(statId, { flat: 0, percent: 0 });
                        }

                        const bonus = statMap.get(statId);
                        const value = effect.value ?? effect.amount ?? 0;

                        if (effect.type === 'stat_flat') {
                            bonus.flat += value;
                        } else {
                            bonus.percent += value;
                        }
                    }
                    
                    // Handle all_stat_bonus (applies to every stat)
                    if (effect.type === 'all_stat_bonus') {
                        const value = effect.value ?? effect.amount ?? 0;
                        this.manager.stats.forEach(stat => {
                            if (!statMap.has(stat.id)) {
                                statMap.set(stat.id, { flat: 0, percent: 0 });
                            }
                            statMap.get(stat.id).flat += value;
                        });
                    }
                }

                if (statMap.size > 0) {
                    bySource.set(sourceId, statMap);
                }
            } catch (e) {
                console.warn(`StatBreakdownCache: Error processing source ${sourceId}:`, e);
            }
        });

        return bySource;
    }

    /**
     * Get display info for known source IDs
     */
    _getSourceInfo() {
        return {
            'equipment': { name: 'Equipment Effects', type: 'equipment', ref: null },
            'combatJobPassives': { name: 'Job Passives', type: 'jobPassive', ref: this.character.combatJob },
            'passiveJobPassives': { name: 'Passive Job', type: 'jobPassive', ref: this.character.passiveJob },
            'globalPassives': { name: 'Global Passives', type: 'globalPassive', ref: null },
            'consumables': { name: 'Consumables', type: 'consumable', ref: null },
            'tavernDrinks': { name: 'Tavern Drinks', type: 'tavernDrink', ref: null },
            'achievements': { name: 'Achievements', type: 'achievement', ref: null },
            'party_achievements': { name: 'Achievements', type: 'achievement', ref: null },
            'difficulty': { name: 'Difficulty', type: 'difficulty', ref: null },
            'heroEquipment': { name: 'Party Equipment', type: 'equipment', ref: null },
            'monsterPassives': { name: 'Monster Abilities', type: 'monsterPassive', ref: null },
            'dungeonEffects': { name: 'Dungeon Effects', type: 'dungeon', ref: null },
        };
    }

    /**
     * Collect combat-specific effects (buffs/debuffs from auras)
     */
    _collectCombatEffects() {
        if (!this.character.auras) return;

        for (const auraInstance of this.character.auras.auras) {
            if (!auraInstance.base || auraInstance.stacks <= 0) continue;

            const aura = auraInstance.base;
            const isBuff = aura.isBuff !== false; // Default to buff if not specified
            const stacks = auraInstance.stacks;

            if (!aura.effects) continue;

            for (const effect of aura.effects) {
                if (effect.trigger !== 'passive') continue;
                if (effect.type !== 'stat_flat' && effect.type !== 'stat_percent') continue;

                const statId = effect.stat || effect.id;
                if (!statId) continue;

                const breakdown = this.breakdowns.get(statId);
                if (!breakdown) continue;

                // Get amount (may be stack-scaled)
                let amount = effect.getAmount ? effect.getAmount(auraInstance) : (effect.amount || 0);

                const contrib = new StatContribution(
                    stacks > 1 ? `${aura.name} (${stacks})` : aura.name,
                    'aura',
                    aura
                );

                if (effect.type === 'stat_flat') {
                    contrib.flat = amount;
                } else {
                    contrib.percent = amount;
                }

                if (isBuff) {
                    breakdown.addBuff(contrib);
                } else {
                    breakdown.addDebuff(contrib);
                }
            }
        }
    }
}
