/**
 * Script to generate missing items for even distribution
 * Run with: node adventuring/scripts/generate_missing_items.js
 */

const fs = require('fs');
const path = require('path');

// Tier-specific upgrade materials
const upgradeMaterials = {
    tier1: {
        "1": ["adventuring:feather"],
        "4": ["adventuring:hay_bundle"],
        "7": ["adventuring:golbin_ear"]
    },
    tier2: {
        "1": ["adventuring:golbin_ear", "adventuring:spider_silk"],
        "4": ["adventuring:bone_fragment"],
        "7": ["adventuring:bandits_coin"]
    },
    tier3: {
        "1": ["adventuring:vampire_fang"],
        "4": ["adventuring:giants_toe"],
        "7": ["adventuring:dragon_scale"]
    },
    tier4: {
        "1": ["adventuring:ancient_wrappings"],
        "4": ["adventuring:mist_shard"],
        "7": ["adventuring:elder_dragon_heart"]
    },
    tier5: {
        "1": ["adventuring:void_essence"],
        "4": ["adventuring:titan_fragment"],
        "7": ["adventuring:abyssal_crystal"]
    }
};

// Tier prefixes for naming
const tierPrefixes = {
    tier1: ['bronze'],
    tier2: ['iron', 'steel', 'mithril'],
    tier3: ['adamant', 'rune'],
    tier4: ['dragon', 'ancient'],
    tier5: ['mist', 'legendary']
};

// Stat scaling per tier (based on existing patterns)
const statScaling = {
    tier1: { multiplier: 1, hp: 0, currency: 50 },
    tier2: { multiplier: 2, hp: 0, currency: 150 },
    tier3: { multiplier: 3.5, hp: 0, currency: 400 },
    tier4: { multiplier: 5, hp: 10, currency: 800 },
    tier5: { multiplier: 8, hp: 20, currency: 1500 }
};

// Within-tier scaling (e.g., iron < steel < mithril)
const prefixScaling = {
    tier1: [1.0],
    tier2: [1.0, 1.5, 2.0],
    tier3: [1.0, 1.4],
    tier4: [1.0, 1.4],
    tier5: [1.0, 1.35]
};

// Media assets
const media = {
    mace: "melvor:assets/media/bank/weapon_mace_dragon.png",
    polearm: "melvor:assets/media/bank/weapon_halberd.png",
    hammer2h: "melvor:assets/media/bank/weapon_ancient_claw.png",
    orb: "melvor:assets/media/bank/rune_air.png",
    knives: "melvor:assets/media/bank/weapon_throwingknife_steel.png",
    javelin: "melvor:assets/media/bank/weapon_javelin_steel.png",
    crossbow: "melvor:assets/media/bank/weapon_crossbow_steel.png",
    amulet: "melvor:assets/media/bank/amulet_of_strength.png",
    ring: "melvor:assets/media/bank/ring_gold_topaz.png",
    cape: "melvor:assets/media/bank/cape_of_completion.png"
};

// Name templates
const nameTemplates = {
    mace: "{prefix} Mace",
    polearm: "{prefix} Polearm",
    hammer2h: "{prefix} Warhammer",
    orb: "{prefix} Orb",
    knives: "{prefix} Knives",
    javelin: "{prefix} Javelin",
    crossbow: "{prefix} Crossbow",
    amulet: "{prefix} Amulet",
    ring: "{prefix} Ring",
    cape: "{prefix} Cape"
};

