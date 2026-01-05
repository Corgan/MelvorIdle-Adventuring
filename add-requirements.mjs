/**
 * Add progression requirements to equipment items.
 * This script reads item JSON files and adds appropriate requirements based on tier and theme.
 * 
 * Usage: node add-requirements.mjs
 */

import fs from 'fs';
import path from 'path';

// Requirement templates by tier
// Basic items get skill_level requirements
// Themed items get area_mastery requirements from their associated dungeon
const TIER_REQUIREMENTS = {
    // Tier 1: No requirements (starter gear)
    1: null,
    
    // Tier 2: Skill level 5
    2: {
        basic: [{ type: 'skill_level', level: 5 }],
        themed: {
            bandit: [{ type: 'area_mastery', area: 'adventuring:bandit_hideout', level: 3 }],
            spider: [{ type: 'area_mastery', area: 'adventuring:spider_nest', level: 3 }],
            gravekeeper: [{ type: 'area_mastery', area: 'adventuring:graveyard', level: 3 }]
        }
    },
    
    // Tier 3: Skill level 10 OR area mastery
    3: {
        basic: [{ type: 'skill_level', level: 10 }],
        themed: {
            giant: [{ type: 'area_mastery', area: 'adventuring:giants_plateau', level: 5 }],
            pirate: [{ type: 'area_mastery', area: 'adventuring:pirate_cove', level: 5 }],
            dragon_slayer: [{ type: 'area_mastery', area: 'adventuring:dragons_lair', level: 5 }],
            frost: [{ type: 'area_mastery', area: 'adventuring:frozen_wastes', level: 5 }],
            vampire_hunter: [{ type: 'area_mastery', area: 'adventuring:vampire_crypt', level: 5 }]
        }
    },
    
    // Tier 4: Skill level 15 OR area mastery
    4: {
        basic: [{ type: 'skill_level', level: 15 }],
        themed: {
            tomb_guardian: [{ type: 'area_mastery', area: 'adventuring:mummys_tomb', level: 7 }],
            stormcaller: [{ type: 'area_mastery', area: 'adventuring:air_temple', level: 7 }],
            earthshaker: [{ type: 'area_mastery', area: 'adventuring:earth_temple', level: 7 }],
            inferno: [{ type: 'area_mastery', area: 'adventuring:fire_temple', level: 7 }],
            terran: [{ type: 'area_mastery', area: 'adventuring:earth_temple', level: 7 }]
        }
    },
    
    // Tier 5: Skill level 20 OR area mastery 10
    5: {
        basic: [{ type: 'skill_level', level: 20 }],
        themed: {
            voidwalker: [{ type: 'area_mastery', area: 'adventuring:void_citadel', level: 10 }],
            shadowbane: [{ type: 'area_mastery', area: 'adventuring:shadow_temple', level: 10 }],
            mistweaver: [{ type: 'area_mastery', area: 'adventuring:into_the_mist', level: 10 }]
        }
    },
    
    // Tier 6: Skill level 30
    6: {
        basic: [{ type: 'skill_level', level: 30 }]
    },
    
    // Tier 7: Skill level 40 + advanced dungeon achievement
    7: {
        basic: [
            { type: 'skill_level', level: 40 },
            { type: 'achievement_completion', id: 'adventuring:dungeon_master' }
        ]
    },
    
    // Tier 8: Skill level 50 + boss achievements
    8: {
        basic: [
            { type: 'skill_level', level: 50 },
            { type: 'achievement_completion', id: 'adventuring:boss_slayer' }
        ]
    },
    
    // Tier 9: End-game requirements
    9: {
        basic: [
            { type: 'skill_level', level: 60 },
            { type: 'achievement_completion', id: 'adventuring:dungeon_legend' }
        ]
    }
};

// Map item prefixes to themed requirement keys
function getThemeFromItemId(itemId) {
    const prefixes = [
        'bandit', 'spider', 'gravekeeper',
        'giant', 'pirate', 'dragon_slayer', 'frost', 'vampire_hunter',
        'tomb_guardian', 'stormcaller', 'earthshaker', 'inferno', 'terran',
        'voidwalker', 'shadowbane', 'mistweaver'
    ];
    
    for (const prefix of prefixes) {
        if (itemId.startsWith(prefix)) {
            return prefix;
        }
    }
    return null;
}

// Determine tier from filename or item id
function getTierFromFilename(filename) {
    const match = filename.match(/tier(\d+)/);
    return match ? parseInt(match[1]) : null;
}

