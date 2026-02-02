const { loadModule } = mod.getContext(import.meta);

class AdventuringAchievementRenderQueue {
    constructor() {
        this.progress = false;
        this.completed = false;
        this.all = false;
    }

    queueAll() {
        this.progress = true;
        this.completed = true;
        this.all = true;
    }
}

/**
 * Data-driven achievement statistics.
 * Stats are defined in JSON and processed from trigger events.
 */
export class AchievementStats {
    constructor(manager) {
        this.manager = manager;
        
        // Storage for stat values by stat ID
        // Simple stats: Map<AchievementStat, number>
        this.simpleValues = new Map();
        
        // Map stats: Map<AchievementStat, Map<key, number>>
        this.mapValues = new Map();
        
        // Nested map stats: Map<AchievementStat, Map<key1, Map<key2, number>>>
        this.nestedMapValues = new Map();
        
        // Cache: trigger name -> array of stats that listen to it
        this._triggerCache = null;
    }

    /**
     * Build trigger cache for efficient processing
     */
    _buildTriggerCache() {
        this._triggerCache = new Map();
        
        for (const stat of this.manager.achievementStats.allObjects) {
            for (const trigger of stat.triggers) {
                if (!this._triggerCache.has(trigger)) {
                    this._triggerCache.set(trigger, []);
                }
                this._triggerCache.get(trigger).push(stat);
            }
        }
    }

    /**
     * Process a trigger event and update all relevant stats
     * @param {string} triggerName - The trigger event name
     * @param {Object} context - Context data from the trigger
     */
    processTrigger(triggerName, context) {
        if (!this._triggerCache) {
            this._buildTriggerCache();
        }
        
        const stats = this._triggerCache.get(triggerName);
        if (!stats || stats.length === 0) return;
        
        for (const stat of stats) {
            // Check conditions
            if (stat.conditions && !this._meetsConditions(stat.conditions, context)) {
                continue;
            }
            
            // Process based on aggregation type
            switch (stat.aggregation) {
                case 'count':
                    this._incrementSimple(stat, 1);
                    break;
                    
                case 'sum':
                    const sumValue = this._getValue(context, stat.valuePath);
                    if (typeof sumValue === 'number') {
                        this._incrementSimple(stat, sumValue);
                    }
                    break;
                    
                case 'max':
                    const maxValue = this._getValue(context, stat.valuePath);
                    if (typeof maxValue === 'number') {
                        this._setMax(stat, maxValue);
                    }
                    break;
                    
                case 'set':
                case 'map_count':
                    const keys = this._getKeys(stat, context);
                    for (const key of keys) {
                        this._incrementMap(stat, key, 1);
                    }
                    break;
                    
                case 'map_sum':
                    const mapSumKeys = this._getKeys(stat, context);
                    const mapSumValue = this._getValue(context, stat.valuePath);
                    if (typeof mapSumValue === 'number') {
                        for (const key of mapSumKeys) {
                            this._incrementMap(stat, key, mapSumValue);
                        }
                    }
                    break;

                case 'map_max':
                    const mapMaxKeys = this._getKeys(stat, context);
                    const mapMaxValue = this._getValue(context, stat.valuePath);
                    if (typeof mapMaxValue === 'number') {
                        for (const key of mapMaxKeys) {
                            this._setMapMax(stat, key, mapMaxValue);
                        }
                    }
                    break;
                    
                case 'nested_map_count':
                    const [key1, key2] = this._getNestedKeys(stat, context);
                    if (key1 && key2) {
                        this._incrementNestedMap(stat, key1, key2, 1);
                    }
                    break;
            }
        }
    }

    /**
     * Get a value from context using a path
     */
    _getValue(context, path) {
        if (!path) return undefined;
        return path.split('.').reduce((obj, key) => {
            if (obj === undefined || obj === null) return undefined;
            if (obj instanceof Map) return obj.get(key);
            return obj[key];
        }, context);
    }

    /**
     * Get keys from context for map-based stats
     */
    _getKeys(stat, context) {
        const rawValue = this._getValue(context, stat.keyPath);
        if (rawValue === undefined || rawValue === null) return [];
        
        // Expand arrays if configured
        let values = stat.expandKeys && Array.isArray(rawValue) ? rawValue : [rawValue];
        
        // Resolve to NamespacedObjects if registry specified
        if (stat.keyRegistry) {
            const registry = stat.getKeyRegistry();
            if (registry) {
                values = values.map(v => {
                    if (typeof v === 'object' && v?.id) return v; // Already an object
                    // Try to resolve string ID
                    const fullId = typeof v === 'string' && !v.includes(':') ? `adventuring:${v}` : v;
                    return registry.getObjectByID(fullId) || v;
                }).filter(v => v && typeof v === 'object');
            }
        }
        
        return values;
    }

    /**
     * Get nested keys for nested_map stats
     */
    _getNestedKeys(stat, context) {
        if (!Array.isArray(stat.keyPath) || stat.keyPath.length !== 2) {
            return [null, null];
        }
        
        const registries = stat.getKeyRegistries();
        const keys = stat.keyPath.map((path, i) => {
            const rawValue = this._getValue(context, path);
            if (!rawValue) return null;
            
            // Already an object
            if (typeof rawValue === 'object' && rawValue.id) return rawValue;
            
            // Try to resolve from registry
            if (registries[i]) {
                const fullId = typeof rawValue === 'string' && !rawValue.includes(':') 
                    ? `adventuring:${rawValue}` : rawValue;
                return registries[i].getObjectByID(fullId) || null;
            }
            
            return rawValue;
        });
        
        return keys;
    }

