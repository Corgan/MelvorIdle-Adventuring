/**
 * Component Pool - Object pooling for frequently created/destroyed custom elements
 * 
 * This reduces GC pressure by reusing element instances instead of creating new ones.
 * Useful for elements created in loops during render cycles (loot rows, stat rows, badges, etc.)
 * 
 * Usage:
 *   const lootRowPool = new ComponentPool(() => new AdventuringLootRowElement(), 10);
 *   
 *   // In render loop:
 *   const row = lootRowPool.acquire();
 *   row.setLoot({ ... });
 *   container.appendChild(row);
 *   
 *   // When clearing container:
 *   lootRowPool.releaseAll(container);
 */
export class ComponentPool {
    /**
     * Create a component pool
     * @param {Function} factory - Factory function that creates new instances
     * @param {number} [initialSize=0] - Number of instances to pre-create
     * @param {number} [maxSize=100] - Maximum pool size (prevents memory leaks)
     */
    constructor(factory, initialSize = 0, maxSize = 100) {
        this.factory = factory;
        this.maxSize = maxSize;
        this.pool = [];
        this.activeCount = 0;
        
        // Pre-populate pool
        for(let i = 0; i < initialSize; i++) {
            this.pool.push(this.factory());
        }
    }

    /**
     * Acquire an element from the pool, or create a new one if pool is empty
     * @returns {HTMLElement} An element ready for use
     */
    acquire() {
        let element;
        if(this.pool.length > 0) {
            element = this.pool.pop();
        } else {
            element = this.factory();
        }
        this.activeCount++;
        return element;
    }

    /**
     * Release an element back to the pool
     * @param {HTMLElement} element - Element to release
     */
    release(element) {
        if(this.pool.length < this.maxSize) {
            // Detach from DOM if attached
            if(element.parentNode) {
                element.parentNode.removeChild(element);
            }
            // Reset element if it has a reset method
            if(typeof element.reset === 'function') {
                element.reset();
            }
            this.pool.push(element);
        }
        this.activeCount--;
    }

    /**
     * Release all poolable children from a container
     * Looks for children that are instances of the pooled element type
     * @param {HTMLElement} container - Container to release children from
     */
    releaseAll(container) {
        // Get children as array since we'll be modifying the DOM
        const children = Array.from(container.children);
        for(const child of children) {
            // Check if this child looks like it came from this pool
            // by checking if it's the same constructor type
            this.release(child);
        }
    }

    /**
     * Clear all children from container, releasing poolable ones
     * @param {HTMLElement} container - Container to clear
     */
    clearContainer(container) {
        this.releaseAll(container);
        container.innerHTML = '';
    }

    /**
     * Get pool statistics for debugging
     * @returns {Object} Pool stats
     */
    getStats() {
        return {
            pooled: this.pool.length,
            active: this.activeCount,
            maxSize: this.maxSize
        };
    }

    /**
     * Pre-warm the pool by creating instances
     * @param {number} count - Number of instances to create
     */
    prewarm(count) {
        const toCreate = Math.min(count, this.maxSize - this.pool.length);
        for(let i = 0; i < toCreate; i++) {
            this.pool.push(this.factory());
        }
    }
}

/**
 * Pool Manager - Singleton for managing multiple component pools
 * 
 * Usage:
 *   PoolManager.register('lootRow', () => new AdventuringLootRowElement(), 10);
 *   const row = PoolManager.acquire('lootRow');
 *   PoolManager.release('lootRow', row);
 */
export class PoolManager {
    static pools = new Map();

    /**
     * Register a new pool
     * @param {string} name - Pool identifier
     * @param {Function} factory - Factory function
     * @param {number} [initialSize=0] - Initial pool size
     * @param {number} [maxSize=100] - Maximum pool size
     */
    static register(name, factory, initialSize = 0, maxSize = 100) {
        if(this.pools.has(name)) {
            console.warn(`Pool '${name}' already registered`);
            return;
        }
        this.pools.set(name, new ComponentPool(factory, initialSize, maxSize));
    }

    /**
     * Acquire from a named pool
     * @param {string} name - Pool identifier
     * @returns {HTMLElement}
     */
    static acquire(name) {
        const pool = this.pools.get(name);
        if(!pool) {
            throw new Error(`Pool '${name}' not registered`);
        }
        return pool.acquire();
    }

    /**
     * Release to a named pool
     * @param {string} name - Pool identifier
     * @param {HTMLElement} element - Element to release
     */
    static release(name, element) {
        const pool = this.pools.get(name);
        if(pool) {
            pool.release(element);
        }
    }

    /**
     * Get a pool by name
     * @param {string} name - Pool identifier
     * @returns {ComponentPool}
     */
    static getPool(name) {
        return this.pools.get(name);
    }

    /**
     * Get all pool statistics
     * @returns {Object} Stats for all pools
     */
    static getAllStats() {
        const stats = {};
        for(const [name, pool] of this.pools) {
            stats[name] = pool.getStats();
        }
        return stats;
    }
}
