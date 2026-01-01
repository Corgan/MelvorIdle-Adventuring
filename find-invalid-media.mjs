import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const melvorAssets = new Set();
const files = ['melvorDemo.json', 'melvorFull.json', 'melvorTotH.json', 'melvorItA.json', 'melvorExpansion2.json'];

for (const file of files) {
    try {
        const content = await readFile(join(__dirname, '..', file), 'utf-8');
        const mediaRegex = /assets\/media\/[^"#?]+\.(png|svg|jpg|gif)/gi;
        const matches = content.match(mediaRegex) || [];
        matches.forEach(p => melvorAssets.add(p));
    } catch(e) {}
}

console.log('Loaded', melvorAssets.size, 'valid melvor assets\n');

function checkMedia(media) {
    if (!media) return { valid: true };
    
    if (media.startsWith('melvor:')) {
        const assetPath = media.replace('melvor:', '').split('#')[0];
        if (!melvorAssets.has(assetPath)) {
            return { valid: false, path: assetPath };
        }
    } else if (media.startsWith('assets/')) {
        // Local asset - would need to check local files
        return { valid: true, local: true };
    }
    return { valid: true };
}

const invalid = {
    materials: [],
    baseItems: [],
    consumables: [],
    monsters: [],
    jobs: [],
    buffs: []
};

// Check materials.json
try {
    const content = await readFile(join(__dirname, 'data/items/materials.json'), 'utf-8');
    const data = JSON.parse(content);
    const materials = data.data?.skillData?.[0]?.data?.materials || [];
    for (const m of materials) {
        const result = checkMedia(m.media);
        if (!result.valid) {
            invalid.materials.push({ file: 'data/items/materials.json', id: m.id, media: m.media, path: result.path });
        }
    }
} catch(e) { console.log('Error reading materials.json:', e.message); }

// Check base.json for materials and other items
try {
    const content = await readFile(join(__dirname, 'data/base.json'), 'utf-8');
    const data = JSON.parse(content);
    const skillData = data.data?.skillData?.[0]?.data || {};
    
    // Materials in base.json
    const materials = skillData.materials || [];
    for (const m of materials) {
        const result = checkMedia(m.media);
        if (!result.valid) {
            invalid.materials.push({ file: 'data/base.json', id: m.id, media: m.media, path: result.path });
        }
    }
    
    // Jobs
    const jobs = skillData.jobs || [];
    for (const j of jobs) {
        const result = checkMedia(j.media);
        if (!result.valid) {
            invalid.jobs.push({ file: 'data/base.json', id: j.id, media: j.media, path: result.path });
        }
    }
    
    // Buffs
    const buffs = skillData.buffs || [];
    for (const b of buffs) {
        const result = checkMedia(b.media);
        if (!result.valid) {
            invalid.buffs.push({ file: 'data/base.json', id: b.id, media: b.media, path: result.path });
        }
    }
    
    // Debuffs
    const debuffs = skillData.debuffs || [];
    for (const d of debuffs) {
        const result = checkMedia(d.media);
        if (!result.valid) {
            invalid.buffs.push({ file: 'data/base.json', id: d.id, media: d.media, path: result.path });
        }
    }
} catch(e) { console.log('Error reading base.json:', e.message); }

// Check consumables.json
try {
    const content = await readFile(join(__dirname, 'data/consumables.json'), 'utf-8');
    const data = JSON.parse(content);
    const consumables = data.data?.skillData?.[0]?.data?.consumables || [];
    for (const c of consumables) {
        const result = checkMedia(c.media);
        if (!result.valid) {
            invalid.consumables.push({ file: 'data/consumables.json', id: c.id, media: c.media, path: result.path });
        }
    }
} catch(e) { console.log('Error reading consumables.json:', e.message); }

// Check all item files for baseItems
const itemsDir = join(__dirname, 'data/items');
const itemFiles = await readdir(itemsDir);
for (const file of itemFiles) {
    if (!file.endsWith('.json')) continue;
    try {
        const content = await readFile(join(itemsDir, file), 'utf-8');
        const data = JSON.parse(content);
        const items = data.data?.skillData?.[0]?.data?.baseItems || [];
        for (const item of items) {
            const result = checkMedia(item.media);
            if (!result.valid) {
                invalid.baseItems.push({ file: 'data/items/' + file, id: item.id, media: item.media, path: result.path });
            }
        }
    } catch(e) {}
}

// Check area files for materials and monsters
const areasDir = join(__dirname, 'data/areas');
const areaFiles = await readdir(areasDir);

function extractFromObj(obj, file) {
    if (!obj || typeof obj !== 'object') return;
    
    if (Array.isArray(obj.materials)) {
        for (const m of obj.materials) {
            const result = checkMedia(m.media);
            if (!result.valid) {
                invalid.materials.push({ file: 'data/areas/' + file, id: m.id, media: m.media, path: result.path });
            }
        }
    }
    
    if (Array.isArray(obj.monsters)) {
        for (const m of obj.monsters) {
            const result = checkMedia(m.media);
            if (!result.valid) {
                invalid.monsters.push({ file: 'data/areas/' + file, id: m.id, media: m.media, path: result.path });
            }
        }
    }
    
    if (Array.isArray(obj.floors)) {
        for (const floor of obj.floors) {
            extractFromObj(floor, file);
        }
    }
    
    if (obj.area) extractFromObj(obj.area, file);
    
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
            extractFromObj(value, file);
        }
    }
}

