const fs = require('fs');
const path = require('path');

// Fix achievement-stats.json
const statsPath = 'data/achievement-stats.json';
const statsContent = JSON.parse(fs.readFileSync(statsPath, 'utf8'));

if (!statsContent.data || !statsContent.data.skillData) {
    const stats = statsContent.achievementStats;
    const newContent = {
        "$schema": "https://www.melvoridle.com/assets/schema/gameData.json",
        "namespace": "adventuring",
        "data": {
            "skillData": [{
                "skillID": "adventuring:Adventuring",
                "data": {
                    "achievementStats": stats
                }
            }]
        }
    };
    fs.writeFileSync(statsPath, JSON.stringify(newContent, null, 4));
    console.log('Converted achievement-stats.json to skillData format');
} else {
    console.log('achievement-stats.json already in correct format');
}

// Category definitions to add
const categories = {
    'area_mastery': { id: 'area_mastery', name: 'Area Mastery', media: 'melvor:assets/media/main/stamina.png' },
    'collection': { id: 'collection', name: 'Collection', media: 'melvor:assets/media/main/bank_header.png' },
    'combat_jobs': { id: 'combat_jobs', name: 'Combat Jobs', media: 'melvor:assets/media/skills/combat/combat.png' },
    'cumulative': { id: 'cumulative', name: 'Cumulative', media: 'melvor:assets/media/main/statistics_header.png' },
    'gauntlets': { id: 'gauntlets', name: 'Gauntlets', media: 'melvor:assets/media/skills/combat/combat.png' },
    'monster_mastery': { id: 'monster_mastery', name: 'Monster Mastery', media: 'melvor:assets/media/skills/combat/combat.png' },
    'production': { id: 'production', name: 'Production', media: 'melvor:assets/media/skills/crafting/crafting.png' },
    'restrictions': { id: 'restrictions', name: 'Restrictions', media: 'melvor:assets/media/main/question.png' },
    'slayer': { id: 'slayer', name: 'Slayer', media: 'melvor:assets/media/skills/slayer/slayer.png' },
    'solo': { id: 'solo', name: 'Solo', media: 'melvor:assets/media/skills/combat/hitpoints.png' },
    'town_jobs': { id: 'town_jobs', name: 'Town Jobs', media: 'melvor:assets/media/skills/crafting/crafting.png' }
};

// Files that need categories added
const filesToFix = [
    'area_mastery', 'collection', 'combat_jobs', 'cumulative',
    'gauntlets', 'monster_mastery', 'production', 'restrictions',
    'slayer', 'solo', 'town_jobs'
];

const dir = 'data/achievements';

filesToFix.forEach(name => {
    const filepath = path.join(dir, `${name}.json`);
    const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    
    // Check if in skillData format
    if (content.data && content.data.skillData && content.data.skillData[0] && content.data.skillData[0].data) {
        const data = content.data.skillData[0].data;
        
        // Check if achievementCategories already exists
        if (!data.achievementCategories) {
            data.achievementCategories = [categories[name]];
            fs.writeFileSync(filepath, JSON.stringify(content, null, 4));
            console.log(`Added category to ${name}.json`);
        } else {
            console.log(`${name}.json already has achievementCategories`);
        }
    } else {
        console.log(`WARNING: ${name}.json is not in skillData format!`);
    }
});

console.log('Done!');
