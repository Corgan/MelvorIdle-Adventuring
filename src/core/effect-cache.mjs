/**
 * Provides caching with dependency-based invalidation.
 */
export class EffectCache {
    constructor() {
        this._cache = new Map();
        this._dirtyDependencies = new Set();
    }

    get(key) {
        const entry = this._cache.get(key);
        if (!entry) return undefined;

        if (entry.dependencies) {
            for (const dep of entry.dependencies) {
                if (this._dirtyDependencies.has(dep)) {
                    this._cache.delete(key);
                    return undefined;
                }
            }
        }

        return entry.value;
    }

    set(key, value, dependencies = []) {
        this._cache.set(key, { value, dependencies });
    }

    invalidateDependency(dependency) {
        this._dirtyDependencies.add(dependency);
    }

    clearInvalidated() {
        this._dirtyDependencies.clear();
    }

    clear() {
        this._cache.clear();
        this._dirtyDependencies.clear();
    }

    invalidateAll() {
        this._cache.clear();
        this._dirtyDependencies.clear();
    }

    has(key) {
        return this._cache.has(key) && this.get(key) !== undefined;
    }

    delete(key) {
        this._cache.delete(key);
    }

    size() {
        return this._cache.size;
    }
}
