const { loadModule } = mod.getContext(import.meta);

export class AdventuringEquipmentSet extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;

        this._itemIds = data.items || [];
        this.items = []; // Resolved in postDataRegistration


        this.bonuses = data.bonuses || [];

        // Order position for sorting (processed by manager._buildAllSortOrders)
        this.orderPosition = data.orderPosition;
        this.sortOrder = 9999;  // Default high value, set by _buildAllSortOrders
    }

    get name() {
        return this._name;
    }

    postDataRegistration() {
        this.items = this._itemIds.map(id => this.manager.baseItems.getObjectByID(id)).filter(item => item);

        this.items.forEach(item => {
            if(item) {
                item.set = this;
            }
        });
    }

    countEquippedPieces(character) {
        if(!character || !character.equipment) return 0;

        const setCounts = character.equipment.getSetPieceCounts();
        return setCounts.get(this) || 0;
    }

    getActiveBonuses(character) {
        const equippedCount = this.countEquippedPieces(character);
        return this.bonuses.filter(bonus => equippedCount >= bonus.pieces);
    }

    getActiveEffects(character) {
        const activeBonuses = this.getActiveBonuses(character);
        const effects = [];

        activeBonuses.forEach(bonus => {
            if(bonus.effects) {
                bonus.effects.forEach(effect => {
                    const effectObj = {
                        ...effect,
                        // 2-level sourcePath: parent set name, child tier bonus
                        sourcePath: [
                            { type: 'equipmentSet', name: this.name, ref: this },
                            { type: 'setBonus', name: `${bonus.pieces}pc Bonus`, ref: this }
                        ]
                    };
                    // Preserve getAmount and getStacks methods if they exist
                    if (typeof effect.getAmount === 'function') {
                        effectObj.getAmount = effect.getAmount.bind(effect);
                    }
                    if (typeof effect.getStacks === 'function') {
                        effectObj.getStacks = effect.getStacks.bind(effect);
                    }
                    effects.push(effectObj);
                });
            }
        });

        return effects;
    }

    hasItem(item) {
        return this.items.includes(item);
    }

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