// Determine tier from item id for tiered_offhands
function getTierFromItemId(itemId) {
    // Tier 2: iron, steel, mithril, apprentice, journeyman
    if (itemId.startsWith('iron_') || itemId.startsWith('steel_') || itemId.startsWith('mithril_') ||
        itemId.startsWith('apprentice_') || itemId.startsWith('journeyman_')) {
        return 2;
    }
    // Tier 3: adamant, rune, adept, expert, master
    if (itemId.startsWith('adamant_') || itemId.startsWith('rune_') ||
        itemId.startsWith('adept_') || itemId.startsWith('expert_') || itemId.startsWith('master_')) {
        return 3;
    }
    // Tier 4: dragon, archmage
    if (itemId.startsWith('dragon_') || itemId.startsWith('archmage_')) {
        return 4;
    }
    return null;
}

// Check if file contains themed items
function isThemedFile(filename) {
    return filename.includes('themed');
}

// Process a single JSON file
function processFile(filePath) {
    const filename = path.basename(filePath);
    const fileTier = getTierFromFilename(filename);
    const isOffhandsFile = filename === 'tiered_offhands.json';
    
    // For non-offhands files, we need a tier from the filename
    if (!isOffhandsFile && (!fileTier || !TIER_REQUIREMENTS[fileTier])) {
        console.log(`Skipping ${filename} (no requirements for tier ${fileTier})`);
        return false;
    }
    
    const isThemed = isThemedFile(filename);
    
    // Read and parse the JSON
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    let modified = false;
    
    // Find the baseItems array
    const skillData = data.data?.skillData?.[0]?.data;
    if (!skillData?.baseItems) {
        console.log(`Skipping ${filename} (no baseItems found)`);
        return false;
    }
    
    for (const item of skillData.baseItems) {
        // Determine tier - from filename or from item id (for offhands)
        let tier = fileTier;
        if (isOffhandsFile) {
            tier = getTierFromItemId(item.id);
            if (!tier) continue; // Skip items with unknown tier
        }
        
        const tierReqs = TIER_REQUIREMENTS[tier];
        if (!tierReqs) {
            // Clear requirements for items without tier requirements (e.g., tier 1)
            if (item.requirements && item.requirements.length > 0) {
                delete item.requirements;
                modified = true;
                console.log(`  Cleared requirements from ${item.id} (no tier requirements)`);
            }
            continue;
        }
        
        let requirements = null;
        
        if (isThemed && tierReqs.themed) {
            // Check for themed requirements
            const theme = getThemeFromItemId(item.id);
            if (theme && tierReqs.themed[theme]) {
                requirements = tierReqs.themed[theme];
            }
        }
        
        // Fall back to basic requirements
        if (!requirements && tierReqs.basic) {
            requirements = tierReqs.basic;
        }
        
        if (requirements) {
            // Always update requirements (overwrite existing)
            const existing = JSON.stringify(item.requirements || []);
            const newReqs = JSON.stringify(requirements);
            if (existing !== newReqs) {
                item.requirements = requirements;
                modified = true;
                console.log(`  Updated requirements for ${item.id}`);
            }
        }
    }
    
    if (modified) {
        // Write back the JSON with proper formatting
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
        console.log(`Updated ${filename}`);
    }
    
    return modified;
}

// Main
const dataDir = path.join(process.cwd(), 'data', 'items');

// Files to process
const files = [
    'tier2_armor.json',
    'tier2_weapons.json',
    'tier2_themed.json',
    'tier3_armor.json',
    'tier3_weapons.json',
    'tier3_themed.json',
    'tier4_armor.json',
    'tier4_weapons.json',
    'tier4_themed.json',
    'tier5_armor.json',
    'tier5_weapons.json',
    'tier5_themed.json',
    'tier6_armor.json',
    'tier6_weapons.json',
    'tier7_uniques.json',
    'tier8_uniques.json',
    'tier9_uniques.json',
    'tiered_offhands.json'
];

console.log('Adding progression requirements to equipment items...\n');

let totalModified = 0;
for (const file of files) {
    const filePath = path.join(dataDir, file);
    if (fs.existsSync(filePath)) {
        if (processFile(filePath)) {
            totalModified++;
        }
    } else {
        console.log(`File not found: ${file}`);
    }
}

console.log(`\nDone! Modified ${totalModified} files.`);