    /**
     * Check if conditions are met
     */
    _meetsConditions(conditions, context) {
        for (const [path, expected] of Object.entries(conditions)) {
            const actual = this._getValue(context, path);
            if (!this._compareValue(actual, expected)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Compare a value against an expected value or operator
     */
    _compareValue(actual, expected) {
        if (expected === null || expected === undefined) {
            return actual === expected;
        }
        
        if (typeof expected === 'object' && !Array.isArray(expected)) {
            if ('$eq' in expected) return actual === expected.$eq;
            if ('$ne' in expected) return actual !== expected.$ne;
            if ('$gt' in expected) return actual > expected.$gt;
            if ('$gte' in expected) return actual >= expected.$gte;
            if ('$lt' in expected) return actual < expected.$lt;
            if ('$lte' in expected) return actual <= expected.$lte;
            if ('$in' in expected) return expected.$in.includes(actual);
            return actual === expected;
        }
        
        return actual === expected;
    }

    // --- Value accessors ---

    _incrementSimple(stat, amount) {
        const current = this.simpleValues.get(stat) || 0;
        this.simpleValues.set(stat, current + amount);
    }

    _setMax(stat, value) {
        const current = this.simpleValues.get(stat) || 0;
        if (value > current) {
            this.simpleValues.set(stat, value);
        }
    }

    _incrementMap(stat, key, amount) {
        let map = this.mapValues.get(stat);
        if (!map) {
            map = new Map();
            this.mapValues.set(stat, map);
        }
        map.set(key, (map.get(key) || 0) + amount);
    }

    _setMapMax(stat, key, value) {
        let map = this.mapValues.get(stat);
        if (!map) {
            map = new Map();
            this.mapValues.set(stat, map);
        }
        const current = map.get(key) || 0;
        if (value > current) {
            map.set(key, value);
        }
    }

    _incrementNestedMap(stat, key1, key2, amount) {
        let outerMap = this.nestedMapValues.get(stat);
        if (!outerMap) {
            outerMap = new Map();
            this.nestedMapValues.set(stat, outerMap);
        }
        let innerMap = outerMap.get(key1);
        if (!innerMap) {
            innerMap = new Map();
            outerMap.set(key1, innerMap);
        }
        innerMap.set(key2, (innerMap.get(key2) || 0) + amount);
    }

    // --- Public getters ---

    /**
     * Get a simple stat value
     */
    get(stat) {
        if (typeof stat === 'string') {
            stat = this.manager.achievementStats.getObjectByID(stat);
        }
        if (!stat) return 0;
        return this.simpleValues.get(stat) || 0;
    }

    /**
     * Get a map stat value for a specific key
     */
    getMap(stat, key) {
        if (typeof stat === 'string') {
            stat = this.manager.achievementStats.getObjectByID(stat);
        }
        if (!stat) return 0;
        const map = this.mapValues.get(stat);
        return map ? (map.get(key) || 0) : 0;
    }

    /**
     * Get all entries from a map stat
     */
    getMapEntries(stat) {
        if (typeof stat === 'string') {
            stat = this.manager.achievementStats.getObjectByID(stat);
        }
        if (!stat) return [];
        const map = this.mapValues.get(stat);
        return map ? [...map.entries()] : [];
    }

    /**
     * Get sum of all values in a map stat
     */
    getMapTotal(stat) {
        if (typeof stat === 'string') {
            stat = this.manager.achievementStats.getObjectByID(stat);
        }
        if (!stat) return 0;
        const map = this.mapValues.get(stat);
        if (!map) return 0;
        let total = 0;
        for (const count of map.values()) {
            total += count;
        }
        return total;
    }

    /**
     * Get max value across all keys in a map stat
     */
    getMapMax(stat) {
        if (typeof stat === 'string') {
            stat = this.manager.achievementStats.getObjectByID(stat);
        }
        if (!stat) return 0;
        const map = this.mapValues.get(stat);
        if (!map) return 0;
        let max = 0;
        for (const value of map.values()) {
            if (value > max) max = value;
        }
        return max;
    }

    /**
     * Get a nested map stat value
     */
    getNested(stat, key1, key2) {
        if (typeof stat === 'string') {
            stat = this.manager.achievementStats.getObjectByID(stat);
        }
        if (!stat) return 0;
        const outerMap = this.nestedMapValues.get(stat);
        if (!outerMap) return 0;
        const innerMap = outerMap.get(key1);
        return innerMap ? (innerMap.get(key2) || 0) : 0;
    }

    /**
     * Get sum of all values for a key1 in a nested map
     */
    getNestedTotal(stat, key1) {
        if (typeof stat === 'string') {
            stat = this.manager.achievementStats.getObjectByID(stat);
        }
        if (!stat) return 0;
        const outerMap = this.nestedMapValues.get(stat);
        if (!outerMap) return 0;
        const innerMap = outerMap.get(key1);
        if (!innerMap) return 0;
        let total = 0;
        for (const count of innerMap.values()) {
            total += count;
        }
        return total;
    }

    /**
     * Get total sum of all values in a nested map
     */
    getNestedGrandTotal(stat) {
        if (typeof stat === 'string') {
            stat = this.manager.achievementStats.getObjectByID(stat);
        }
        if (!stat) return 0;
        const outerMap = this.nestedMapValues.get(stat);
        if (!outerMap) return 0;
        let total = 0;
        for (const innerMap of outerMap.values()) {
            for (const count of innerMap.values()) {
                total += count;
            }
        }
        return total;
    }

    /**
     * Get count of unique key1 values in a nested map
     */
    getNestedKeyCount(stat) {
        if (typeof stat === 'string') {
            stat = this.manager.achievementStats.getObjectByID(stat);
        }
        if (!stat) return 0;
        const outerMap = this.nestedMapValues.get(stat);
        return outerMap ? outerMap.size : 0;
    }

    // --- Serialization ---

    encode(writer) {
        // Simple stats
        const simpleEntries = [...this.simpleValues.entries()];
        writer.writeUint16(simpleEntries.length);
        for (const [stat, value] of simpleEntries) {
            writer.writeNamespacedObject(stat);
            if (stat.valueType === 'float64') {
                writer.writeFloat64(value);
            } else {
                writer.writeUint32(value);
            }
        }
        
        // Map stats
        const mapEntries = [...this.mapValues.entries()];
        writer.writeUint16(mapEntries.length);
        for (const [stat, map] of mapEntries) {
            writer.writeNamespacedObject(stat);
            const entries = [...map.entries()];
            writer.writeUint16(entries.length);
            for (const [key, value] of entries) {
                writer.writeNamespacedObject(key);
                if (stat.valueType === 'float64') {
                    writer.writeFloat64(value);
                } else {
                    writer.writeUint32(value);
                }
            }
        }
        
        // Nested map stats
        const nestedEntries = [...this.nestedMapValues.entries()];
        writer.writeUint16(nestedEntries.length);
        for (const [stat, outerMap] of nestedEntries) {
            writer.writeNamespacedObject(stat);
            const outer = [...outerMap.entries()];
            writer.writeUint16(outer.length);
            for (const [key1, innerMap] of outer) {
                writer.writeNamespacedObject(key1);
                const inner = [...innerMap.entries()];
                writer.writeUint16(inner.length);
                for (const [key2, value] of inner) {
                    writer.writeNamespacedObject(key2);
                    if (stat.valueType === 'float64') {
                        writer.writeFloat64(value);
                    } else {
                        writer.writeUint32(value);
                    }
                }
            }
        }
    }

    decode(reader, version) {
        // Simple stats
        const simpleCount = reader.getUint16();
        for (let i = 0; i < simpleCount; i++) {
            const stat = reader.getNamespacedObject(this.manager.achievementStats);
            const value = (stat && typeof stat !== 'string' && stat.valueType === 'float64')
                ? reader.getFloat64()
                : reader.getUint32();
            if (stat && typeof stat !== 'string') {
                this.simpleValues.set(stat, value);
            }
        }
        
        // Map stats
        const mapCount = reader.getUint16();
        for (let i = 0; i < mapCount; i++) {
            const stat = reader.getNamespacedObject(this.manager.achievementStats);
            const entryCount = reader.getUint16();
            const map = new Map();
            const registry = (stat && typeof stat !== 'string') ? stat.getKeyRegistry() : null;
            
            for (let j = 0; j < entryCount; j++) {
                // Keys could be from different registries, use the stat's defined registry
                const key = registry 
                    ? reader.getNamespacedObject(registry)
                    : reader.getNamespacedObject(this.manager.tags); // fallback
                const value = (stat && typeof stat !== 'string' && stat.valueType === 'float64')
                    ? reader.getFloat64()
                    : reader.getUint32();
                if (key && typeof key !== 'string') {
                    map.set(key, value);
                }
            }
            
            if (stat && typeof stat !== 'string' && map.size > 0) {
                this.mapValues.set(stat, map);
            }
        }
        
        // Nested map stats
        const nestedCount = reader.getUint16();
        for (let i = 0; i < nestedCount; i++) {
            const stat = reader.getNamespacedObject(this.manager.achievementStats);
            const outerCount = reader.getUint16();
            const outerMap = new Map();
            const registries = (stat && typeof stat !== 'string') ? stat.getKeyRegistries() : [null, null];
            
            for (let j = 0; j < outerCount; j++) {
                const key1 = registries[0] 
                    ? reader.getNamespacedObject(registries[0])
                    : reader.getNamespacedObject(this.manager.areas);
                const innerCount = reader.getUint16();
                const innerMap = new Map();
                
                for (let k = 0; k < innerCount; k++) {
                    const key2 = registries[1]
                        ? reader.getNamespacedObject(registries[1])
                        : reader.getNamespacedObject(this.manager.difficulties);
                    const value = (stat && typeof stat !== 'string' && stat.valueType === 'float64')
                        ? reader.getFloat64()
                        : reader.getUint32();
                    if (key2 && typeof key2 !== 'string') {
                        innerMap.set(key2, value);
                    }
                }
                
                if (key1 && typeof key1 !== 'string' && innerMap.size > 0) {
                    outerMap.set(key1, innerMap);
                }
            }
            
            if (stat && typeof stat !== 'string' && outerMap.size > 0) {
                this.nestedMapValues.set(stat, outerMap);
            }
        }
    }
}

export class AdventuringAchievementCategory extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._description = data.description;
        this._media = data.media;
    }

    get name() {
        return this._name;
    }

    get description() {
        return this._description;
    }

    get media() {
        return this.manager.getMediaURL(this._media);
    }
}

export class AdventuringMilestone extends NamespacedObject {
    constructor(namespace, data, achievement, manager, game) {
        // ID format: achievementLocalId_milestoneLocalId
        super(namespace, `${achievement.localID}_${data.id}`);
        this.manager = manager;
        this.game = game;
        this.achievement = achievement;
        this.localMilestoneID = data.id;

        this._name = data.name;
        this._description = data.description;
        this.requirement = data.requirement;
        this.rewards = data.rewards || [];
        this.order = data.order !== undefined ? data.order : 0;
    }

