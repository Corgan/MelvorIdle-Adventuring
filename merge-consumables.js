const fs = require('fs');
const path = require('path');

const passiveDir = path.join(__dirname, 'data', 'jobs', 'passive');
const convertedDir = path.join(__dirname, 'data', 'converted');

// Map file names to converted file names
const jobToConvertedFile = {
    'astrologist.json': 'astrologist-consumables.json',
    'chef.json': 'chef-consumables.json',
    'crafter.json': 'crafter-consumables.json',
    'farmer.json': 'farmer-consumables.json',
    'firemaker.json': 'firemaker-consumables.json',
    'fisherman.json': 'fisherman-consumables.json',
    'fletcher.json': 'fletcher-consumables.json',
    'herbalist.json': 'herbalist-consumables.json',
    'lumberjack.json': 'lumberjack-consumables.json',
    'miner.json': 'miner-consumables.json',
    'runecrafter.json': 'runecrafter-consumables.json',
    'smith.json': 'smith-consumables.json',
    'summoner.json': 'summoner-consumables.json',
    'thief.json': 'thief-consumables.json',
    'cartographer.json': 'cartographer-consumables.json',
    'archaeologist.json': 'archaeologist-consumables.json'
};

for (const [jobFile, convertedFile] of Object.entries(jobToConvertedFile)) {
    const jobPath = path.join(passiveDir, jobFile);
    const convertedPath = path.join(convertedDir, convertedFile);
    
    if (!fs.existsSync(jobPath)) {
        console.log(`Skipping ${jobFile} - file not found`);
        continue;
    }
    
    if (!fs.existsSync(convertedPath)) {
        console.log(`Skipping ${jobFile} - converted file not found`);
        continue;
    }
    
    const jobData = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
    const convertedData = JSON.parse(fs.readFileSync(convertedPath, 'utf8'));
    
    const skillData = jobData.data.skillData[0].data;
    
    // Replace old consumables with new tiered consumables
    skillData.consumables = convertedData.consumables;
    
    // Add workshop products to existing products array
    if (!skillData.products) {
        skillData.products = [];
    }
    skillData.products.push(...convertedData.products);
    
    // Find the workshop building and add the new products to it
    if (skillData.buildings) {
        for (const building of skillData.buildings) {
            if (building.type === 'workshop') {
                // Add new product IDs to the building's products array
                const newProductIds = convertedData.products.map(p => `adventuring:${p.id}`);
                if (!building.products) {
                    building.products = [];
                }
                building.products.push(...newProductIds);
                break;
            }
        }
    }
    
    // Write back
    fs.writeFileSync(jobPath, JSON.stringify(jobData, null, 4), 'utf8');
    console.log(`Updated ${jobFile} with ${convertedData.consumables.length} consumables and ${convertedData.products.length} products`);
}

console.log('\nMerge complete!');
