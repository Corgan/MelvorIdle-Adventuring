const fs = require('fs');

// Town jobs with their data
const townJobs = [
    { id: 'smith', name: 'Smith', media: 'melvor:assets/media/skills/smithing/smithing.png', stat: 'strength', material: 'slag' },
    { id: 'miner', name: 'Miner', media: 'melvor:assets/media/skills/mining/mining.png', stat: 'defence', material: 'ore' },
    { id: 'lumberjack', name: 'Lumberjack', media: 'melvor:assets/media/skills/woodcutting/woodcutting.png', stat: 'hitpoints', material: 'timber' },
    { id: 'fisherman', name: 'Fisherman', media: 'melvor:assets/media/skills/fishing/fishing.png', stat: 'agility', material: 'scales' },
    { id: 'chef', name: 'Chef', media: 'melvor:assets/media/skills/cooking/cooking.png', stat: 'hitpoints', material: 'ingredient' },
    { id: 'herbalist', name: 'Herbalist', media: 'melvor:assets/media/skills/herblore/herblore.png', stat: 'prayer', material: 'herb' },
    { id: 'crafter', name: 'Crafter', media: 'melvor:assets/media/skills/crafting/crafting.png', stat: 'defence', material: 'hide' },
    { id: 'fletcher', name: 'Fletcher', media: 'melvor:assets/media/skills/fletching/fletching.png', stat: 'ranged', material: 'feather' },
    { id: 'runecrafter', name: 'Runecrafter', media: 'melvor:assets/media/skills/runecrafting/runecrafting.png', stat: 'magic', material: 'essence' },
    { id: 'summoner', name: 'Summoner', media: 'melvor:assets/media/skills/summoning/summoning.png', stat: 'magic', material: 'shard' },
    { id: 'farmer', name: 'Farmer', media: 'melvor:assets/media/skills/farming/farming.png', stat: 'hitpoints', material: 'seed' },
    { id: 'firemaker', name: 'Firemaker', media: 'melvor:assets/media/skills/firemaking/firemaking.png', stat: 'strength', material: 'ash' },
    { id: 'astrologist', name: 'Astrologist', media: 'melvor:assets/media/skills/astrology/astrology.png', stat: 'prayer', material: 'stardust' },
    { id: 'thief', name: 'Thief', media: 'melvor:assets/media/skills/thieving/thieving.png', stat: 'agility', material: 'lockpick' },
    { id: 'archaeologist', name: 'Archaeologist', media: 'melvor:assets/media/skills/archaeology/archaeology.png', stat: 'prayer', material: 'relic' },
    { id: 'cartographer', name: 'Cartographer', media: 'melvor:assets/media/skills/cartography/cartography.png', stat: 'agility', material: 'map' }
];

// Milestone levels and their tier names
const milestones = [
    { level: 10, tier: 'apprentice', name: 'Apprentice', currency: 500, materialTier: 'crude', materialQty: 25 },
    { level: 25, tier: 'journeyman', name: 'Journeyman', currency: 1000, materialTier: 'refined', materialQty: 25 },
    { level: 50, tier: 'expert', name: 'Expert', currency: 2500, materialTier: 'superior', materialQty: 25 },
    { level: 75, tier: 'master', name: 'Master', currency: 5000, materialTier: 'pristine', materialQty: 25, statBonus: 5 },
    { level: 99, tier: 'legendary', name: 'Legendary', currency: 10000, materialTier: 'transcendent', materialQty: 50, statBonus: 10 }
];

// Generate achievements
const achievements = [];

// 1. Any town job milestones
milestones.forEach(m => {
    const achievement = {
        id: `any_town_job_${m.tier}`,
        name: `${m.name} of the Craft`,
        category: 'adventuring:town_jobs',
        media: 'melvor:assets/media/bank/Golden_Star.png',
        requirement: {
            type: 'any_passive_job_level',
            level: m.level
        },
        rewards: [
            { type: 'currency', id: 'adventuring:currency', qty: m.currency }
        ],
        description: `Reach level ${m.level} with any town job.`
    };
    
    if (m.statBonus) {
        achievement.rewards.push({
            type: 'effect',
            effects: [
                { trigger: 'passive', type: 'stat_flat', stat: 'adventuring:hitpoints', amount: m.statBonus * 2 }
            ]
        });
    }
    
    achievements.push(achievement);
});

