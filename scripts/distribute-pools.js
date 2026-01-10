const fs = require('fs');
const path = require('path');

const itemsDir = 'c:/Users/Corga/melvor/adventuring/data/items';
const areasDir = 'c:/Users/Corga/melvor/adventuring/data/areas';

// Slot names for set detection
const slotNames = ['helm', 'platebody', 'platelegs', 'gauntlets', 'sabatons', 'shield',
                   'cowl', 'vest', 'chaps', 'vambraces', 'boots', 'body', 'coif',
                   'hat', 'robes', 'bottoms', 'mitts', 'slippers', 'gloves',
                   'dagger', 'sword', 'sword1h', 'sword2h', 'battleaxe', 'scimitar', 'mace', 'polearm', 'hammer2h', 'warhammer',
                   'shortbow', 'longbow', 'crossbow', 'knives', 'javelin', 'throwing', 'bow',
                   'wand', 'staff', 'orb', 'scepter', 'buckler', 'quiver', 'spellbook', 'tome', 'grimoire', 'codex',
                   'amulet', 'ring', 'cape', 'greatsword', 'tunic', 'skirt'];

function getSetName(itemId) {
    for (const slot of slotNames) {
        if (itemId.endsWith('_' + slot)) return itemId.replace('_' + slot, '');
    }
    return itemId;
}

// All tier distributions
const distributions = {
    // Tier 3: 9 dungeons
    3: {
        giants_plateau: { sets: ['giant', 'adamant'], name: "Giant's Plateau" },
        golbin_fortress: { sets: ['rune'], name: 'Golbin Fortress' },
        dragons_lair: { sets: ['dragon_slayer', 'red_dhide', 'yew'], name: "Dragon's Lair" },
        underwater_ruins: { sets: ['blue_dhide', 'magic'], name: 'Underwater Ruins' },
        pirate_cove: { sets: ['battlemage', 'master', 'reinforced_steel'], name: 'Pirate Cove' },
        haunted_catacombs: { sets: ['arcane', 'archmage', 'scholars'], name: 'Haunted Catacombs' },
        knights_fortress: { sets: ['adamant'], name: "Knight's Fortress" },
        elemental_plane: { sets: ['frost'], name: 'Elemental Plane' },
        frozen_wastes: { sets: ['frost', 'rune'], name: 'Frozen Wastes' }
    },
    // Tier 4: 7 dungeons
    4: {
        vampire_crypt: { sets: ['ancient', 'ancient_dhide', 'ancient_2h', 'ancient_wizard'], name: 'Vampire Crypt' },
        ancient_forest: { sets: ['dragon', 'dragon_2h', 'redwood'], name: 'Ancient Forest' },
        dragons_peak: { sets: ['dragon', 'black_dhide'], name: "Dragon's Peak" },
        crystal_caverns: { sets: ['elemental', 'stormcaller'], name: 'Crystal Caverns' },
        abyssal_depths: { sets: ['terran', 'tempered_mithril'], name: 'Abyssal Depths' },
        celestial_sanctum: { sets: ['tomb_guardian', 'adepts'], name: 'Celestial Sanctum' },
        mummys_tomb: { sets: ['inferno', 'earthshaker'], name: "Mummy's Tomb" }
    },
    // Tier 5: 8 dungeons
    5: {
        holy_grounds: { sets: ['celestial', 'celestial_dhide', 'starweave'], name: 'Holy Grounds' },
        earth_temple: { sets: ['legendary', 'legendary_dhide', 'legendary_2h', 'legendary_wizard'], name: 'Earth Temple' },
        shadow_temple: { sets: ['shadowbane', 'voidwalker'], name: 'Shadow Temple' },
        demons_domain: { sets: ['mistweaver', 'mist'], name: "Demon's Domain" },
        air_temple: { sets: ['mist', 'mist_2h', 'elderwood'], name: 'Air Temple' },
        void_citadel: { sets: ['voidwalker', 'legendary'], name: 'Void Citadel' },
        primordial_forge: { sets: ['forged_adamant', 'experts'], name: 'Primordial Forge' },
        water_temple: { sets: ['legendary', 'mist'], name: 'Water Temple' }
    },
    // Tier 6: 2 dungeons
    6: {
        eternal_colosseum: { sets: ['void', 'celestial', 'enchanted_rune', 'archmages'], name: 'Eternal Colosseum' },
        fire_temple: { sets: ['abyssal', 'shadowstep', 'abyssal_skirt'], name: 'Fire Temple' }
    },
    // Tier 7-8: Realm of Chaos
    7: {
        realm_of_chaos: { sets: ['depths'], name: 'Realm of Chaos' }
    },
    8: {
        realm_of_chaos: { sets: ['forge'], name: 'Realm of Chaos' }
    },
    // Tier 9: Into the Mist
    9: {
        into_the_mist: { sets: ['arena'], name: 'Into the Mist' }
    }
};

