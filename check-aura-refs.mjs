import fs from 'fs';
import path from 'path';

function findMissingAuraRefs(dir) {
    const issues = [];
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        let json;
        try {
            json = JSON.parse(content);
        } catch (e) {
            console.log('Parse error in', file, e.message);
            continue;
        }
        
        // Find line number for an object by searching for unique properties
        function findLineNumber(obj, searchedLines) {
            // Try to find by stringifying small portion
            const objStr = JSON.stringify(obj);
            for (let i = 0; i < lines.length; i++) {
                if (searchedLines.has(i)) continue;
                const line = lines[i];
                if (obj.type && line.includes(`"type": "${obj.type}"`)) {
                    searchedLines.add(i);
                    return i + 1;
                }
            }
            return 0;
        }
        
        const searchedLines = new Set();
        
        function findEffects(obj, objPath = '') {
            if (!obj || typeof obj !== 'object') return;
            
            if (Array.isArray(obj)) {
                obj.forEach((item, i) => findEffects(item, `${objPath}[${i}]`));
                return;
            }
            
            // Check if this is a buff/debuff effect
            if (obj.type === 'buff' || obj.type === 'debuff') {
                const hasBuff = 'buff' in obj;
                const hasDebuff = 'debuff' in obj;
                const hasId = 'id' in obj;
                
                // Issue 1: No aura reference at all
                if (!hasBuff && !hasDebuff && !hasId) {
                    const lineNum = findLineNumber(obj, searchedLines);
                    issues.push({
                        file: filePath,
                        line: lineNum,
                        issue: 'MISSING_AURA_REF',
                        type: obj.type,
                        obj: JSON.stringify(obj).substring(0, 150),
                        path: objPath
                    });
                }
                
                // Issue 2: Has id/buff/debuff but value is empty/undefined/null
                if (hasId && (!obj.id || obj.id === '')) {
                    const lineNum = findLineNumber(obj, searchedLines);
                    issues.push({
                        file: filePath,
                        line: lineNum,
                        issue: 'EMPTY_ID',
                        type: obj.type,
                        obj: JSON.stringify(obj).substring(0, 150),
                        path: objPath
                    });
                }
                if (hasBuff && (!obj.buff || obj.buff === '')) {
                    const lineNum = findLineNumber(obj, searchedLines);
                    issues.push({
                        file: filePath,
                        line: lineNum,
                        issue: 'EMPTY_BUFF',
                        type: obj.type,
                        obj: JSON.stringify(obj).substring(0, 150),
                        path: objPath
                    });
                }
                if (hasDebuff && (!obj.debuff || obj.debuff === '')) {
                    const lineNum = findLineNumber(obj, searchedLines);
                    issues.push({
                        file: filePath,
                        line: lineNum,
                        issue: 'EMPTY_DEBUFF',
                        type: obj.type,
                        obj: JSON.stringify(obj).substring(0, 150),
                        path: objPath
                    });
                }
                
                // Issue 3: Check for missing namespace in id
                const auraRef = obj.id || obj.buff || obj.debuff;
                if (auraRef && typeof auraRef === 'string' && !auraRef.includes(':')) {
                    const lineNum = findLineNumber(obj, searchedLines);
                    issues.push({
                        file: filePath,
                        line: lineNum,
                        issue: 'MISSING_NAMESPACE',
                        type: obj.type,
                        auraRef: auraRef,
                        obj: JSON.stringify(obj).substring(0, 150),
                        path: objPath
                    });
                }
            }
            
            // Recurse
            for (const key in obj) {
                findEffects(obj[key], `${objPath}.${key}`);
            }
        }
        
        findEffects(json, file);
    }
    
    return issues;
}

const areasDir = 'c:/Users/Corga/melvor/adventuring/data/areas';
const jobsDir = 'c:/Users/Corga/melvor/adventuring/data/jobs/combat';
const passiveJobsDir = 'c:/Users/Corga/melvor/adventuring/data/jobs/passive';
const itemsDir = 'c:/Users/Corga/melvor/adventuring/data/items';

const allIssues = [];

console.log('=== Checking Areas ===\n');
const areaIssues = findMissingAuraRefs(areasDir);
allIssues.push(...areaIssues);
if (areaIssues.length === 0) {
    console.log('No issues found in areas.\n');
} else {
    areaIssues.forEach(i => {
        console.log(`${i.file}:${i.line}`);
        console.log(`  Issue: ${i.issue}`);
        console.log(`  Type: ${i.type}`);
        if (i.auraRef) console.log(`  Aura Ref: ${i.auraRef}`);
        console.log(`  Object: ${i.obj}`);
        console.log();
    });
}

console.log('\n=== Checking Combat Jobs ===\n');
const jobIssues = findMissingAuraRefs(jobsDir);
allIssues.push(...jobIssues);
if (jobIssues.length === 0) {
    console.log('No issues found in combat jobs.\n');
} else {
    jobIssues.forEach(i => {
        console.log(`${i.file}:${i.line}`);
        console.log(`  Issue: ${i.issue}`);
        console.log(`  Type: ${i.type}`);
        if (i.auraRef) console.log(`  Aura Ref: ${i.auraRef}`);
        console.log(`  Object: ${i.obj}`);
        console.log();
    });
}

console.log('\n=== Checking Passive Jobs ===\n');
const passiveIssues = findMissingAuraRefs(passiveJobsDir);
allIssues.push(...passiveIssues);
if (passiveIssues.length === 0) {
    console.log('No issues found in passive jobs.\n');
} else {
    passiveIssues.forEach(i => {
        console.log(`${i.file}:${i.line}`);
        console.log(`  Issue: ${i.issue}`);
        console.log(`  Type: ${i.type}`);
        if (i.auraRef) console.log(`  Aura Ref: ${i.auraRef}`);
        console.log(`  Object: ${i.obj}`);
        console.log();
    });
}

console.log('\n=== Checking Items ===\n');
const itemIssues = findMissingAuraRefs(itemsDir);
allIssues.push(...itemIssues);
if (itemIssues.length === 0) {
    console.log('No issues found in items.\n');
} else {
    itemIssues.forEach(i => {
        console.log(`${i.file}:${i.line}`);
        console.log(`  Issue: ${i.issue}`);
        console.log(`  Type: ${i.type}`);
        if (i.auraRef) console.log(`  Aura Ref: ${i.auraRef}`);
        console.log(`  Object: ${i.obj}`);
        console.log();
    });
}

console.log('\n=== Summary ===');
console.log(`Total issues found: ${allIssues.length}`);
console.log(`  Areas: ${areaIssues.length}`);
console.log(`  Combat Jobs: ${jobIssues.length}`);
console.log(`  Passive Jobs: ${passiveIssues.length}`);
console.log(`  Items: ${itemIssues.length}`);