// 2. Individual job milestones
townJobs.forEach(job => {
    milestones.forEach(m => {
        const achievement = {
            id: `${job.id}_${m.tier}`,
            name: `${m.name} ${job.name}`,
            category: 'adventuring:town_jobs',
            media: job.media,
            requirement: {
                type: 'specific_passive_job_level',
                job: `adventuring:${job.id}`,
                level: m.level
            },
            rewards: [
                { type: 'currency', id: 'adventuring:currency', qty: Math.floor(m.currency / 2) },
                { type: 'material', id: `adventuring:${m.materialTier}_${job.material}`, qty: m.materialQty }
            ],
            description: `Reach level ${m.level} with the ${job.name} job.`
        };
        
        if (m.statBonus) {
            achievement.rewards.push({
                type: 'effect',
                effects: [
                    { trigger: 'passive', type: 'stat_flat', stat: `adventuring:${job.stat}`, amount: m.statBonus }
                ]
            });
        }
        
        achievements.push(achievement);
    });
});

// 3. All town jobs milestones
milestones.forEach(m => {
    const achievement = {
        id: `all_town_jobs_${m.tier}`,
        name: m.level === 99 ? 'Legend of All Trades' : 
              m.level === 75 ? 'Master of All Trades' :
              m.level === 50 ? 'Expert of All Trades' :
              m.level === 25 ? 'Journeyman of All Trades' : 'Apprentice of All Trades',
        category: 'adventuring:town_jobs',
        media: 'melvor:assets/media/bank/Golden_Star.png',
        requirement: {
            type: 'all_passive_jobs_level',
            level: m.level
        },
        rewards: [
            { type: 'currency', id: 'adventuring:currency', qty: m.currency * 2 }
        ],
        description: `Reach level ${m.level} with all town jobs.`
    };
    
    // Add scaling stat bonuses for higher tiers
    if (m.level >= 25) {
        const multiplier = m.level === 99 ? 5 : m.level === 75 ? 3 : m.level === 50 ? 2 : 1;
        achievement.rewards.push({
            type: 'effect',
            effects: [
                { trigger: 'passive', type: 'stat_flat', stat: 'adventuring:strength', amount: 5 * multiplier },
                { trigger: 'passive', type: 'stat_flat', stat: 'adventuring:defence', amount: 5 * multiplier },
                { trigger: 'passive', type: 'stat_flat', stat: 'adventuring:ranged', amount: 5 * multiplier },
                { trigger: 'passive', type: 'stat_flat', stat: 'adventuring:magic', amount: 5 * multiplier },
                { trigger: 'passive', type: 'stat_flat', stat: 'adventuring:hitpoints', amount: 10 * multiplier }
            ]
        });
    }
    
    achievements.push(achievement);
});

// Build the full JSON structure
const output = {
    "$schema": "https://www.melvoridle.com/assets/schema/gameData.json",
    "namespace": "adventuring",
    "data": {
        "skillData": [
            {
                "skillID": "adventuring:Adventuring",
                "data": {
                    "achievements": achievements,
                    "achievementCategories": [
                        {
                            "id": "town_jobs",
                            "name": "Town Jobs",
                            "media": "melvor:assets/media/skills/smithing/smithing.png"
                        }
                    ]
                }
            }
        ]
    }
};

// Write to file
const outputPath = '../data/achievements/town_jobs.json';
fs.writeFileSync(outputPath, JSON.stringify(output, null, 4));

console.log(`Generated ${achievements.length} town job achievements:`);
console.log(`  - ${milestones.length} "any town job" achievements`);
console.log(`  - ${townJobs.length * milestones.length} individual job achievements (${townJobs.length} jobs × ${milestones.length} levels)`);
console.log(`  - ${milestones.length} "all town jobs" achievements`);
console.log(`\nWritten to ${outputPath}`);