// Process each tier
for (let tier = 3; tier <= 9; tier++) {
    const tierPath = path.join(itemsDir, 'tier' + tier + '.json');
    const tierContent = fs.readFileSync(tierPath, 'utf8');
    const tierJson = JSON.parse(tierContent);
    const items = tierJson.data.skillData[0].data.baseItems || [];
    const droppedItems = items.filter(i => i.requirements?.some(r => r.type === 'dropped'));
    
    const dist = distributions[tier];
    const newPools = [];
    
    for (const [dungeon, config] of Object.entries(dist)) {
        const poolItems = [];
        for (const item of droppedItems) {
            const setName = getSetName(item.id);
            if (config.sets.includes(setName)) {
                poolItems.push('adventuring:' + item.id);
            }
        }
        if (poolItems.length > 0) {
            newPools.push({
                id: 'tier' + tier + '_' + dungeon,
                name: config.name + ' Drops (T' + tier + ')',
                items: poolItems
            });
        }
    }
    
    // Replace pools
    tierJson.data.skillData[0].data.equipmentPools = newPools;
    fs.writeFileSync(tierPath, JSON.stringify(tierJson, null, 4));
    console.log('Tier ' + tier + ': Created ' + newPools.length + ' pools');
}

// Now update area files
for (let tier = 3; tier <= 9; tier++) {
    const dist = distributions[tier];
    const oldPoolId = 'adventuring:tier' + tier + '_drops';
    
    for (const [dungeon, config] of Object.entries(dist)) {
        const areaPath = path.join(areasDir, dungeon + '.json');
        if (!fs.existsSync(areaPath)) continue;
        
        const areaContent = fs.readFileSync(areaPath, 'utf8');
        const areaJson = JSON.parse(areaContent);
        const monsters = areaJson.data?.skillData?.[0]?.data?.monsters;
        if (!monsters) continue;
        
        const newPoolId = 'adventuring:tier' + tier + '_' + dungeon;
        
        for (const monster of monsters) {
            if (!monster.loot) monster.loot = [];
            
            // Remove old generic pool
            monster.loot = monster.loot.filter(l => 
                !(l.type === 'equipment_pool' && l.pool === oldPoolId)
            );
            
            // Add new pool if not present
            const hasPool = monster.loot.some(l => 
                l.type === 'equipment_pool' && l.pool === newPoolId
            );
            
            if (!hasPool) {
                const isBoss = monster.tags?.includes('boss') || 
                              monster.id?.includes('king') || monster.id?.includes('leader') ||
                              monster.id?.includes('elder') || monster.id?.includes('lord') ||
                              monster.id?.includes('dragon');
                
                monster.loot.push({
                    type: 'equipment_pool',
                    pool: newPoolId,
                    chance: isBoss ? 0.15 : 0.03
                });
            }
        }
        
        fs.writeFileSync(areaPath, JSON.stringify(areaJson, null, 4));
    }
}

console.log('\nAll tiers updated!');