    get name() {
        return this._name;
    }

    get description() {
        return this._description;
    }
}

export class AdventuringAchievement extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._description = data.description;
        this._media = data.media;
        this.rewards = data.rewards || [];

        this.category = manager.achievementCategories.getObjectByID(data.category);

        // Support both single requirement and multi-requirement
        if (data.requirements && Array.isArray(data.requirements)) {
            this.requirements = data.requirements;
            this.requirement = data.requirements[0]; // Primary for backwards compat
        } else if (data.requirement) {
            this.requirement = data.requirement;
            this.requirements = [data.requirement];
        } else {
            this.requirement = null;
            this.requirements = [];
        }

        // Milestone chain support - milestones are registered separately
        // and linked via registerMilestones() after construction
        this._milestoneData = data.milestones || null;
        this.milestones = null;
        this._milestoneMap = null;

        // For milestone chains, track which milestones are complete
        this._completedMilestones = new Set();
    }

    /**
     * Register milestone objects (called after milestones are registered in the registry)
     */
    registerMilestones(milestoneObjects) {
        this.milestones = milestoneObjects;
        this._milestoneMap = new Map();
        for (const milestone of this.milestones) {
            this._milestoneMap.set(milestone.localMilestoneID, milestone);
        }
    }

    get name() {
        // For milestone chains, show current milestone name
        if (this.milestones) {
            const current = this.getCurrentMilestone();
            if (current) {
                return current.name;
            }
            // All complete - show final milestone
            return this.milestones[this.milestones.length - 1].name;
        }
        return this._name;
    }

    get description() {
        // For milestone chains, show current milestone description
        if (this.milestones) {
            const current = this.getCurrentMilestone();
            if (current) {
                return current.description;
            }
            return this.milestones[this.milestones.length - 1].description;
        }
        return this._description;
    }

    get media() {
        return this.manager.getMediaURL(this._media);
    }

    /**
     * Check if this is a milestone chain achievement
     */
    get isMilestoneChain() {
        return this.milestones !== null && this.milestones.length > 0;
    }

    /**
     * Get the current (incomplete) milestone, or null if all complete
     */
    getCurrentMilestone() {
        if (!this.milestones) return null;

        for (const milestone of this.milestones) {
            if (!this._completedMilestones.has(milestone)) {
                return milestone;
            }
        }
        return null; // All complete
    }

    /**
     * Get milestone by local ID
     */
    getMilestone(localId) {
        return this._milestoneMap?.get(localId) || null;
    }

    /**
     * Check if a specific milestone is complete
     */
    isMilestoneComplete(milestone) {
        return this._completedMilestones.has(milestone);
    }

    /**
     * Mark a milestone as complete (called by AchievementManager)
     */
    completeMilestone(milestone) {
        this._completedMilestones.add(milestone);
    }

    /**
     * Get all completed milestones (for serialization)
     */
    getCompletedMilestones() {
        return [...this._completedMilestones];
    }

    /**
     * Set completed milestones (for deserialization)
     */
    setCompletedMilestones(milestones) {
        this._completedMilestones = new Set(milestones);
    }

    /**
     * Get milestone chain progress info
     */
    getMilestoneProgress() {
        if (!this.milestones) return null;

        return {
            total: this.milestones.length,
            completed: this._completedMilestones.size,
            milestones: this.milestones.map(m => ({
                id: m.id,
                localMilestoneID: m.localMilestoneID,
                name: m.name,
                description: m.description,
                requirement: m.requirement,
                rewards: m.rewards,
                isComplete: this._completedMilestones.has(m),
                isCurrent: this.getCurrentMilestone() === m
            }))
        };
    }

    getProgress(reqOverride = null) {
        // For milestone chains, use current milestone's requirement if no override
        let req = reqOverride;
        if (!req && this.milestones) {
            const current = this.getCurrentMilestone();
            if (current) {
                req = current.requirement;
            }
        }
        req = req || this.requirement;
        if (!req) return 0;
        
        const stats = this.manager.achievementManager.stats;

        // Explicit stat type - direct lookup with full namespaced ID
        if (req.type === 'stat') {
            const stat = this.manager.achievementStats.getObjectByID(req.stat);
            if (!stat) {
                console.warn(`Achievement ${this.id}: stat not found: ${req.stat}`);
                return 0;
            }
            return this._getStatProgress(stat, stats, req);
        }

        // Legacy: Try to look up stat by type name (treating type as stat ID)
        const statId = `adventuring:${req.type}`;
        const stat = this.manager.achievementStats.getObjectByID(statId);
        
        if (stat) {
            return this._getStatProgress(stat, stats, req);
        }

        // Fallback to special case handling for non-stat requirements
        switch(req.type) {
            // Derived stats (computed from nested map stats)
            case 'total_clears':
                return stats.getNestedGrandTotal('adventuring:clears_by_area_difficulty');
            
            case 'heroic_clears': {
                const heroicDiff = this.manager.difficulties.getObjectByID('adventuring:heroic');
                const areaDiffStat = this.manager.achievementStats.getObjectByID('adventuring:clears_by_area_difficulty');
                if (!heroicDiff || !areaDiffStat) return 0;
                // Sum across all areas for this difficulty
                let total = 0;
                for (const area of this.manager.areas.allObjects) {
                    total += stats.getNested(areaDiffStat, area, heroicDiff) || 0;
                }
                return total;
            }
            
            case 'mythic_clears': {
                const mythicDiff = this.manager.difficulties.getObjectByID('adventuring:mythic');
                const areaDiffStat = this.manager.achievementStats.getObjectByID('adventuring:clears_by_area_difficulty');
                if (!mythicDiff || !areaDiffStat) return 0;
                // Sum across all areas for this difficulty
                let total = 0;
                for (const area of this.manager.areas.allObjects) {
                    total += stats.getNested(areaDiffStat, area, mythicDiff) || 0;
                }
                return total;
            }
            
            case 'difficulty_clears': {
                const fullDiffId = req.difficulty.includes(':') ? req.difficulty : `adventuring:${req.difficulty}`;
                const difficulty = this.manager.difficulties.getObjectByID(fullDiffId);
                const areaDiffStat = this.manager.achievementStats.getObjectByID('adventuring:clears_by_area_difficulty');
                if (!difficulty || !areaDiffStat) return 0;
                // Sum across all areas for this difficulty
                let total = 0;
                for (const area of this.manager.areas.allObjects) {
                    total += stats.getNested(areaDiffStat, area, difficulty) || 0;
                }
                return total;
            }

            case 'solo_wins':
                return stats.getNestedGrandTotal('adventuring:solo_clears');
            
            case 'solo_dungeon_clears':
                return stats.getNestedGrandTotal('adventuring:solo_clears');
            
            case 'solo_area_clears': {
                const fullAreaId = req.area.includes(':') ? req.area : `adventuring:${req.area}`;
                const area = this.manager.areas.getObjectByID(fullAreaId);
                return area ? stats.getNestedTotal('adventuring:solo_clears', area) : 0;
            }
            
            case 'solo_difficulty_clears': {
                const fullAreaId = req.area.includes(':') ? req.area : `adventuring:${req.area}`;
                const fullDiffId = req.difficulty.includes(':') ? req.difficulty : `adventuring:${req.difficulty}`;
                const area = this.manager.areas.getObjectByID(fullAreaId);
                const difficulty = this.manager.difficulties.getObjectByID(fullDiffId);
                return (area && difficulty) ? stats.getNested('adventuring:solo_clears', area, difficulty) : 0;
            }
            
            case 'unique_solo_areas': {
                return stats.getNestedKeyCount('adventuring:solo_clears');
            }

            case 'total_production': {
                // items_produced now counts everything including conversions
                return stats.get('adventuring:items_produced') || 0;
            }

            // Non-stat requirements (game state queries)
            case 'learned_abilities':
                return this.manager.learnedAbilities ? this.manager.learnedAbilities.size : 0;
            
            case 'job_level':
                if(req.job) {
                    return this._getSpecificJobLevel(req.job);
                }
                return this._getHighestJobLevel();
            
            case 'jobs_at_level':
                return this._countEntitiesAtLevel('jobs', 'all', req.level);
            
            case 'area_mastery':
                return this._getMasteryAggregate('areas', 'all', 'max');
            
            case 'job_unlocked':
                return this._isJobUnlocked(req.job) ? 1 : 0;
            
            case 'any_passive_job_level':
                return this._getMasteryAggregate('jobs', 'passive', 'max');
            
            case 'all_passive_jobs_level':
                return this._getAllPassiveJobsAtLevel(req.level) ? 1 : 0;
            
            case 'specific_job_level':
            case 'specific_passive_job_level':
                return this._getSpecificJobLevel(req.job);

            case 'area_cleared': {
                const area = this.manager.areas.getObjectByID(req.area);
                if (!area) return 0;
                return this.manager.getMasteryXP(area) > 0 ? 1 : 0;
            }

            case 'set_bonus_active':
                return this._getMaxSetBonusPieces() >= req.pieces ? 1 : 0;

            case 'unique_equipment':
                return this._getUniqueEquipmentCount();

            case 'complete_sets':
                return this._getCompleteSetsCount();

            case 'max_upgraded_equipment':
                return this._getMaxUpgradedEquipmentCount();

            case 'total_equipment_mastery':
                return this._getTotalEquipmentMastery();

            case 'highest_equipment_level':
                return this._getHighestEquipmentLevel();

            case 'monster_mastery':
                return this._getMasteryAggregate('monsters', 'all', 'max');

            case 'total_monster_mastery':
                return this._getMasteryAggregate('monsters', 'all', 'total');

            case 'boss_mastery':
                return this._getMasteryAggregate('monsters', 'boss', 'max');

            case 'total_boss_mastery':
                return this._getMasteryAggregate('monsters', 'boss', 'total');

            case 'total_area_mastery':
                return this._getMasteryAggregate('areas', 'all', 'total');

            case 'gauntlet_mastery':
                return this._getMasteryAggregate('gauntlets', 'all', 'max');

            case 'total_gauntlet_mastery':
                return this._getMasteryAggregate('gauntlets', 'all', 'total');

            case 'any_combat_job_level':
                return this._getMasteryAggregate('jobs', 'combat', 'max');

            case 'total_combat_job_mastery':
                return this._getMasteryAggregate('jobs', 'combat', 'total');

            case 'total_passive_job_mastery':
                return this._getMasteryAggregate('jobs', 'passive', 'total');

            case 'combat_jobs_at_level':
                return this._countEntitiesAtLevel('jobs', 'combat', req.level);

            case 'passive_jobs_at_level':
                return this._countEntitiesAtLevel('jobs', 'passive', req.level);

            case 'areas_at_level':
                return this._countEntitiesAtLevel('areas', 'all', req.level);

            case 'unique_combat_jobs_used': {
                // Count unique jobs from runs_by_job stat (only combat jobs)
                const runsByJobStat = this.manager.achievementStats.getObjectByID('adventuring:runs_by_job');
                if (!runsByJobStat) return 0;
                const noneJob = this.manager.cached?.noneJob;
                let count = 0;
                for (const job of this.manager.jobs.allObjects) {
                    if (job === noneJob || job.isPassive) continue;
                    if (stats.getMap(runsByJobStat, job) > 0) count++;
                }
                return count;
            }

            case 'triggered':
                // Triggered achievements don't have progress - they're complete or not
                // Check tracked progress in achievement manager
                const tracked = this.manager.achievementManager._trackedProgress.get(this.id);
                if (!tracked) return 0;
                if (tracked.type === 'set') {
                    return tracked.values.size;
                } else {
                    // Map type - count qualifying entries
                    return [...tracked.values.values()]
                        .filter(count => count >= tracked.targetPerUnique).length;
                }

            default:
                console.warn(`Achievement ${this.id}: unknown requirement type: ${req.type}`);
                return 0;
        }
    }

    /**
     * Get progress for a data-driven stat
     * @param {Object} stat - The stat definition
     * @param {AchievementStats} stats - The stats tracker
     * @param {Object} req - The requirement with optional keys
     * @returns {number}
     */
    _getStatProgress(stat, stats, req) {
        if (stat.isSimple) {
            return stats.get(stat);
        }
        if (stat.isMap) {
            // Map stat - need a key from the requirement
            if (req.tag) {
                const tag = this.manager.tags.getObjectByID(req.tag);
                return tag ? stats.getMap(stat, tag) : 0;
            }
            if (req.difficulty) {
                const difficulty = this.manager.difficulties.getObjectByID(req.difficulty);
                return difficulty ? stats.getMap(stat, difficulty) : 0;
            }
            if (req.job) {
                const job = this.manager.jobs.getObjectByID(req.job);
                return job ? stats.getMap(stat, job) : 0;
            }
            // Return aggregate if no specific key - use max for map_max, sum for others
            if (stat.aggregation === 'map_max') {
                return stats.getMapMax(stat);
            }
            return stats.getMapTotal(stat);
        }
        if (stat.isNestedMap) {
            // Nested map stat
            if (req.area && req.difficulty) {
                const area = this.manager.areas.getObjectByID(req.area);
                const difficulty = this.manager.difficulties.getObjectByID(req.difficulty);
                return (area && difficulty) ? stats.getNested(stat, area, difficulty) : 0;
            }
            if (req.area) {
                const area = this.manager.areas.getObjectByID(req.area);
                return area ? stats.getNestedTotal(stat, area) : 0;
            }
            // Return grand total
            return stats.getNestedGrandTotal(stat);
        }
        return 0;
    }

    /**
     * Generic mastery aggregate function - consolidates all mastery helpers
     * @param {string} registry - Registry name: 'areas', 'monsters', 'jobs', 'gauntlets'
     * @param {string} filter - Filter type: 'all', 'boss', 'combat', 'passive'
     * @param {string} aggregate - 'max' or 'total'
     * @returns {number}
     */
    _getMasteryAggregate(registry, filter, aggregate = 'total') {
        const cacheKey = `mastery_${registry}_${filter}_${aggregate}`;
        const cache = this.manager.achievementManager._checkCache;
        if (cache && cache[cacheKey] !== undefined) {
            return cache[cacheKey];
        }

        let result = 0;
        const collection = this.manager[registry]?.allObjects || [];
        const noneJob = this.manager.cached?.noneJob;

        for (const entity of collection) {
            // Always exclude noneJob placeholder
            if (entity === noneJob) continue;
            // Apply filter
            if (filter === 'boss' && !entity.isBoss) continue;
            if (filter === 'combat' && entity.isPassive) continue;
            if (filter === 'passive' && !entity.isPassive) continue;
            
            const mastery = this.manager.getMasteryLevel(entity) || 0;
            if (aggregate === 'max') {
                if (mastery > result) result = mastery;
            } else {
                result += mastery;
            }
        }

        if (cache) cache[cacheKey] = result;
        return result;
    }

    /**
     * Count entities at or above a target level
     * @param {string} registry - Registry name: 'jobs'
     * @param {string} filter - Filter type: 'all', 'combat', 'passive'
     * @param {number} targetLevel - Minimum level
     * @returns {number}
     */
    _countEntitiesAtLevel(registry, filter, targetLevel) {
        const cacheKey = `atLevel_${registry}_${filter}_${targetLevel}`;
        const cache = this.manager.achievementManager._checkCache;
        if (cache && cache[cacheKey] !== undefined) {
            return cache[cacheKey];
        }

        let count = 0;
        const collection = this.manager[registry]?.allObjects || [];
        const noneJob = this.manager.cached?.noneJob;

        for (const entity of collection) {
            if (entity === noneJob) continue;
            if (filter === 'combat' && entity.isPassive) continue;
            if (filter === 'passive' && !entity.isPassive) continue;
            if (!entity.unlocked) continue;
            
            const level = this.manager.getMasteryLevel(entity) || 0;
            if (level >= targetLevel) count++;
        }

        if (cache) cache[cacheKey] = count;
        return count;
    }

    _getMaxSetBonusPieces() {
        let maxPieces = 0;
        if (!this.manager.equipmentSets) return 0;

        for (const hero of this.manager.party.all) {
            for (const set of this.manager.equipmentSets.allObjects) {
                const pieces = set.countEquippedPieces(hero);
                if (pieces > maxPieces) maxPieces = pieces;
            }
        }
        return maxPieces;
    }

    _getUniqueEquipmentCount() {
        const cache = this.manager.achievementManager._checkCache;
        if(cache && cache.uniqueEquipmentCount !== undefined) {
            return cache.uniqueEquipmentCount;
        }

        let count = 0;
        for (const item of this.manager.baseItems.allObjects) {
            if (item.id !== 'adventuring:none' && item.unlocked) count++;
        }

        if(cache) cache.uniqueEquipmentCount = count;
        return count;
    }

    _getCompleteSetsCount() {
        const cache = this.manager.achievementManager._checkCache;
        if(cache && cache.completeSetsCount !== undefined) {
            return cache.completeSetsCount;
        }

        let count = 0;
        if (this.manager.equipmentSets) {
            for (const set of this.manager.equipmentSets.allObjects) {
                // A set is complete when all its items are unlocked
                const allUnlocked = set.items && set.items.length > 0 && 
                    set.items.every(item => item && item.unlocked);
                if (allUnlocked) count++;
            }
        }

        if(cache) cache.completeSetsCount = count;
        return count;
    }

    _getMaxUpgradedEquipmentCount() {
        const cache = this.manager.achievementManager._checkCache;
        if(cache && cache.maxUpgradedCount !== undefined) {
            return cache.maxUpgradedCount;
        }

        let count = 0;
        for (const item of this.manager.baseItems.allObjects) {
            if (item.id !== 'adventuring:none' && item.unlocked && item.upgradeLevel >= item.maxUpgrades) {
                count++;
            }
        }

        if(cache) cache.maxUpgradedCount = count;
        return count;
    }

    _getTotalEquipmentMastery() {
        const cache = this.manager.achievementManager._checkCache;
        if(cache && cache.totalEquipmentMastery !== undefined) {
            return cache.totalEquipmentMastery;
        }

        let total = 0;
        for (const item of this.manager.baseItems.allObjects) {
            if (item.id !== 'adventuring:none' && item.unlocked) {
                total += item.upgradeLevel || 0;
            }
        }

        if(cache) cache.totalEquipmentMastery = total;
        return total;
    }

    _getHighestEquipmentLevel() {
        const cache = this.manager.achievementManager._checkCache;
        if(cache && cache.highestEquipmentLevel !== undefined) {
            return cache.highestEquipmentLevel;
        }

        let highest = 0;
        for (const item of this.manager.baseItems.allObjects) {
            if (item.id !== 'adventuring:none' && item.unlocked && item.upgradeLevel > highest) {
                highest = item.upgradeLevel;
            }
        }

        if(cache) cache.highestEquipmentLevel = highest;
        return highest;
    }

    getTarget(req = null) {
        // For milestone chains, use current milestone's requirement if no override
        if (!req && this.milestones) {
            const current = this.getCurrentMilestone();
            if (current) {
                req = current.requirement;
            }
        }
        // If no req provided, use primary requirement
        req = req || this.requirement;
        if (!req) return 1;

        if(req.level !== undefined) return req.level;

        if(req.type === 'all_passive_jobs_level')
            return this.manager.passiveJobs.length || 1;
        if(req.type === 'job_unlocked' || req.type === 'area_cleared' || req.type === 'set_bonus_active') {
            return 1;
        }
        if(req.type === 'triggered') {
            // Triggered achievements complete on trigger, target is 1
            return req.targetUniqueCount || 1;
        }
        return req.target || 1;
    }

    isComplete() {
        return this.manager.achievementManager.completedAchievements.has(this);
    }

    /**
     * Check if the achievement/milestone requirements are met
     * For milestone chains, checks the current milestone
     * For multi-requirements, uses AND logic
     */
    isMet() {
        // For milestone chains, check current milestone
        if (this.milestones) {
            const current = this.getCurrentMilestone();
            if (!current) {
                // All milestones complete
                return true;
            }
            return this._checkRequirement(current.requirement);
        }

        // For multi-requirements, all must be met (AND logic)
        if (this.requirements.length > 1) {
            return this.requirements.every(req => this._checkRequirement(req));
        }

        // Single requirement
        return this.getProgress() >= this.getTarget();
    }

    /**
     * Check if a single requirement is met
     * @param {Object} req - The requirement to check
     * @returns {boolean}
     */
    _checkRequirement(req) {
        if (!req) return true;

        // Triggered requirements are handled by the trigger system
        if (req.type === 'triggered') {
            return false; // Not met until triggered
        }

        const progress = this.getProgress(req);
        const target = this.getTarget(req);
        return progress >= target;
    }

    /**
     * Get progress for multi-requirement achievements (array of progress info)
     */
    getRequirementsProgress() {
        return this.requirements.map(req => ({
            requirement: req,
            progress: this.getProgress(req),
            target: this.getTarget(req),
            isMet: this._checkRequirement(req)
        }));
    }

    getProgressPercent() {
        // For milestone chains, show chain progress
        if (this.milestones) {
            const current = this.getCurrentMilestone();
            if (!current) return 100; // All complete
            
            const progress = this.getProgress(current.requirement);
            const target = this.getTarget(current.requirement);
            return Math.min(100, Math.floor((progress / target) * 100));
        }

        // For multi-requirement, show lowest progress percentage
        if (this.requirements.length > 1) {
            let minPercent = 100;
            for (const req of this.requirements) {
                const progress = this.getProgress(req);
                const target = this.getTarget(req);
                const percent = Math.floor((progress / target) * 100);
                if (percent < minPercent) minPercent = percent;
            }
            return Math.min(100, minPercent);
        }

        return Math.min(100, Math.floor((this.getProgress() / this.getTarget()) * 100));
    }

    _getHighestJobLevel() {
        const cache = this.manager.achievementManager._checkCache;
        if(cache && cache.highestJobLevel !== undefined) {
            return cache.highestJobLevel;
        }

        let highest = 0;
        const noneJob = this.manager.cached.noneJob;
        for(const job of this.manager.jobs.allObjects) {
            if(job === noneJob || !job.unlocked) continue;
            const level = job.level || 0;
            if(level > highest) highest = level;
        }

        if(cache) cache.highestJobLevel = highest;
        return highest;
    }

    _isJobUnlocked(jobId) {
        const cache = this.manager.achievementManager._checkCache;
        const cacheKey = `jobUnlocked_${jobId}`;
        if(cache && cache[cacheKey] !== undefined) {
            return cache[cacheKey];
        }

        const job = this.manager.jobs.getObjectByID(jobId);
        if(!job) {
            if(cache) cache[cacheKey] = false;
            return false;
        }
        if(!job.requirements || job.requirements.length === 0) {
            if(cache) cache[cacheKey] = true;
            return true;
        }

        for(const req of job.requirements) {
            if(req.type === 'skill_level') {
                if(this.manager.level < req.level) {
                    if(cache) cache[cacheKey] = false;
                    return false;
                }
            }
            if(req.type === 'job_level') {
                const prereqJob = this.manager.jobs.getObjectByID(req.job);
                if(!prereqJob) {
                    if(cache) cache[cacheKey] = false;
                    return false;
                }
                if(this.manager.getMasteryLevel(prereqJob) < req.level) {
                    if(cache) cache[cacheKey] = false;
                    return false;
                }
            }
        }

        if(cache) cache[cacheKey] = true;
        return true;
    }

    _areAllJobsUnlockedAtTier(tier) {
        const cache = this.manager.achievementManager._checkCache;
        const cacheKey = `allJobsTier_${tier}`;
        if(cache && cache[cacheKey] !== undefined) {
            return cache[cacheKey];
        }

        const noneJob = this.manager.cached.noneJob;
        const tierJobs = this.manager.jobs.allObjects.filter(job =>
            job !== noneJob && job.tier === tier
        );
        if(tierJobs.length === 0) {
            if(cache) cache[cacheKey] = false;
            return false;
        }
        const result = tierJobs.every(job => this._isJobUnlocked(job.id));

        if(cache) cache[cacheKey] = result;
        return result;
    }

    _getAllPassiveJobsAtLevel(targetLevel) {
        const cache = this.manager.achievementManager._checkCache;
        const cacheKey = `allPassiveJobsAtLevel_${targetLevel}`;
        if(cache && cache[cacheKey] !== undefined) {
            return cache[cacheKey];
        }

        const noneJob = this.manager.cached.noneJob;
        const passiveJobs = this.manager.jobs.allObjects.filter(job =>
            job !== noneJob && job.isPassive && job.unlocked
        );
        if(passiveJobs.length === 0) {
            if(cache) cache[cacheKey] = false;
            return false;
        }
        const result = passiveJobs.every(job => {
            const level = this.manager.getMasteryLevel(job) || 0;
            return level >= targetLevel;
        });

        if(cache) cache[cacheKey] = result;
        return result;
    }

    _getSpecificJobLevel(jobId) {
        const job = this.manager.jobs.getObjectByID(jobId);
        if(!job || !job.unlocked) return 0;
        return this.manager.getMasteryLevel(job) || 0;
    }

    getRewardsText() {
        const { getEffectDescriptionsList } = loadModule('src/core/utils/adventuring-utils.mjs');
        const parts = [];
        for(const reward of this.rewards) {
            switch(reward.type) {
                case 'currency':
                    parts.push(`${reward.qty} Gold`);
                    break;
                case 'material':
                    const mat = this.manager.materials.getObjectByID(reward.id);
                    if(mat) parts.push(`${reward.qty}x ${mat.name}`);
                    break;
                case 'effect':
                    const descs = getEffectDescriptionsList(reward.effects, this.manager);
                    for(const desc of descs) {
                        parts.push(`${desc} (permanent)`);
                    }
                    break;
                case 'ability':
                    const ability = this.manager.getAbilityByID(reward.id);
                    if(ability) parts.push(`Unlock: ${ability.name}`);
                    break;
            }
        }
        return parts.join(', ');
    }

    getAbilityReward() {
        const abilityReward = this.rewards.find(r => r.type === 'ability');
        if(!abilityReward) return null;
        return this.manager.getAbilityByID(abilityReward.id);
    }
}

