const fs = require('fs');
const path = require('path');

const dir = 'data/achievements';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

files.forEach(file => {
    const filepath = path.join(dir, file);
    const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    
    // Check if it uses additions format
    if (content.data && content.data.additions && Array.isArray(content.data.additions)) {
        console.log('Converting:', file);
        
        // Extract achievements from additions format
        const additions = content.data.additions[0];
        if (additions && additions.type === 'namespace' && additions.data && additions.data.achievements) {
            const achievements = additions.data.achievements;
            
            // Convert to skillData format
            const newContent = {
                "$schema": "https://www.melvoridle.com/assets/schema/gameData.json",
                "namespace": "adventuring",
                "data": {
                    "skillData": [{
                        "skillID": "adventuring:Adventuring",
                        "data": {
                            "achievements": achievements
                        }
                    }]
                }
            };
            
            fs.writeFileSync(filepath, JSON.stringify(newContent, null, 4));
            console.log('  Converted successfully');
        }
    } else {
        console.log('Skipping (already correct):', file);
    }
});

console.log('Done!');
