
export class ComponentPool {

    constructor(factory, initialSize = 0, maxSize = 100) {
        this.factory = factory;
        this.maxSize = maxSize;
        this.pool = [];
        this.activeCount = 0;
        this.elementConstructor = null; // Lazy initialized on first acquire
        for(let i = 0; i < initialSize; i++) {
            const element = this.factory();
            if(!this.elementConstructor) {
                this.elementConstructor = element.constructor;
            }
            this.pool.push(element);
        }
    }

    acquire() {
        let element;
        if(this.pool.length > 0) {
            element = this.pool.pop();
        } else {
            element = this.factory();
            if(!this.elementConstructor) {
                this.elementConstructor = element.constructor;
            }
        }
        this.activeCount++;
        return element;
    }

    release(element) {
        if(this.pool.length < this.maxSize) {
            if(element.parentNode) {
                element.parentNode.removeChild(element);
            }
            if(typeof element.reset === 'function') {
                element.reset();
            }
            this.pool.push(element);
        }
        this.activeCount--;
    }

    releaseAll(container) {
        if(!this.elementConstructor) return;
        const children = Array.from(container.children);
        for(const child of children) {
            if(child.constructor === this.elementConstructor) {
                this.release(child);
            }
        }
    }

    clearContainer(container) {
        this.releaseAll(container);
        container.innerHTML = '';
    }

    getStats() {
        return {
            pooled: this.pool.length,
            active: this.activeCount,
            maxSize: this.maxSize
        };
    }

    prewarm(count) {
        const toCreate = Math.min(count, this.maxSize - this.pool.length);
        for(let i = 0; i < toCreate; i++) {
            this.pool.push(this.factory());
        }
    }
}

export class PoolManager {
    static pools = new Map();

    static register(name, factory, initialSize = 0, maxSize = 100) {
        if(this.pools.has(name)) {
            console.warn(`Pool '${name}' already registered`);
            return;
        }
        this.pools.set(name, new ComponentPool(factory, initialSize, maxSize));
    }

    static acquire(name) {
        const pool = this.pools.get(name);
        if(!pool) {
            throw new Error(`Pool '${name}' not registered`);
        }
        return pool.acquire();
    }

    static release(name, element) {
        const pool = this.pools.get(name);
        if(pool) {
            pool.release(element);
        }
    }

    static getPool(name) {
        return this.pools.get(name);
    }

    static getAllStats() {
        const stats = {};
        for(const [name, pool] of this.pools) {
            stats[name] = pool.getStats();
        }
        return stats;
    }
}