export class AchievementManager {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.renderQueue = new AdventuringAchievementRenderQueue();

        this.stats = new AchievementStats(manager);

        this.completedAchievements = new Set();

        this._needsCheck = false;

        // Trigger cache: Map<triggerType, Set<Achievement>>
        this._triggerCache = new Map();
        this._triggerCacheBuilt = false;

        // Tracked achievement progress: Map<achievementId, trackingData>
        this._trackedProgress = new Map();

        // Register with conductor to receive all triggers
        // We listen for all events since achievements can trigger on any event type
        this.manager.conductor.listen('*', (type, context) => this._handleTrigger(type, context));
    }

    onLoad() {
        // Build trigger cache after data is loaded
        this._buildTriggerCache();
    }

    /**
     * Handler called by conductor for all trigger events
     * @param {string} type - The trigger type
     * @param {object} context - Trigger context
     */
    _handleTrigger(type, context) {
        // Process stats for this trigger (does NOT require immediate achievement check)
        if (this.stats) {
            this.stats.processTrigger(type, context);
        }

        // Check triggered achievements
        if (!this._triggerCacheBuilt) {
            this._buildTriggerCache();
        }

        const candidates = this._triggerCache.get(type);
        if (!candidates || candidates.size === 0) {
            return;
        }

        for (const achievement of candidates) {
            if (achievement.isComplete()) {
                continue;
            }

            // For milestone chains, get current milestone's requirement
            let req;
            let isMilestone = false;
            if (achievement.isMilestoneChain) {
                const milestone = achievement.getCurrentMilestone();
                if (!milestone) continue;
                req = milestone.requirement;
                isMilestone = true;
            } else {
                req = achievement.requirement;
            }

            // Check conditions if present
            if (req.conditions && !this._meetsConditions(req.conditions, context)) {
                continue;
            }

            // Handle tracked/unique achievements
            if (req.trackUnique) {
                this._processTrackedTrigger(achievement, req, context, isMilestone);
            } else {
                // Simple trigger - complete immediately
                if (isMilestone) {
                    this._completeMilestone(achievement, achievement.getCurrentMilestone());
                } else {
                    this.completeAchievement(achievement);
                }
            }
        }
    }

    /**
     * Build cache of achievements by their trigger type for O(1) lookup
     */
    _buildTriggerCache() {
        this._triggerCache.clear();

        for (const achievement of this.manager.achievements.allObjects) {
            // Check regular triggered requirements
            const req = achievement.requirement;
            if (req?.type === 'triggered' && req.event) {
                if (!this._triggerCache.has(req.event)) {
                    this._triggerCache.set(req.event, new Set());
                }
                this._triggerCache.get(req.event).add(achievement);
            }

            // Also check milestone chains for triggered milestones
            if (achievement.isMilestoneChain) {
                for (const milestone of achievement.milestones) {
                    const mReq = milestone.requirement;
                    if (mReq?.type === 'triggered' && mReq.event) {
                        if (!this._triggerCache.has(mReq.event)) {
                            this._triggerCache.set(mReq.event, new Set());
                        }
                        this._triggerCache.get(mReq.event).add(achievement);
                    }
                }
            }
        }

        this._triggerCacheBuilt = true;
    }

    /**
     * Remove an achievement from the trigger cache (called when completed)
     * @param {AdventuringAchievement} achievement 
     */
    _removeFromTriggerCache(achievement) {
        const req = achievement.requirement;
        if (req?.type === 'triggered' && req.event) {
            const cached = this._triggerCache.get(req.event);
            if (cached) {
                cached.delete(achievement);
            }
        }
        // Also remove from milestone trigger events
        if (achievement.isMilestoneChain) {
            for (const milestone of achievement.milestones) {
                const mReq = milestone.requirement;
                if (mReq?.type === 'triggered' && mReq.event) {
                    const cached = this._triggerCache.get(mReq.event);
                    if (cached) {
                        cached.delete(achievement);
                    }
                }
            }
        }
    }

    /**
     * Handle a trigger event from the game.
     * DEPRECATED: Call conductor.trigger() directly instead.
     * This method forwards to the conductor for backward compatibility.
     * @param {string} triggerType - The type of trigger (e.g., 'kill', 'dungeon_end')
     * @param {Object} context - Context including encounterStats, runStats, etc.
     */
    trigger(triggerType, context = {}) {
        // Forward to conductor - this will call back to _handleTrigger
        this.manager.conductor.trigger(triggerType, context);
    }

    /**
     * Process a tracked/unique trigger (e.g., "clear with each job")
     * @param {AdventuringAchievement} achievement 
     * @param {Object} req - The requirement object
     * @param {Object} context - Trigger context
     * @param {boolean} isMilestone - Whether this is a milestone trigger
     */
    _processTrackedTrigger(achievement, req, context, isMilestone = false) {
        const uniqueKey = this._getNestedValue(context, req.trackUnique);
        if (uniqueKey === undefined || uniqueKey === null) {
            return;
        }

        // Get or create tracking data for this achievement
        let trackingData = this._trackedProgress.get(achievement.id);
        if (!trackingData) {
            const targetPerUnique = req.targetPerUnique || 1;
            if (targetPerUnique === 1) {
                trackingData = { type: 'set', values: new Set() };
            } else {
                trackingData = { type: 'map', values: new Map(), targetPerUnique };
            }
            this._trackedProgress.set(achievement.id, trackingData);
        }

        // Record the unique value
        if (trackingData.type === 'set') {
            trackingData.values.add(uniqueKey);
        } else {
            const current = trackingData.values.get(uniqueKey) || 0;
            trackingData.values.set(uniqueKey, current + 1);
        }

        // Check completion
        const targetUniqueCount = req.targetUniqueCount || 1;
        let qualifyingCount;

        if (trackingData.type === 'set') {
            qualifyingCount = trackingData.values.size;
        } else {
            qualifyingCount = [...trackingData.values.values()]
                .filter(count => count >= trackingData.targetPerUnique).length;
        }

        if (qualifyingCount >= targetUniqueCount) {
            if (isMilestone) {
                this._completeMilestone(achievement, achievement.getCurrentMilestone());
            } else {
                this.completeAchievement(achievement);
            }
        }
    }

    /**
     * Check if conditions are met
     * @param {Object} conditions - Condition object with dot-notation paths and values/operators
     * @param {Object} context - The context to check against
     * @returns {boolean}
     */
    _meetsConditions(conditions, context) {
        if (!conditions) return true;

        for (const [path, expected] of Object.entries(conditions)) {
            const actual = this._getNestedValue(context, path);

            if (!this._compareValues(actual, expected)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get a nested value from an object using dot notation
     * @param {Object} obj - The object to traverse
     * @param {string} path - Dot-separated path (e.g., "runStats.damageTaken")
     * @returns {*} The value at the path, or undefined
     */
    _getNestedValue(obj, path) {
        if (!obj || !path) return undefined;

        return path.split('.').reduce((current, key) => {
            if (current === undefined || current === null) return undefined;
            
            // Handle Map objects
            if (current instanceof Map) {
                return current.get(key);
            }
            // Handle Set objects (check membership)
            if (current instanceof Set) {
                return current.has(key);
            }
            return current[key];
        }, obj);
    }

    /**
     * Compare values, supporting operators
     * @param {*} actual - The actual value from context
     * @param {*} expected - The expected value or operator object
     * @returns {boolean}
     */
    _compareValues(actual, expected) {
        if (expected === null || expected === undefined) {
            return actual === expected;
        }

        // Object with operators (MongoDB-style)
        if (typeof expected === 'object' && !Array.isArray(expected)) {
            if ('$eq' in expected) return actual === expected.$eq;
            if ('$ne' in expected) return actual !== expected.$ne;
            if ('$gt' in expected) return actual > expected.$gt;
            if ('$gte' in expected) return actual >= expected.$gte;
            if ('$lt' in expected) return actual < expected.$lt;
            if ('$lte' in expected) return actual <= expected.$lte;
            if ('$in' in expected) return expected.$in.includes(actual);
            if ('$nin' in expected) return !expected.$nin.includes(actual);
            // If no operators, it might be an entity reference comparison
            return actual === expected;
        }

        // Direct comparison
        return actual === expected;
    }

    /**
     * Get effects from completed achievements and milestones.
     * @param {Object} filters - Optional filter object { trigger, type, stat, target, party }
     * @returns {Array} Array of normalized effects with source metadata
     */
    getEffects(filters = {}) {
        const effects = [];

        // Effects from fully completed achievements
        for(const achievement of this.completedAchievements) {
            for(const reward of achievement.rewards) {
                if(reward.type === 'effect') {

                    for(const effect of reward.effects) {
                        effects.push({
                            ...effect,
                            trigger: effect.trigger || 'passive',
                            value: effect.value ?? effect.amount ?? 0,
                            id: `achievement:${achievement.localID}:${effect.type}:${effect.stat || ''}`,
                            sourcePath: [{ type: 'achievement', name: achievement.name, ref: achievement }]
                        });
                    }
                }
            }
        }

        // Effects from completed milestones (even if achievement not fully complete)
        for(const achievement of this.manager.achievements.allObjects) {
            if (!achievement.isMilestoneChain) continue;

            for(const milestone of achievement.milestones) {
                if (!achievement.isMilestoneComplete(milestone)) continue;

                for(const reward of milestone.rewards) {
                    if(reward.type === 'effect') {
                        for(const effect of reward.effects) {
                            effects.push({
                                ...effect,
                                trigger: effect.trigger || 'passive',
                                value: effect.value ?? effect.amount ?? 0,
                                id: `milestone:${milestone.id}:${effect.type}:${effect.stat || ''}`,
                                sourcePath: [
                                    { type: 'achievement', name: achievement.name, ref: achievement },
                                    { type: 'milestone', name: milestone.name, ref: milestone }
                                ]
                            });
                        }
                    }
                }
            }
        }

        // Apply filters if provided
        if (filters && typeof filters === 'object' && Object.keys(filters).length > 0) {
            const { filterEffects } = this.manager.utils || {};
            if (filterEffects) {
                return filterEffects(effects, filters);
            }
            // Fallback simple trigger filter
            if (filters.trigger) {
                return effects.filter(e => e.trigger === filters.trigger);
            }
        }

        return effects;
    }

    // Legacy alias for backwards compatibility
    getAchievementEffects() {
        return this.getEffects();
    }

    rebuildBonuses() {
        // Invalidate party cache so it picks up new achievement bonuses
        if(this.manager.party?.effectCache) {
            this.manager.party.invalidateEffects('achievements');
        }
    }

    getStatBonus(statId) {
        let total = 0;
        for(const achievement of this.completedAchievements) {
            for(const reward of achievement.rewards) {
                if(reward.type === 'effect') {
                    for(const effect of reward.effects) {
                        if(effect.type === 'stat_flat' && effect.stat === statId) {
                            total += effect.amount;
                        }
                    }
                }
            }
        }
        return total;
    }

    get unlockedAbilities() {
        const abilities = new Set();
        for(const achievement of this.completedAchievements) {
            const ability = achievement.getAbilityReward();
            if(ability) {
                abilities.add(ability.id);
            }
        }
        return abilities;
    }

    isAbilityUnlocked(abilityId) {
        for(const achievement of this.completedAchievements) {
            const ability = achievement.getAbilityReward();
            if(ability && ability.id === abilityId) {
                return true;
            }
        }
        return false;
    }

    getAbilitySource(abilityId) {
        // Check all achievements (not just completed) to find which one grants this ability
        for(const achievement of this.manager.achievements.allObjects) {
            const ability = achievement.getAbilityReward();
            if(ability && ability.id === abilityId) {
                return achievement;
            }
        }
        return null;
    }

    markDirty() {
        this._needsCheck = true;
    }

    checkIfDirty() {
        if(this._needsCheck) {
            // During offline progress, throttle achievement checks heavily
            // since they're expensive and rarely complete mid-offline
            if(loadingOfflineProgress) {
                // Only check every 100 dirty marks during offline
                this._offlineCheckCounter = (this._offlineCheckCounter || 0) + 1;
                if(this._offlineCheckCounter < 100) {
                    return;
                }
                this._offlineCheckCounter = 0;
            }
            this._needsCheck = false;
            this.checkAchievements();
        }
    }

    checkAchievements() {
        let newCompletions = false;

        this._checkCache = {};

        for(const achievement of this.manager.achievements.allObjects) {
            if(achievement.isComplete()) continue;

            // Skip triggered achievements - they complete via _handleTrigger, not polling
            if(achievement.requirement?.type === 'triggered' && !achievement.isMilestoneChain) continue;

            // Handle milestone chain achievements
            if(achievement.isMilestoneChain) {
                const milestone = achievement.getCurrentMilestone();
                if(!milestone) continue;
                // Skip if current milestone is triggered
                if(milestone.requirement?.type === 'triggered') continue;
                if(achievement.isMet()) {
                    this._completeMilestone(achievement, milestone);
                    newCompletions = true;
                }
            } else {
                // Regular achievement
                if(achievement.isMet()) {
                    this.completeAchievement(achievement);
                    newCompletions = true;
                }
            }
        }

        this._checkCache = null;

        if(newCompletions) {
            this.renderQueue.completed = true;
        }
    }

    /**
     * Complete a milestone within a milestone chain achievement
     * @param {AdventuringAchievement} achievement 
     * @param {AdventuringMilestone} milestone 
     */
    _completeMilestone(achievement, milestone) {
        if(achievement.isMilestoneComplete(milestone)) return;

        // Mark milestone as complete
        achievement.completeMilestone(milestone);

        // Grant milestone rewards
        for(const reward of milestone.rewards) {
            this.grantReward(reward);
        }

        // Notify player
        if(typeof notifyPlayer === 'function' && !loadingOfflineProgress) {
            notifyPlayer(this.manager, `Milestone Complete: ${milestone.name}`, 'success');
        }

        // Check if all milestones are now complete
        if(achievement.getCurrentMilestone() === null) {
            // All milestones done - complete the overall achievement
            this.completeAchievement(achievement);
        } else {
            // More milestones to go - just update render queue
            this.renderQueue.progress = true;
        }
    }

    completeAchievement(achievement) {
        if(this.completedAchievements.has(achievement)) return;

        this.completedAchievements.add(achievement);

        // Remove from trigger cache
        this._removeFromTriggerCache(achievement);

        // Clean up tracked progress
        if (this._trackedProgress.has(achievement.id)) {
            this._trackedProgress.delete(achievement.id);
        }

        // Grant top-level rewards (for non-milestone or when entire chain complete)
        for(const reward of achievement.rewards) {
            this.grantReward(reward);
        }

        this.rebuildBonuses();

        if(typeof notifyPlayer === 'function' && !loadingOfflineProgress) {
            notifyPlayer(this.manager, `Achievement Unlocked: ${achievement.name}`, 'success');
        }

        this.renderQueue.completed = true;
    }

    grantReward(reward) {
        switch(reward.type) {
            case 'currency':
                const currency = this.manager.materials.getObjectByID(reward.id);
                if(currency) {
                    this.manager.stash.add(currency, reward.qty);
                }
                break;

            case 'material':
                const material = this.manager.materials.getObjectByID(reward.id);
                if(material) {
                    this.manager.stash.add(material, reward.qty);
                }
                break;

            case 'ability':
                // Abilities are handled by the requirement system - they check milestone completion
                // Just mark that the ability should now be available
                if (this.manager.learnedAbilities) {
                    this.manager.learnedAbilities.add(reward.id);
                }
                break;

            case 'effect':
                // Effects are handled passively via getEffects() on completed achievements/milestones
                // No action needed - rebuildBonuses() will pick them up
                break;

            case 'title':
                // Titles are cosmetic - could be tracked if needed
                // For now, just log it
                console.log(`Title unlocked: ${reward.id}`);
                break;
        }
    }

    getAchievementsByCategory(category) {
        return this.manager.achievements.allObjects.filter(a => a.category === category);
    }

    getCompletionStats() {
        const total = this.manager.achievements.allObjects.length;
        const completed = this.completedAchievements.size;
        return { total, completed, percent: Math.floor((completed / total) * 100) };
    }

    resetAll() {
        this.stats = new AchievementStats(this.manager);

        this.completedAchievements.clear();
        
        // Clear tracked progress for triggered achievements
        this._trackedProgress.clear();
        
        // Reset milestone progress on all milestone chain achievements
        for (const achievement of this.manager.achievements.allObjects) {
            if (achievement.isMilestoneChain) {
                achievement._completedMilestones.clear();
            }
        }

        this.rebuildBonuses();
        this._buildTriggerCache();

        this.renderQueue.completed = true;
    }

    encode(writer) {
        this.stats.encode(writer);

        writer.writeSet(this.completedAchievements, (achievement, w) => {
            w.writeNamespacedObject(achievement);
        });

        // Encode tracked progress for triggered achievements
        // Filter to only achievements that still exist
        const validTrackedProgress = [...this._trackedProgress.entries()]
            .filter(([achievementId]) => this.manager.achievements.getObjectByID(achievementId));
        
        writer.writeUint16(validTrackedProgress.length);
        for (const [achievementId, trackingData] of validTrackedProgress) {
            const achievement = this.manager.achievements.getObjectByID(achievementId);
            writer.writeNamespacedObject(achievement);
            writer.writeBoolean(trackingData.type === 'set');

            if (trackingData.type === 'set') {
                // Set type: tracked unique objects (e.g., bosses killed)
                // Values are NamespacedObjects like Monster
                const values = [...trackingData.values].filter(v => typeof v === 'object' && v?.id);
                writer.writeArray(values, (v, w) => w.writeNamespacedObject(v));
            } else {
                // Map type: write targetPerUnique and map entries
                writer.writeUint8(trackingData.targetPerUnique);
                const entries = [...trackingData.values.entries()].filter(([k]) => typeof k === 'object' && k?.id);
                writer.writeArray(entries, ([k, v], w) => {
                    w.writeNamespacedObject(k);
                    w.writeUint32(v);
                });
            }
        }

        // Encode milestone progress for milestone chain achievements
        const milestoneAchievements = this.manager.achievements.allObjects
            .filter(a => a.isMilestoneChain && a._completedMilestones.size > 0);
        writer.writeUint16(milestoneAchievements.length);
        for (const achievement of milestoneAchievements) {
            writer.writeNamespacedObject(achievement);
            const milestones = achievement.getCompletedMilestones();
            writer.writeArray(milestones, (milestone, w) => w.writeNamespacedObject(milestone));
        }
    }

    decode(reader, version) {

        this.stats.decode(reader, version);

        reader.getSet((r) => {
            const achievement = r.getNamespacedObject(this.manager.achievements);
            if (achievement && typeof achievement !== 'string') {
                this.completedAchievements.add(achievement);
            }
        });

        const trackedCount = reader.getUint16();
        for (let i = 0; i < trackedCount; i++) {
            const achievement = reader.getNamespacedObject(this.manager.achievements);
            const isSet = reader.getBoolean();

            // Use achievement.id as key if valid, otherwise skip
            const achievementId = (achievement && typeof achievement !== 'string') ? achievement.id : null;

            if (isSet) {
                const values = [];
                reader.getArray((r) => {
                    const obj = r.getNamespacedObject(game.monsters);
                    if (obj && typeof obj !== 'string') {
                        values.push(obj);
                    }
                });
                if (achievementId) {
                    this._trackedProgress.set(achievementId, {
                        type: 'set',
                        values: new Set(values)
                    });
                }
            } else {
                const targetPerUnique = reader.getUint8();
                const entries = [];
                reader.getArray((r) => {
                    const k = r.getNamespacedObject(game.monsters);
                    const v = r.getUint32();
                    if (k && typeof k !== 'string') {
                        entries.push([k, v]);
                    }
                });
                if (achievementId) {
                    this._trackedProgress.set(achievementId, {
                        type: 'map',
                        values: new Map(entries),
                        targetPerUnique
                    });
                }
            }
        }

        // Decode milestone progress for milestone chain achievements
        const milestoneCount = reader.getUint16();
        for (let i = 0; i < milestoneCount; i++) {
            const achievement = reader.getNamespacedObject(this.manager.achievements);
            const milestones = [];
            reader.getArray((r) => {
                const milestone = r.getNamespacedObject(this.manager.achievementMilestones);
                if (milestone && typeof milestone !== 'string') {
                    milestones.push(milestone);
                }
            });
            if (achievement && typeof achievement !== 'string') {
                achievement.setCompletedMilestones(milestones);
            }
        }

        this.rebuildBonuses();
        this._buildTriggerCache();
    }
}
