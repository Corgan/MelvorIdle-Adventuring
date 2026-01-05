const { loadModule } = mod.getContext(import.meta);

/**
 * Represents an equipment set with piece bonuses
 * Equipment sets provide bonuses when multiple pieces are equipped
 */
export class AdventuringEquipmentSet extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        
        // Array of item IDs that belong to this set
        this._itemIds = data.items || [];
        this.items = []; // Resolved in postDataRegistration
        
        // Bonuses at different piece counts
        // { pieces: number, description: string, effects: StandardEffect[] }
        this.bonuses = data.bonuses || [];
    }

    get name() {
        return this._name;
    }

    /**
     * Resolve item references after all items are registered
     */
    postDataRegistration() {
        this.items = this._itemIds.map(id => this.manager.baseItems.getObjectByID(id)).filter(item => item);
        
        // Set the set reference on each item (actual object, not just ID)
        this.items.forEach(item => {
            if(item) {
                item.set = this;
            }
        });
    }

    /**
     * Count how many pieces of this set a character has equipped
     * @param {AdventuringCharacter} character - The character to check
     * @returns {number} Number of equipped pieces
     */
    countEquippedPieces(character) {
        if(!character || !character.equipment) return 0;
        
        let count = 0;
        character.equipment.slots.forEach(slot => {
            // slot.item is the AdventuringItemBase directly (or none item)
            // Check if this item is in the set's items array
            if(slot.item && this.items.includes(slot.item)) {
                count++;
            }
        });
        return count;
    }

    /**
     * Get all active bonuses for a character based on equipped pieces
     * @param {AdventuringCharacter} character - The character to check
     * @returns {Array} Array of active bonus objects
     */
    getActiveBonuses(character) {
        const equippedCount = this.countEquippedPieces(character);
        return this.bonuses.filter(bonus => equippedCount >= bonus.pieces);
    }

    /**
     * Get all effects from active bonuses as StandardEffect format
     * @param {AdventuringCharacter} character - The character to check
     * @returns {Array} Array of StandardEffect objects
     */
    getActiveEffects(character) {
        const activeBonuses = this.getActiveBonuses(character);
        const effects = [];
        
        activeBonuses.forEach(bonus => {
            if(bonus.effects) {
                bonus.effects.forEach(effect => {
                    effects.push({
                        ...effect,
                        source: 'equipment_set',
                        sourceName: `${this.name} (${bonus.pieces}pc)`
                    });
                });
            }
        });
        
        return effects;
    }

    /**
     * Check if an item belongs to this set
     * @param {AdventuringItemBase} item - The item to check
     * @returns {boolean} True if item is part of this set
     */
    hasItem(item) {
        return this.items.includes(item);
    }

    /**
     * Get the next bonus tier info for UI display
     * @param {number} currentPieces - Currently equipped pieces
     * @returns {Object|null} Next bonus info or null if at max
     */
    getNextBonusTier(currentPieces) {
        for(const bonus of this.bonuses) {
            if(bonus.pieces > currentPieces) {
                return {
                    piecesNeeded: bonus.pieces - currentPieces,
                    bonus: bonus
                };
            }
        }
        return null;
    }
}
