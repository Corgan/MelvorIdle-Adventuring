const { loadModule } = mod.getContext(import.meta);

const { AdventuringItemBase } = await loadModule('src/adventuring-item-base.mjs');
const { AdventuringEquipmentItem } = await loadModule('src/adventuring-equipment-item.mjs');

export class AdventuringLootGenerator {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
    }

    generateFromBase(base, min, max, rolledLevel=-1) {
        let baseItem = base instanceof AdventuringItemBase ? base : this.manager.baseItems.registeredObjects.get(base);
        
        if(baseItem !== undefined) {
            let item = new AdventuringEquipmentItem(this.manager, this.game);
            item.base = baseItem;

            let availableSuffixes = this.manager.suffixes.allObjects.filter(suffix => {
                if(suffix.tier != baseItem.tier)
                    return false;
                if(!suffix.types.includes(baseItem.type))
                    return false;
                return true;
            });
            let suffix = availableSuffixes[Math.floor(Math.random() * availableSuffixes.length)];

            item.suffix = suffix;

            this.distributeStats(item.stats, suffix.stats, min, max, rolledLevel);
            return item;
        }
        return false;
    }

    distributeStats(itemStats, suffixStats, min, max, rolledLevel=-1) {
        let levelCount = suffixStats.length;
        let avg_min = Math.floor(min / levelCount);

        suffixStats.forEach(statID => {
            let stat = this.manager.stats.getObjectByID(statID);
            itemStats.set(stat, avg_min);
        });

        let toDistribute = rolledLevel !== -1 ? rolledLevel - (avg_min * levelCount) : Math.floor(Math.random() * (max - (avg_min * levelCount)));

        while(toDistribute > 0) {
            let statID = suffixStats[Math.floor(Math.random() * suffixStats.length)];
            let stat = this.manager.stats.getObjectByID(statID);
            itemStats.set(stat, itemStats.get(stat) + 1);
            toDistribute--;
        }
    }
}