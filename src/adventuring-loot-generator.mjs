const { loadModule } = mod.getContext(import.meta);

const { AdventuringEquipmentItem } = await loadModule('src/adventuring-equipment-item.mjs');

export class AdventuringLootGenerator {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
    }

    generateFromBase(base, min, max) {
        let baseItem = base instanceof EquipmentItem ? base : this.game.items.equipment.registeredObjects.get(base);
        
        if(baseItem !== undefined) {
            let item = new AdventuringEquipmentItem(this.manager, this.game);
            item.base = baseItem;

            let availableSuffixes = this.manager.suffixes.allObjects.filter(suffix => suffix.items.includes(item.base.id));
            let suffix = availableSuffixes[Math.floor(Math.random() * availableSuffixes.length)];

            item.name = base.name;
            if(suffix)
                item.name = item.name + ' ' + suffix.name;

            item.levels = this.distributeLevels(suffix.levels, min, max);
            return item;
        }
        return false;
    }

    distributeLevels(levels, min, max) {
        let levelCount = levels.length;
        let avg_min = Math.floor(min / levelCount);

        let levelsMap = new Map();
        levels.forEach(skill => {
            levelsMap.set(skill, avg_min);
        });

        let toDistribute = Math.floor(Math.random() * (max - (avg_min * levelCount)));
        while(toDistribute > 0) {
            let skill = levels[Math.floor(Math.random() * levels.length)];
            levelsMap.set(skill, levelsMap.get(skill) + 1);
            toDistribute--;
        }
        
        return levelsMap;
    }
}