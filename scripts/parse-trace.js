const fs = require('fs');

const traceFile = process.argv[2] || 'Trace-20260109T084205.json';
const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));

// Check for CPU profile format vs DevTools trace format
let samples = [];

if (trace.nodes) {
    // CPU Profile format
    samples = trace.nodes.filter(n => n.callFrame && n.callFrame.url)
        .map(n => ({
            name: n.callFrame.functionName,
            url: n.callFrame.url,
            line: n.callFrame.lineNumber,
            hitCount: n.hitCount || 1
        }));
} else if (trace.traceEvents) {
    // DevTools Trace format - look for ProfileChunk events
    const profileChunks = trace.traceEvents.filter(e => 
        e.name === 'ProfileChunk' && e.args && e.args.data && e.args.data.cpuProfile
    );
    
    // Build node map from all chunks
    const nodeMap = new Map();
    const hitCounts = new Map();
    
    profileChunks.forEach(chunk => {
        const profile = chunk.args.data.cpuProfile;
        if (profile.nodes) {
            profile.nodes.forEach(node => {
                if (node.callFrame) {
                    nodeMap.set(node.id, node.callFrame);
                }
            });
        }
        if (profile.samples && chunk.args.data.timeDeltas) {
            profile.samples.forEach((nodeId, idx) => {
                hitCounts.set(nodeId, (hitCounts.get(nodeId) || 0) + 1);
            });
        }
    });
    
    // Collect all nodes with hits
    nodeMap.forEach((callFrame, nodeId) => {
        if (hitCounts.get(nodeId) > 0) {
            samples.push({
                name: callFrame.functionName,
                url: callFrame.url,
                line: callFrame.lineNumber,
                hitCount: hitCounts.get(nodeId) || 1
            });
        }
    });
}

// Filter for likely mod code - blob URLs or function names that look like mod code
const modKeywords = ['Adventuring', 'adventuring', 'Dungeon', 'dungeon', 'Hero', 
    'Party', 'Encounter', 'Aura', 'Effect', 'Stash', 'Workshop', 'Tavern', 
    'Monster', 'Ability', 'Grimoire', 'Slayer', 'Bestiary'];

const modSamples = samples.filter(s => {
    // Blob URLs are mod code
    if (s.url && s.url.startsWith('blob:')) return true;
    // Check function name for mod keywords
    if (modKeywords.some(kw => s.name && s.name.includes(kw))) return true;
    return false;
});

// Count by function + location
const counts = {};
modSamples.forEach(s => {
    const file = s.url ? s.url.split('/').pop().substring(0, 20) : 'unknown';
    const key = `${s.name || '(anonymous)'} @ ${file}:${s.line}`;
    counts[key] = (counts[key] || 0) + s.hitCount;
});

// Sort and display top 50
const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 50);
console.log('Samples | Function @ File:Line');
console.log('--------|----------------------');
sorted.forEach(([k, v]) => console.log(`${v.toString().padStart(7)} | ${k}`));

console.log('\n\nTotal samples in mod code:', modSamples.reduce((sum, s) => sum + s.hitCount, 0));
