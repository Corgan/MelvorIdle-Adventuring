const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { filterEffects } = await loadModule('src/core/utils/adventuring-utils.mjs');

/**
 * Base class for managing tiered items with charges (consumables, tavern drinks).
 * Provides common charge management, equip/unequip, and effect retrieval functionality.
 */
export class AdventuringTieredItemManager extends AdventuringPage {
    constructor(manager, game, options = {}) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        
        // Charge storage: Map<item, Map<tier, count>>
        this.charges = new Map();
        
        // Max equipped slots (configurable per subclass)
        this.maxEquipped = options.maxEquipped || 3;
        
        // Effect source name for cache invalidation
        this.effectSourceName = options.effectSourceName || 'tieredItems';
        
        // Selected item/tier for UI
        this.selectedItem = null;
        this.selectedTier = 1;
    }

    // ==================== Charge Management ====================

    /**
     * Get charges for a specific item and tier
     * @param {Object} item - The item object
     * @param {number} tier - The tier level
     * @returns {number} Current charge count
     */
    getCharges(item, tier) {
        const itemKey = this._getItemKey(item);
        const tierMap = this.charges.get(itemKey);
        if (!tierMap) return 0;
        return tierMap.get(tier) || 0;
    }

    /**
     * Get total charges across all tiers for an item
     * @param {Object} item - The item object
     * @returns {number} Total charge count
     */
    getTotalCharges(item) {
        const itemKey = this._getItemKey(item);
        const tierMap = this.charges.get(itemKey);
        if (!tierMap) return 0;
        let total = 0;
        for (const count of tierMap.values()) {
            total += count;
        }
        return total;
    }

    /**
     * Add charges to an item tier
     * @param {Object} item - The item object
     * @param {number} tier - The tier level
     * @param {number} amount - Amount to add
     */
    addCharges(item, tier, amount) {
        const itemKey = this._getItemKey(item);
        let tierMap = this.charges.get(itemKey);
        if (!tierMap) {
            tierMap = new Map();
            this.charges.set(itemKey, tierMap);
        }

        const current = tierMap.get(tier) || 0;
        tierMap.set(tier, current + amount);

        this._onChargesChanged(item, tier);
    }

    /**
     * Remove charges from an item tier
     * @param {Object} item - The item object
     * @param {number} tier - The tier level
     * @param {number} amount - Amount to remove
     */
    removeCharges(item, tier, amount) {
        const itemKey = this._getItemKey(item);
        const tierMap = this.charges.get(itemKey);
        if (!tierMap) return;

        const current = tierMap.get(tier) || 0;
        const newCharges = Math.max(current - amount, 0);
        tierMap.set(tier, newCharges);

        // Auto-unequip if charges depleted
        const equippedTier = this.getEquippedTier(item);
        if (newCharges <= 0 && equippedTier === tier) {
            this.unequip(item);
        }

        this._onChargesChanged(item, tier);
    }

    /**
     * Reset all charges
     */
    resetCharges() {
        this.charges.clear();
        this._clearEquipped();
        this.selectedItem = null;
        this.selectedTier = 1;
        this.renderQueue.queueAll();
    }

    // ==================== Equip/Unequip (Abstract) ====================

    /**
     * Check if item is equipped
     * @abstract
     * @param {Object} item - The item object
     * @returns {boolean}
     */
    isEquipped(item) {
        throw new Error('isEquipped must be implemented by subclass');
    }

    /**
     * Get the equipped tier for an item
     * @abstract
     * @param {Object} item - The item object
     * @returns {number} The tier level, or 0 if not equipped
     */
    getEquippedTier(item) {
        throw new Error('getEquippedTier must be implemented by subclass');
    }

    /**
     * Get count of currently equipped items
     * @abstract
     * @returns {number}
     */
    getEquippedCount() {
        throw new Error('getEquippedCount must be implemented by subclass');
    }

    /**
     * Check if can equip another item
     * @param {Object} item - The item to potentially equip
     * @returns {boolean}
     */
    canEquip(item) {
        if (this.getEquippedCount() >= this.maxEquipped && !this.isEquipped(item)) {
            return false;
        }
        return true;
    }

    /**
     * Equip an item at a specific tier
     * @abstract
     * @param {Object} item - The item object
     * @param {number} tier - The tier level
     * @returns {boolean} Whether equip succeeded
     */
    equip(item, tier) {
        throw new Error('equip must be implemented by subclass');
    }

    /**
     * Unequip an item
     * @abstract
     * @param {Object} item - The item object
     * @returns {boolean} Whether unequip succeeded
     */
    unequip(item) {
        throw new Error('unequip must be implemented by subclass');
    }

    /**
     * Clear all equipped items
     * @abstract
     */
    _clearEquipped() {
        throw new Error('_clearEquipped must be implemented by subclass');
    }

    // ==================== Effects ====================

    /**
     * Get effects from all equipped items
     * @abstract
     * @param {Object} filters - Effect filters
     * @returns {Array} Filtered effects
     */
    getEffects(filters = { trigger: 'passive' }) {
        throw new Error('getEffects must be implemented by subclass');
    }

    /**
     * Invalidate effects after changes
     */
    invalidateEffects() {
        this.manager.party.invalidateAllEffects(this.effectSourceName);
        this.manager.overview.renderQueue.buffs = true;
    }

    // ==================== Item Key Management ====================

    /**
     * Get a unique key for an item (for Map storage)
     * Subclasses can override if items use different key strategies
     * @param {Object} item - The item object
     * @returns {string|Object} The key to use in Maps
     */
    _getItemKey(item) {
        return item; // Default: use item object directly
    }

    /**
     * Resolve an item from a key
     * @param {string|Object} key - The key from the Map
     * @returns {Object} The item object
     */
    _resolveItem(key) {
        return key; // Default: key is the item
    }

    // ==================== Callbacks ====================

    /**
     * Called when charges change for an item
     * @param {Object} item - The item object
     * @param {number} tier - The tier that changed
     */
    _onChargesChanged(item, tier) {
        if (item.renderQueue) {
            item.renderQueue.updateAll();
        }
        this.renderQueue.queueAll();
        
        // Check if this affects equipped item
        const equippedTier = this.getEquippedTier(item);
        if (equippedTier === tier) {
            this.invalidateEffects();
        }
    }

    // ==================== Encode/Decode Helpers ====================

    /**
     * Encode charges to writer
     * @param {Writer} writer - The save writer
     * @param {Function} writeItem - Function to write item reference
     */
    encodeCharges(writer, writeItem) {
        writer.writeUint32(this.charges.size);
        for (const [itemKey, tierMap] of this.charges) {
            const item = this._resolveItem(itemKey);
            writeItem(writer, item);
            writer.writeUint32(tierMap.size);
            for (const [tier, count] of tierMap) {
                writer.writeUint8(tier);
                writer.writeUint32(count);
            }
        }
    }

    /**
     * Decode charges from reader
     * @param {Reader} reader - The save reader
     * @param {Function} readItem - Function to read item reference
     */
    decodeCharges(reader, readItem) {
        this.charges.clear();
        const chargesCount = reader.getUint32();
        for (let i = 0; i < chargesCount; i++) {
            const item = readItem(reader);
            const tierCount = reader.getUint32();
            const tierMap = new Map();
            for (let j = 0; j < tierCount; j++) {
                const tier = reader.getUint8();
                const count = reader.getUint32();
                tierMap.set(tier, count);
            }
            if (item && typeof item !== 'string') {
                const itemKey = this._getItemKey(item);
                this.charges.set(itemKey, tierMap);
            }
        }
    }
}