for (const file of areaFiles) {
    if (!file.endsWith('.json')) continue;
    try {
        const content = await readFile(join(areasDir, file), 'utf-8');
        const data = JSON.parse(content);
        extractFromObj(data, file);
    } catch(e) {}
}

// Check passive jobs for materials
const passiveJobsDir = join(__dirname, 'data/jobs/passive');
try {
    const passiveFiles = await readdir(passiveJobsDir);
    for (const file of passiveFiles) {
        if (!file.endsWith('.json')) continue;
        try {
            const content = await readFile(join(passiveJobsDir, file), 'utf-8');
            const data = JSON.parse(content);
            const materials = data.data?.skillData?.[0]?.data?.materials || [];
            for (const m of materials) {
                const result = checkMedia(m.media);
                if (!result.valid) {
                    invalid.materials.push({ file: 'data/jobs/passive/' + file, id: m.id, media: m.media, path: result.path });
                }
            }
        } catch(e) {}
    }
} catch(e) {}

// Print results
console.log('='.repeat(80));
console.log('MATERIALS WITH INVALID MEDIA PATHS (' + invalid.materials.length + ')');
console.log('='.repeat(80));
for (const m of invalid.materials) {
    console.log(`File: ${m.file}`);
    console.log(`  ID: ${m.id}`);
    console.log(`  Media: ${m.media}`);
    console.log(`  Invalid path: ${m.path}`);
    console.log();
}

console.log('='.repeat(80));
console.log('BASE ITEMS WITH INVALID MEDIA PATHS (' + invalid.baseItems.length + ')');
console.log('='.repeat(80));
for (const i of invalid.baseItems) {
    console.log(`File: ${i.file}`);
    console.log(`  ID: ${i.id}`);
    console.log(`  Media: ${i.media}`);
    console.log(`  Invalid path: ${i.path}`);
    console.log();
}

console.log('='.repeat(80));
console.log('CONSUMABLES WITH INVALID MEDIA PATHS (' + invalid.consumables.length + ')');
console.log('='.repeat(80));
for (const c of invalid.consumables) {
    console.log(`File: ${c.file}`);
    console.log(`  ID: ${c.id}`);
    console.log(`  Media: ${c.media}`);
    console.log(`  Invalid path: ${c.path}`);
    console.log();
}

console.log('='.repeat(80));
console.log('MONSTERS WITH INVALID MEDIA PATHS (' + invalid.monsters.length + ')');
console.log('='.repeat(80));
for (const m of invalid.monsters) {
    console.log(`File: ${m.file}`);
    console.log(`  ID: ${m.id}`);
    console.log(`  Media: ${m.media}`);
    console.log(`  Invalid path: ${m.path}`);
    console.log();
}

console.log('='.repeat(80));
console.log('JOBS WITH INVALID MEDIA PATHS (' + invalid.jobs.length + ')');
console.log('='.repeat(80));
for (const j of invalid.jobs) {
    console.log(`File: ${j.file}`);
    console.log(`  ID: ${j.id}`);
    console.log(`  Media: ${j.media}`);
    console.log(`  Invalid path: ${j.path}`);
    console.log();
}

console.log('='.repeat(80));
console.log('BUFFS/DEBUFFS WITH INVALID MEDIA PATHS (' + invalid.buffs.length + ')');
console.log('='.repeat(80));
for (const b of invalid.buffs) {
    console.log(`File: ${b.file}`);
    console.log(`  ID: ${b.id}`);
    console.log(`  Media: ${b.media}`);
    console.log(`  Invalid path: ${b.path}`);
    console.log();
}

console.log('\n='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Materials: ${invalid.materials.length}`);
console.log(`Base Items: ${invalid.baseItems.length}`);
console.log(`Consumables: ${invalid.consumables.length}`);
console.log(`Monsters: ${invalid.monsters.length}`);
console.log(`Jobs: ${invalid.jobs.length}`);
console.log(`Buffs/Debuffs: ${invalid.buffs.length}`);
console.log(`Total: ${invalid.materials.length + invalid.baseItems.length + invalid.consumables.length + invalid.monsters.length + invalid.jobs.length + invalid.buffs.length}`);