// Base stat templates per item type
const baseStats = {
    // 2H Heavy weapons - pure STR
    mace: (tier, scale) => {
        const base = Math.round(9 * statScaling[tier].multiplier * scale);
        return {
            base: [{ id: "adventuring:strength", amount: base }],
            scaling: [{ id: "adventuring:strength", amount: Math.round(base * 0.11 * 10) / 10 }]
        };
    },
    polearm: (tier, scale) => {
        const base = Math.round(9 * statScaling[tier].multiplier * scale);
        const def = Math.round(3 * statScaling[tier].multiplier * scale);
        return {
            base: [
                { id: "adventuring:strength", amount: base },
                { id: "adventuring:defence", amount: def }
            ],
            scaling: [
                { id: "adventuring:strength", amount: Math.round(base * 0.11 * 10) / 10 },
                { id: "adventuring:defence", amount: Math.round(def * 0.1 * 10) / 10 }
            ]
        };
    },
    hammer2h: (tier, scale) => {
        const base = Math.round(10 * statScaling[tier].multiplier * scale);
        return {
            base: [{ id: "adventuring:strength", amount: base }],
            scaling: [{ id: "adventuring:strength", amount: Math.round(base * 0.12 * 10) / 10 }]
        };
    },
    // Magic offhand
    orb: (tier, scale) => {
        const mag = Math.round(5 * statScaling[tier].multiplier * scale);
        const pra = Math.round(3 * statScaling[tier].multiplier * scale);
        return {
            base: [
                { id: "adventuring:magic", amount: mag },
                { id: "adventuring:prayer", amount: pra }
            ],
            scaling: [
                { id: "adventuring:magic", amount: Math.round(mag * 0.12 * 10) / 10 },
                { id: "adventuring:prayer", amount: Math.round(pra * 0.1 * 10) / 10 }
            ]
        };
    },
    // Ranged weapons
    knives: (tier, scale) => {
        const agi = Math.round(2 * statScaling[tier].multiplier * scale);
        const str = Math.round(2 * statScaling[tier].multiplier * scale);
        return {
            base: [
                { id: "adventuring:agility", amount: agi },
                { id: "adventuring:strength", amount: str }
            ],
            scaling: [
                { id: "adventuring:agility", amount: Math.round(agi * 0.25 * 10) / 10 },
                { id: "adventuring:strength", amount: Math.round(str * 0.25 * 10) / 10 }
            ]
        };
    },
    javelin: (tier, scale) => {
        const agi = Math.round(3 * statScaling[tier].multiplier * scale);
        const str = Math.round(1 * statScaling[tier].multiplier * scale);
        return {
            base: [
                { id: "adventuring:agility", amount: agi },
                { id: "adventuring:strength", amount: str }
            ],
            scaling: [
                { id: "adventuring:agility", amount: Math.round(agi * 0.25 * 10) / 10 },
                { id: "adventuring:strength", amount: Math.round(str * 0.25 * 10) / 10 }
            ]
        };
    },
    crossbow: (tier, scale) => {
        const agi = Math.round(2 * statScaling[tier].multiplier * scale);
        const rng = Math.round(3 * statScaling[tier].multiplier * scale);
        return {
            base: [
                { id: "adventuring:agility", amount: agi },
                { id: "adventuring:ranged", amount: rng }
            ],
            scaling: [
                { id: "adventuring:agility", amount: Math.round(agi * 0.18 * 10) / 10 },
                { id: "adventuring:ranged", amount: Math.round(rng * 0.07 * 10) / 10 }
            ]
        };
    },
    // Accessories - varied builds per prefix
    amulet: (tier, scale, variant) => {
        const base = Math.round(3 * statScaling[tier].multiplier * scale);
        const hp = Math.round(statScaling[tier].hp * scale);
        const variants = {
            0: { // Strength focused
                base: hp > 0 ? [
                    { id: "adventuring:hitpoints", amount: hp },
                    { id: "adventuring:strength", amount: base }
                ] : [{ id: "adventuring:strength", amount: base }],
                scaling: hp > 0 ? [
                    { id: "adventuring:hitpoints", amount: Math.round(hp * 0.1 * 10) / 10 },
                    { id: "adventuring:strength", amount: Math.round(base * 0.1 * 10) / 10 }
                ] : [{ id: "adventuring:strength", amount: Math.round(base * 0.1 * 10) / 10 }]
            },
            1: { // Magic focused
                base: hp > 0 ? [
                    { id: "adventuring:hitpoints", amount: hp },
                    { id: "adventuring:magic", amount: base }
                ] : [{ id: "adventuring:magic", amount: base }],
                scaling: hp > 0 ? [
                    { id: "adventuring:hitpoints", amount: Math.round(hp * 0.1 * 10) / 10 },
                    { id: "adventuring:magic", amount: Math.round(base * 0.1 * 10) / 10 }
                ] : [{ id: "adventuring:magic", amount: Math.round(base * 0.1 * 10) / 10 }]
            },
            2: { // HP focused (for extra prefixes)
                base: [{ id: "adventuring:hitpoints", amount: Math.max(3, hp + base) }],
                scaling: [{ id: "adventuring:hitpoints", amount: Math.round((hp + base) * 0.1 * 10) / 10 }]
            }
        };
        return variants[variant % 3] || variants[0];
    },
    ring: (tier, scale, variant) => {
        const base = Math.round(3 * statScaling[tier].multiplier * scale);
        const hp = Math.round(statScaling[tier].hp * scale);
        const variants = {
            0: { // Defence focused
                base: hp > 0 ? [
                    { id: "adventuring:hitpoints", amount: hp },
                    { id: "adventuring:defence", amount: base }
                ] : [{ id: "adventuring:defence", amount: base }],
                scaling: hp > 0 ? [
                    { id: "adventuring:hitpoints", amount: Math.round(hp * 0.1 * 10) / 10 },
                    { id: "adventuring:defence", amount: Math.round(base * 0.1 * 10) / 10 }
                ] : [{ id: "adventuring:defence", amount: Math.round(base * 0.1 * 10) / 10 }]
            },
            1: { // Agility focused
                base: hp > 0 ? [
                    { id: "adventuring:hitpoints", amount: hp },
                    { id: "adventuring:agility", amount: base }
                ] : [{ id: "adventuring:agility", amount: base }],
                scaling: hp > 0 ? [
                    { id: "adventuring:hitpoints", amount: Math.round(hp * 0.1 * 10) / 10 },
                    { id: "adventuring:agility", amount: Math.round(base * 0.1 * 10) / 10 }
                ] : [{ id: "adventuring:agility", amount: Math.round(base * 0.1 * 10) / 10 }]
            },
            2: { // Prayer focused (for extra prefixes)
                base: hp > 0 ? [
                    { id: "adventuring:hitpoints", amount: hp },
                    { id: "adventuring:prayer", amount: base }
                ] : [{ id: "adventuring:prayer", amount: base }],
                scaling: hp > 0 ? [
                    { id: "adventuring:hitpoints", amount: Math.round(hp * 0.1 * 10) / 10 },
                    { id: "adventuring:prayer", amount: Math.round(base * 0.1 * 10) / 10 }
                ] : [{ id: "adventuring:prayer", amount: Math.round(base * 0.1 * 10) / 10 }]
            }
        };
        return variants[variant % 3] || variants[0];
    },
    cape: (tier, scale, variant) => {
        const base = Math.round(3 * statScaling[tier].multiplier * scale);
        const hp = Math.round(statScaling[tier].hp * scale);
        const variants = {
            0: { // Ranged focused
                base: hp > 0 ? [
                    { id: "adventuring:hitpoints", amount: hp },
                    { id: "adventuring:ranged", amount: base }
                ] : [{ id: "adventuring:ranged", amount: base }],
                scaling: hp > 0 ? [
                    { id: "adventuring:hitpoints", amount: Math.round(hp * 0.1 * 10) / 10 },
                    { id: "adventuring:ranged", amount: Math.round(base * 0.1 * 10) / 10 }
                ] : [{ id: "adventuring:ranged", amount: Math.round(base * 0.1 * 10) / 10 }]
            },
            1: { // Hybrid STR/DEF
                base: hp > 0 ? [
                    { id: "adventuring:hitpoints", amount: hp },
                    { id: "adventuring:strength", amount: Math.round(base * 0.6) },
                    { id: "adventuring:defence", amount: Math.round(base * 0.4) }
                ] : [
                    { id: "adventuring:strength", amount: Math.round(base * 0.6) },
                    { id: "adventuring:defence", amount: Math.round(base * 0.4) }
                ],
                scaling: hp > 0 ? [
                    { id: "adventuring:hitpoints", amount: Math.round(hp * 0.1 * 10) / 10 },
                    { id: "adventuring:strength", amount: Math.round(base * 0.06 * 10) / 10 },
                    { id: "adventuring:defence", amount: Math.round(base * 0.04 * 10) / 10 }
                ] : [
                    { id: "adventuring:strength", amount: Math.round(base * 0.06 * 10) / 10 },
                    { id: "adventuring:defence", amount: Math.round(base * 0.04 * 10) / 10 }
                ]
            },
            2: { // HP focused
                base: [{ id: "adventuring:hitpoints", amount: Math.max(3, hp + base) }],
                scaling: [{ id: "adventuring:hitpoints", amount: Math.round((hp + base) * 0.1 * 10) / 10 }]
            }
        };
        return variants[variant % 3] || variants[0];
    }
};

