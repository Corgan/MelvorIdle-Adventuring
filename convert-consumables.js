/**
 * Script to convert consumable data from old format (separate objects per tier)
 * to new tiered format (single object with tiers array).
 * 
 * Old format:
 *   { "id": "arcane_surge_i", "name": "Arcane Surge I", ... }
 *   { "id": "arcane_surge_ii", "name": "Arcane Surge II", ... }
 *   ...
 * 
 * New format:
 *   {
 *     "id": "arcane_surge",
 *     "name": "Arcane Surge",
 *     "sourceJob": "adventuring:astrologist",
 *     "maxCharges": 3,
 *     "tiers": [
 *       { "tier": 1, "nameSuffix": "I", "effects": [...], "materials": [...] },
 *       ...
 *     ]
 *   }
 */

const fs = require('fs');
const path = require('path');

// Roman numeral suffixes
const TIER_SUFFIXES = ['_i', '_ii', '_iii', '_iv'];
const TIER_NAMES = ['I', 'II', 'III', 'IV'];

function convertConsumables(inputPath, outputPath, sourceJobId) {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    
    if (!data.data?.skillData?.[0]?.data?.consumables) {
        console.log(`No consumables found in ${inputPath}`);
        return;
    }
    
    const oldConsumables = data.data.skillData[0].data.consumables;
    const newConsumables = [];
    
    // Group consumables by base ID
    const grouped = new Map();
    
    for (const consumable of oldConsumables) {
        // Extract base ID by removing tier suffix
        let baseId = consumable.id;
        let tier = 0;
        
        for (let i = 0; i < TIER_SUFFIXES.length; i++) {
            if (consumable.id.endsWith(TIER_SUFFIXES[i])) {
                baseId = consumable.id.slice(0, -TIER_SUFFIXES[i].length);
                tier = i + 1;
                break;
            }
        }
        
        if (tier === 0) {
            console.warn(`Could not determine tier for: ${consumable.id}`);
            continue;
        }
        
        if (!grouped.has(baseId)) {
            grouped.set(baseId, {
                baseId: baseId,
                tiers: new Map(),
                // Use tier 1 for common properties
                type: consumable.type,
                media: consumable.media, // Use tier 1 media as base
            });
        }
        
        const group = grouped.get(baseId);
        
        // Extract base name (remove tier suffix like " I", " II", etc.)
        let baseName = consumable.name;
        for (const suffix of TIER_NAMES) {
            if (consumable.name.endsWith(' ' + suffix)) {
                baseName = consumable.name.slice(0, -(suffix.length + 1));
                break;
            }
        }
        group.baseName = baseName;
        
        group.tiers.set(tier, {
            tier: tier,
            nameSuffix: TIER_NAMES[tier - 1],
            media: consumable.media,
            flavorText: consumable.flavorText || '',
            maxCharges: consumable.maxCharges || 3,
            effects: consumable.effects || [],
            materials: consumable.materials || []
        });
    }
    
    // Convert grouped consumables to new format
    for (const [baseId, group] of grouped) {
        // Sort tiers
        const sortedTiers = Array.from(group.tiers.values()).sort((a, b) => a.tier - b.tier);
        
        // Determine maxCharges (use first tier's value, they should be consistent)
        const maxCharges = sortedTiers[0]?.maxCharges || 3;
        
        const newConsumable = {
            id: baseId,
            name: group.baseName,
            media: group.media,
            type: group.type,
            sourceJob: sourceJobId,
            maxCharges: maxCharges,
            tiers: sortedTiers.map(t => ({
                tier: t.tier,
                nameSuffix: t.nameSuffix,
                media: t.media,
                flavorText: t.flavorText,
                effects: t.effects,
                materials: t.materials
            }))
        };
        
        newConsumables.push(newConsumable);
    }
    
    // Also generate workshop products for each tier
    const products = [];
    for (const consumable of newConsumables) {
        for (const tier of consumable.tiers) {
            products.push({
                id: `craft_${consumable.id}_${tier.tier}`,
                consumable: `adventuring:${consumable.id}`,
                tier: tier.tier,
                outputType: 'consumable',
                count: 1,
                requirements: [
                    { type: 'current_job_level', job: sourceJobId, level: (tier.tier - 1) * 25 + 1 }
                ],
                materials: tier.materials
            });
        }
    }
    
    console.log(`\n=== ${path.basename(inputPath)} ===`);
    console.log(`Converted ${oldConsumables.length} old consumables to ${newConsumables.length} new tiered consumables`);
    console.log(`Generated ${products.length} workshop products`);
    
    // Output the converted consumables
    const output = {
        consumables: newConsumables,
        products: products
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Written to: ${outputPath}`);
}

// Process all passive job files
const passiveJobsDir = path.join(__dirname, 'data', 'jobs', 'passive');
const outputDir = path.join(__dirname, 'data', 'converted');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Map of file to source job ID
const jobFiles = {
    'astrologist.json': 'adventuring:astrologist',
    'chef.json': 'adventuring:chef',
    'crafter.json': 'adventuring:crafter',
    'farmer.json': 'adventuring:farmer',
    'firemaker.json': 'adventuring:firemaker',
    'fisherman.json': 'adventuring:fisherman',
    'fletcher.json': 'adventuring:fletcher',
    'herbalist.json': 'adventuring:herbalist',
    'lumberjack.json': 'adventuring:lumberjack',
    'miner.json': 'adventuring:miner',
    'runecrafter.json': 'adventuring:runecrafter',
    'smith.json': 'adventuring:smith',
    'summoner.json': 'adventuring:summoner',
    'thief.json': 'adventuring:thief',
    'cartographer.json': 'adventuring:cartographer',
    'archaeologist.json': 'adventuring:archaeologist'
};

for (const [file, jobId] of Object.entries(jobFiles)) {
    const inputPath = path.join(passiveJobsDir, file);
    if (fs.existsSync(inputPath)) {
        const outputPath = path.join(outputDir, file.replace('.json', '-consumables.json'));
        try {
            convertConsumables(inputPath, outputPath, jobId);
        } catch (e) {
            console.error(`Error processing ${file}:`, e.message);
        }
    }
}

console.log('\nConversion complete!');
