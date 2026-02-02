const { loadModule } = mod.getContext(import.meta);

/**
 * Represents a single contribution to a stat from one source
 */
export class StatContribution {
    /**
     * @param {string} source - Display name of the source (e.g., "Iron Sword", "Berserker")
     * @param {string} sourceType - Category type ('base', 'job', 'equipment', 'achievement', 'consumable', 'aura', etc.)
     * @param {Object} sourceRef - Reference to the actual source object (for icons, etc.)
     * @param {Array} sourcePath - Full source path array [{type, name, ref}, ...]
     */
    constructor(source, sourceType, sourceRef = null, sourcePath = null) {
        this.source = source;
        this.sourceType = sourceType;
        this.sourceRef = sourceRef;
        this.sourcePath = sourcePath || (source && sourceType ? [{ type: sourceType, name: source, ref: sourceRef }] : []);
        this.flat = 0;
        this.percent = 0;
        this.subContributions = []; // For nested items (e.g., items under Equipment)
    }
    
    /**
     * Create a StatContribution from a sourcePath array
     * @param {Array} sourcePath - [{type, name, ref}, ...]
     * @returns {StatContribution}
     */
    static fromSourcePath(sourcePath) {
        if (!sourcePath || sourcePath.length === 0) {
            return new StatContribution('Unknown', 'unknown', null, []);
        }
        const leaf = sourcePath[sourcePath.length - 1];
        return new StatContribution(leaf.name, leaf.type, leaf.ref, sourcePath);
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
     * Falls back to parent in sourcePath if leaf doesn't have media
     */
    get icon() {
        // First check the direct sourceRef
        if (this.sourceRef && this.sourceRef.media) {
            return this.sourceRef.media;
        }
        
        // Fall back to checking the sourcePath for any ref with media
        // Check from leaf to root to find the first available icon
        if (this.sourcePath && this.sourcePath.length > 0) {
            for (let i = this.sourcePath.length - 1; i >= 0; i--) {
                const pathItem = this.sourcePath[i];
                if (pathItem.ref && pathItem.ref.media) {
                    return pathItem.ref.media;
                }
            }
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
        this._collectAllEffects();
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
     * For heroes: use stat definition's base value
     * For enemies: use the original monster stats (before difficulty scaling)
     */
    _collectBaseStats() {
        if (this.character.isHero) {
            // Heroes use the stat definition's base value
            this.manager.stats.forEach(stat => {
                const breakdown = this.breakdowns.get(stat.id);
                if (breakdown && stat.base !== undefined) {
                    breakdown.base = stat.base;
                }
            });
        } else {
            // Enemies/monsters use their original monster stats as the base
            // (before difficulty scaling is applied)
            if (this.character.base && this.character.base.stats) {
                for (const { id, amount } of this.character.base.stats) {
                    const breakdown = this.breakdowns.get(id);
                    if (breakdown) {
                        breakdown.base = amount;
                    }
                }
            } else {
                // Fallback to current stat values if no base monster
                this.manager.stats.forEach(stat => {
                    const breakdown = this.breakdowns.get(stat.id);
                    if (breakdown) {
                        breakdown.base = this.character.stats.get(stat) || 0;
                    }
                });
            }
        }
    }

    /**
     * Collect all passive stat effects from the character's effectCache.
     * Groups by root source type for hierarchical display with parent/child structure.
     * Supports 3-level nesting for multi-level sourcePaths (e.g., Achievement → Milestone).
     */
    _collectAllEffects() {
        if (!this.character.effectCache) return;
        
        const cache = this.character.effectCache;
        cache.rebuild();
        
        // Build context once for getAmount() calls
        const context = this._buildContext();
        
        // Group effects by stat, then by root source type, then by intermediate parent (if any), then by leaf
        // Structure: statId → rootType → intermediateKey → leafKey → { sourcePath, flat, percent }
        const byStatByRoot = new Map();
        
        cache.sources.forEach((source, sourceId) => {
            // Skip auras - handled separately in _collectCombatEffects
            if (sourceId === 'auras') return;
            
            let effects;
            try {
                effects = source.getEffects();
            } catch (e) {
                return;
            }
            
            if (!Array.isArray(effects)) return;
            
            for (const effect of effects) {
                if (effect.trigger !== 'passive') continue;
                
                // Handle stat effects
                if (effect.type === 'stat_flat' || effect.type === 'stat_percent') {
                    const statId = effect.stat;
                    if (!statId) continue;
                    
                    this._addEffectToHierarchy(byStatByRoot, effect, statId, context, sourceId);
                }
                
                // Handle all_stat_bonus (applies to every stat)
                if (effect.type === 'all_stat_bonus') {
                    this.manager.stats.forEach(stat => {
                        this._addEffectToHierarchy(byStatByRoot, { ...effect, type: 'stat_flat', stat: stat.id }, stat.id, context, sourceId);
                    });
                }
            }
        });
        
        // Build hierarchical contributions with parent/child structure
        // Process root types in defined order for consistent display
        byStatByRoot.forEach((byRootType, statId) => {
            const breakdown = this.breakdowns.get(statId);
            if (!breakdown) return;
            
            // Sort root types by priority order
            const sortedRootTypes = [...byRootType.keys()].sort((a, b) => {
                return this._getSourcePriority(a) - this._getSourcePriority(b);
            });
            
            for (const rootType of sortedRootTypes) {
                const intermediateGroups = byRootType.get(rootType);
                const rootName = this._getRootDisplayName(rootType);
                const rootRef = this._getRootRef(rootType);
                
                // Count total items across all intermediate groups
                let totalItems = 0;
                let hasMultiLevelPath = false;
                intermediateGroups.forEach(leafItems => {
                    totalItems += leafItems.size;
                    // Check if any item has a multi-level sourcePath (should preserve hierarchy)
                    leafItems.forEach(itemData => {
                        if (itemData.sourcePath && itemData.sourcePath.length > 1) {
                            hasMultiLevelPath = true;
                        }
                    });
                });
                
                if (totalItems > 1 || hasMultiLevelPath) {
                    // Multiple items OR multi-level paths - create grouped contribution with hierarchy
                    this._createGroupedContribution(breakdown, rootName, rootType, rootRef, intermediateGroups);
                } else {
                    // Single item with single-level path - add directly without grouping
                    intermediateGroups.forEach(leafItems => {
                        leafItems.forEach((itemData) => {
                            const contrib = StatContribution.fromSourcePath(itemData.sourcePath);
                            contrib.flat = itemData.flat;
                            contrib.percent = itemData.percent;
                            
                            this._addContribToBreakdown(breakdown, contrib);
                        });
                    });
                }
            }
        });
    }
    
    /**
     * Get priority order for source types (lower = displayed first)
     */
    _getSourcePriority(rootType) {
        const priorities = {
            'combatJob': 10,
            'passiveJob': 20,
            'jobPassive': 25,
            'equipment': 30,
            'equipmentSet': 35,
            'achievement': 40,
            'milestone': 45,
            'mastery': 50,
            'globalPassive': 55,
            'consumable': 60,
            'tavern': 65,
            'dungeon': 70,
            'difficulty': 75,
            'endless': 80,
            'environment': 85,
            'monsterPassive': 90,
            'aura': 95
        };
        return priorities[rootType] ?? 100;
    }
    
    /**
     * Create a grouped contribution with parent and sub-contributions.
     * Supports 3-level nesting when items share an intermediate parent.
     */
    _createGroupedContribution(breakdown, parentName, parentType, parentRef, intermediateGroups) {
        // Collect all items, tracking their intermediate grouping
        const positiveItems = [];
        const negativeItems = [];
        
        intermediateGroups.forEach((leafItems, intermediateKey) => {
            leafItems.forEach((itemData) => {
                const isPositive = itemData.flat >= 0 && itemData.percent >= 0;
                const isNegative = itemData.flat <= 0 && itemData.percent <= 0;
                
                const entry = { ...itemData, intermediateKey };
                
                if (isPositive && (itemData.flat !== 0 || itemData.percent !== 0)) {
                    positiveItems.push(entry);
                } else if (isNegative && (itemData.flat !== 0 || itemData.percent !== 0)) {
                    negativeItems.push(entry);
                } else if (itemData.flat !== 0 || itemData.percent !== 0) {
                    // Mixed - split
                    if (itemData.flat > 0 || itemData.percent > 0) {
                        positiveItems.push({
                            ...entry,
                            flat: Math.max(0, itemData.flat),
                            percent: Math.max(0, itemData.percent)
                        });
                    }
                    if (itemData.flat < 0 || itemData.percent < 0) {
                        negativeItems.push({
                            ...entry,
                            flat: Math.min(0, itemData.flat),
                            percent: Math.min(0, itemData.percent)
                        });
                    }
                }
            });
        });
        
        // Create positive parent if needed
        if (positiveItems.length > 0) {
            const parentContrib = this._buildNestedContribution(parentName, parentType, parentRef, positiveItems);
            breakdown.addPositive(parentContrib);
        }
        
        // Create negative parent if needed
        if (negativeItems.length > 0) {
            const parentContrib = this._buildNestedContribution(parentName, parentType, parentRef, negativeItems);
            breakdown.addNegative(parentContrib);
        }
    }
    
    /**
     * Build a nested contribution structure from items.
     * Groups by intermediate key to create 3-level nesting when appropriate.
     */
    _buildNestedContribution(parentName, parentType, parentRef, items) {
        const parentContrib = new StatContribution(parentName, parentType, parentRef);
        
        // Group items by their intermediate key
        const byIntermediate = new Map();
        for (const item of items) {
            const key = item.intermediateKey;
            if (!byIntermediate.has(key)) {
                byIntermediate.set(key, []);
            }
            byIntermediate.get(key).push(item);
        }
        
        // Check if we should create intermediate groupings
        // Create intermediate level if there are multiple items in a group
        // OR if any item has a multi-level sourcePath (indicating parent/child structure)
        let needsIntermediateGrouping = false;
        byIntermediate.forEach((groupItems, key) => {
            // Check if ANY item in the group has multi-level sourcePath
            const hasMultiLevelPath = groupItems.some(item => item.sourcePath && item.sourcePath.length > 1);
            if (groupItems.length > 1 || hasMultiLevelPath) {
                needsIntermediateGrouping = true;
            }
        });
        
        if (needsIntermediateGrouping) {
            // Create intermediate-level sub-contributions
            byIntermediate.forEach((groupItems, intermediateKey) => {
                // Check if this specific group needs intermediate nesting
                const hasMultiLevelPath = groupItems.some(item => item.sourcePath && item.sourcePath.length > 1);
                
                if (hasMultiLevelPath) {
                    // Find an item with multi-level path to get intermediate info
                    const multiLevelItem = groupItems.find(item => item.sourcePath && item.sourcePath.length > 1);
                    const intermediatePath = multiLevelItem.sourcePath[0];
                    
                    const intermediateContrib = new StatContribution(
                        intermediatePath.name,
                        intermediatePath.type,
                        intermediatePath.ref
                    );
                    
                    // Add items as sub-contributions
                    for (const item of groupItems) {
                        if (item.sourcePath && item.sourcePath.length > 1) {
                            // Multi-level: use leaf (last element) as the sub-contribution
                            const leafPath = item.sourcePath[item.sourcePath.length - 1];
                            const leafContrib = new StatContribution(
                                leafPath.name,
                                leafPath.type,
                                leafPath.ref,
                                item.sourcePath
                            );
                            leafContrib.flat = item.flat;
                            leafContrib.percent = item.percent;
                            intermediateContrib.addSub(leafContrib);
                        } else {
                            // Single-level: this IS the intermediate, add its value directly
                            intermediateContrib.flat += item.flat;
                            intermediateContrib.percent += item.percent;
                        }
                    }
                    
                    parentContrib.addSub(intermediateContrib);
                } else {
                    // No multi-level paths in this group - add items directly
                    for (const item of groupItems) {
                        const subContrib = StatContribution.fromSourcePath(item.sourcePath);
                        subContrib.flat = item.flat;
                        subContrib.percent = item.percent;
                        parentContrib.addSub(subContrib);
                    }
                }
            });
        } else {
            // No intermediate grouping needed - add items directly
            for (const item of items) {
                const subContrib = StatContribution.fromSourcePath(item.sourcePath);
                subContrib.flat = item.flat;
                subContrib.percent = item.percent;
                parentContrib.addSub(subContrib);
            }
        }
        
        return parentContrib;
    }
    
    /**
     * Add an effect to the hierarchical grouped collection.
     * Structure: statId → rootType → intermediateKey → leafKey → itemData
     */
    _addEffectToHierarchy(byStatByRoot, effect, statId, context, fallbackSourceId) {
        const sourcePath = effect.sourcePath || [];
        
        // Determine root type from sourcePath or fallback to sourceId
        const rootType = sourcePath.length > 0 ? sourcePath[0].type : fallbackSourceId;
        
        // Determine intermediate key (for grouping multi-level paths)
        // If sourcePath has 2+ levels, use first element's name as intermediate
        // Otherwise, use the leaf name or fallback
        const intermediateKey = sourcePath.length >= 2 
            ? sourcePath[0].name 
            : (sourcePath.length === 1 ? sourcePath[0].name : fallbackSourceId);
        
        // Create unique key for this specific leaf item
        const leafKey = sourcePath.length > 0 
            ? sourcePath.map(p => p.name).join('>')
            : fallbackSourceId;
        
        // Ensure stat entry exists
        if (!byStatByRoot.has(statId)) {
            byStatByRoot.set(statId, new Map());
        }
        const byRootType = byStatByRoot.get(statId);
        
        // Ensure root type entry exists (maps intermediate → leaf items)
        if (!byRootType.has(rootType)) {
            byRootType.set(rootType, new Map());
        }
        const byIntermediate = byRootType.get(rootType);
        
        // Ensure intermediate entry exists
        if (!byIntermediate.has(intermediateKey)) {
            byIntermediate.set(intermediateKey, new Map());
        }
        const leafItems = byIntermediate.get(intermediateKey);
        
        // Ensure leaf entry exists
        if (!leafItems.has(leafKey)) {
            leafItems.set(leafKey, {
                sourcePath,
                flat: 0,
                percent: 0
            });
        }
        
        const itemData = leafItems.get(leafKey);
        
        // Get amount - handle getAmount function
        // Pass null for displayMode to get numeric value, not display string
        let amount = 0;
        if (typeof effect.getAmount === 'function') {
            const sourceRef = sourcePath.length > 0 ? sourcePath[sourcePath.length - 1].ref : null;
            amount = effect.getAmount(sourceRef, null, context);
        } else {
            amount = effect.value ?? effect.amount ?? 0;
        }
        
        if (effect.type === 'stat_flat') {
            itemData.flat += amount;
        } else {
            itemData.percent += amount;
        }
    }
    
    /**
     * Add a contribution to the appropriate breakdown list
     */
    _addContribToBreakdown(breakdown, contrib) {
        if (contrib.flat >= 0 && contrib.percent >= 0) {
            breakdown.addPositive(contrib);
        } else if (contrib.flat <= 0 && contrib.percent <= 0) {
            breakdown.addNegative(contrib);
        } else {
            // Mixed - need to split
            if (contrib.flat > 0 || contrib.percent > 0) {
                const posContrib = StatContribution.fromSourcePath(contrib.sourcePath);
                posContrib.flat = Math.max(0, contrib.flat);
                posContrib.percent = Math.max(0, contrib.percent);
                breakdown.addPositive(posContrib);
            }
            if (contrib.flat < 0 || contrib.percent < 0) {
                const negContrib = StatContribution.fromSourcePath(contrib.sourcePath);
                negContrib.flat = Math.min(0, contrib.flat);
                negContrib.percent = Math.min(0, contrib.percent);
                breakdown.addNegative(negContrib);
            }
        }
    }
    
    /**
     * Get a reference object for a root type (for icons)
     */
    _getRootRef(rootType) {
        // For jobs, use the job's icon
        switch (rootType) {
            case 'combatJob':
                return this.character.combatJob || null;
            case 'passiveJob':
                return this.character.passiveJob || null;
            default:
                // Other categories don't have icons for parent level
                return null;
        }
    }
    
    /**
     * Get display name for a root source type
     */
    _getRootDisplayName(rootType) {
        const names = {
            'equipment': 'Equipment',
            'equipmentSet': 'Equipment Set',
            'combatJob': 'Combat Job',
            'passiveJob': 'Passive Job',
            'jobPassive': 'Job Passive',
            'globalPassive': 'Global Passive',
            'achievement': 'Achievements',
            'milestone': 'Milestones',
            'consumable': 'Consumables',
            'tavern': 'Tavern',
            'mastery': 'Mastery',
            'dungeon': 'Dungeon',
            'difficulty': 'Difficulty',
            'endless': 'Endless',
            'monsterPassive': 'Monster Abilities',
            'environment': 'Environment',
            'aura': 'Aura'
        };
        return names[rootType] || rootType;
    }
    
    /**
     * Build context for effect amount calculation
     */
    _buildContext() {
        const context = {
            manager: this.manager
        };
        
        if (this.character.combatJob) {
            context.combatJob = this.character.combatJob;
        }
        if (this.character.passiveJob) {
            context.passiveJob = this.character.passiveJob;
        }
        
        return context;
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