// Function to capitalize first letter
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Generate an item
function generateItem(type, tier, prefixIndex) {
    const prefixes = tierPrefixes[tier];
    const prefix = prefixes[prefixIndex];
    const scale = prefixScaling[tier][prefixIndex];
    
    const id = `${prefix}_${type}`;
    const name = nameTemplates[type].replace('{prefix}', capitalize(prefix));
    
    const statsFunc = baseStats[type];
    const stats = statsFunc(tier, scale, prefixIndex);
    
    // Determine material cost
    const baseCurrency = statScaling[tier].currency;
    const currencyMultiplier = type.includes('2h') || type === 'hammer2h' || type === 'polearm' ? 1.5 : 1;
    
    const item = {
        id,
        name,
        media: media[type],
        type: `adventuring:${type}`,
        materials: [
            { id: "adventuring:currency", qty: Math.round(baseCurrency * currencyMultiplier * scale) },
            { id: "adventuring:parts", qty: Math.round(3 * scale) }
        ],
        base: stats.base,
        scaling: stats.scaling,
        requirements: [{ type: "dropped" }],
        upgradeMaterials: upgradeMaterials[tier]
    };
    
    return item;
}

// Main execution
const itemsDir = path.join(__dirname, '..', 'data', 'items');

// Define what to generate per tier
const toGenerate = {
    tier1: ['mace', 'polearm', 'hammer2h', 'orb'],
    tier2: ['knives', 'javelin', 'crossbow', 'mace', 'polearm', 'hammer2h', 'orb', 'amulet', 'ring', 'cape'],
    tier3: ['knives', 'javelin', 'crossbow', 'mace', 'polearm', 'hammer2h', 'orb', 'amulet', 'ring', 'cape'],
    tier4: ['knives', 'javelin', 'crossbow', 'mace', 'polearm', 'hammer2h', 'orb', 'amulet', 'ring', 'cape'],
    tier5: ['knives', 'javelin', 'crossbow', 'mace', 'polearm', 'hammer2h', 'orb', 'amulet', 'ring', 'cape']
};

let totalAdded = 0;

Object.entries(toGenerate).forEach(([tier, types]) => {
    const filePath = path.join(itemsDir, `${tier}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const items = data.data.skillData[0].data.baseItems;
    
    const prefixes = tierPrefixes[tier];
    let addedCount = 0;
    
    types.forEach(type => {
        prefixes.forEach((prefix, prefixIndex) => {
            // Check if item already exists
            const id = `${prefix}_${type}`;
            const exists = items.find(i => i.id === id);
            
            if (!exists) {
                const newItem = generateItem(type, tier, prefixIndex);
                items.push(newItem);
                addedCount++;
                console.log(`  Added: ${newItem.name} (${newItem.id})`);
            }
        });
    });
    
    if (addedCount > 0) {
        // Write back
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
        console.log(`${tier}: Added ${addedCount} items`);
        totalAdded += addedCount;
    } else {
        console.log(`${tier}: No new items needed`);
    }
});

console.log(`\nTotal items added: ${totalAdded}`);
