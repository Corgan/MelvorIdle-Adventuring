const { loadModule } = mod.getContext(import.meta);

/**
 * Represents a trackable achievement statistic.
 * Stats are NamespacedObjects that define how to aggregate data from triggers.
 */
export class AdventuringAchievementStat extends NamespacedObject {
    constructor(namespace, data, manager) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = manager.game;

        this._name = data.name;
        this._description = data.description || '';
        this._media = data.media;
        this._category = data.category || 'general';

        // Triggers this stat listens to
        this.triggers = data.triggers || [];

        // Aggregation type: count, sum, max, set, map_count, map_sum, nested_map_count
        this.aggregation = data.aggregation || 'count';

        // Path to extract value from context (for sum/max)
        this.valuePath = data.valuePath || null;

        // Path(s) to extract key(s) from context (for map/set types)
        this.keyPath = data.keyPath || null;

        // Registry name(s) for resolving keys to NamespacedObjects
        this.keyRegistry = data.keyRegistry || null;
        this.keyRegistries = data.keyRegistries || null;

        // Whether to expand array keys (e.g., monster.tags becomes multiple increments)
        this.expandKeys = data.expandKeys || false;

        // Conditions that must be met for this stat to record
        this.conditions = data.conditions || null;

        // Value type for serialization: 'uint32' (default) or 'float64' (for large totals)
        this.valueType = data.valueType || 'uint32';

        // Display settings
        this.displayFormat = data.displayFormat || 'number'; // number, percentage, time
        this.showInGlobalStats = data.showInGlobalStats !== false;
    }

    get name() {
        return this._name;
    }

    get description() {
        return this._description;
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    get category() {
        return this._category;
    }

    getMediaURL(path) {
        if (!path) return cdnMedia('assets/media/main/statistics_header.png');
        if (path.startsWith('assets/')) return this.manager.getMediaURL(path);
        return path;
    }

    /**
     * Check if this stat is a simple numeric stat (count/sum/max)
     */
    get isSimple() {
        return ['count', 'sum', 'max'].includes(this.aggregation);
    }

    /**
     * Check if this stat uses a single-level map
     */
    get isMap() {
        return ['map_count', 'map_sum', 'set'].includes(this.aggregation);
    }

    /**
     * Check if this stat uses a nested map
     */
    get isNestedMap() {
        return this.aggregation === 'nested_map_count';
    }

    /**
     * Get the registry for resolving map keys
     */
    getKeyRegistry() {
        if (!this.keyRegistry) return null;
        return this.manager[this.keyRegistry] || null;
    }

    /**
     * Get registries for nested map keys
     */
    getKeyRegistries() {
        if (!this.keyRegistries || !Array.isArray(this.keyRegistries)) return [];
        return this.keyRegistries.map(name => this.manager[name] || null);
    }
}
