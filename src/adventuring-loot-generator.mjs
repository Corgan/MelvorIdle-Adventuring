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
                if(baseItem.material !== undefined && !suffix.materials.includes(baseItem.material))
                    return false;
                return true;
            });
            let suffix = availableSuffixes[Math.floor(Math.random() * availableSuffixes.length)];

            item.name = baseItem.name;
            if(suffix)
                item.name = item.name + ' ' + suffix.name;

            item.levels = this.distributeLevels(suffix.levels, min, max, rolledLevel);
            return item;
        }
        return false;
    }

    distributeLevels(levels, min, max, rolledLevel=-1) {
        let levelCount = levels.length;
        let avg_min = Math.floor(min / levelCount);

        let levelsMap = new Map();
        levels.forEach(skill => {
            levelsMap.set(skill, avg_min);
        });

        let toDistribute = rolledLevel !== -1 ? rolledLevel - (avg_min * levelCount) : Math.floor(Math.random() * (max - (avg_min * levelCount)));
        
        while(toDistribute > 0) {
            let skill = levels[Math.floor(Math.random() * levels.length)];
            levelsMap.set(skill, levelsMap.get(skill) + 1);
            toDistribute--;
        }
        
        return levelsMap;
    }
}