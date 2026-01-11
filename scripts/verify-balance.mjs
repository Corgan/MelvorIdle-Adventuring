/**
 * Verify Balance Changes Script
 * Confirms the new XP balance settings are correctly configured
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, '..', 'data');

// Load data files
const difficulties = JSON.parse(fs.readFileSync(path.join(dataPath, 'difficulties.json'), 'utf-8'));
const mastery = JSON.parse(fs.readFileSync(path.join(dataPath, 'mastery.json'), 'utf-8'));

console.log('='.repeat(70));
console.log('BALANCE VERIFICATION - XP Scaling Changes');
console.log('='.repeat(70));

// Extract difficulties
const diffData = difficulties.data.skillData[0].data.difficulties;

console.log('\n📊 DIFFICULTY XP BONUSES:');
console.log('-'.repeat(50));
for (const diff of diffData) {
    const xpEffect = diff.effects.find(e => e.type === 'xp_percent');
    const xpBonus = xpEffect ? xpEffect.amount : 0;
    const waveScaling = diff.waveScaling?.rewardPercentPerWave || 0;
    
    console.log(`  ${diff.name.padEnd(10)} | +${xpBonus}% XP | Wave Scaling: +${waveScaling}%/wave`);
    if (diff.id === 'endless') {
        console.log(`            | At Wave 15: +${xpBonus + (waveScaling * 15)}% XP`);
    }
}

// Extract mastery categories
const masteryData = mastery.data.skillData[0].data.masteryCategories;

console.log('\n📈 MASTERY XP MILESTONES:');
console.log('-'.repeat(50));
for (const cat of masteryData) {
    console.log(`\n  ${cat.name}:`);
    const xpMilestones = cat.milestones
        .filter(m => m.effects.some(e => e.type === 'xp_percent'))
        .map(m => {
            const xpEffect = m.effects.find(e => e.type === 'xp_percent');
            return { level: m.level, bonus: xpEffect.amount };
        })
        .sort((a, b) => a.level - b.level);
    
    for (const m of xpMilestones) {
        console.log(`    Level ${m.level.toString().padStart(2)}: +${m.bonus}% XP`);
    }
    
    // Total milestone bonus at 90+
    const totalBonus = xpMilestones.reduce((sum, m) => sum + m.bonus, 0);
    console.log(`    [Total at 90+: +${totalBonus}% XP]`);
}

// Calculate effective multipliers
console.log('\n' + '='.repeat(70));
console.log('EFFECTIVE XP MULTIPLIERS BY SCENARIO:');
console.log('='.repeat(70));

const endlessData = diffData.find(d => d.id === 'endless');
const endlessBase = endlessData.effects.find(e => e.type === 'xp_percent').amount;
const waveScale = endlessData.waveScaling.rewardPercentPerWave;

// Get total milestone bonus (all milestones are cumulative)
const monsterMilestones = masteryData.find(c => c.id === 'monsters').milestones
    .filter(m => m.effects.some(e => e.type === 'xp_percent'));
const totalMilestoneBonus = monsterMilestones.reduce((sum, m) => {
    const xp = m.effects.find(e => e.type === 'xp_percent');
    return sum + (xp ? xp.amount : 0);
}, 0);

console.log('\n  Early Game (Normal, No Milestones):');
console.log(`    Multiplier: 1.0x (base XP only)`);

console.log('\n  Mid Game (Heroic, Level 50 milestones):');
const heroicData = diffData.find(d => d.id === 'heroic');
const heroicBonus = heroicData.effects.find(e => e.type === 'xp_percent').amount;
const midMilestone = 100 + 200; // Level 25 + Level 50
const midMultiplier = 1 + (heroicBonus + midMilestone) / 100;
console.log(`    Difficulty: +${heroicBonus}%`);
console.log(`    Milestones: +${midMilestone}% (L25 + L50)`);
console.log(`    Multiplier: ${midMultiplier.toFixed(1)}x`);

console.log('\n  Late Game (Endless Wave 15, Level 90 milestones):');
const wave15Bonus = endlessBase + (waveScale * 15);
const endMultiplier = 1 + (wave15Bonus + totalMilestoneBonus) / 100;
console.log(`    Difficulty: +${endlessBase}% base, +${waveScale}%/wave = +${wave15Bonus}% at W15`);
console.log(`    Milestones: +${totalMilestoneBonus}% total`);
console.log(`    Multiplier: ${endMultiplier.toFixed(1)}x`);

// Time estimates
console.log('\n' + '='.repeat(70));
console.log('TIME ESTIMATES (assuming ~670 avg monster XP, 336s dungeons):');
console.log('='.repeat(70));

const XP_PER_99 = 13034431;
const AVG_MONSTER_XP = 670;
const DUNGEON_TIME = 336; // seconds
const KILLS_PER_DUNGEON = 25;
const HOURS_PER_DAY = 24;

function calcHoursTo99(xpPerKill, killsPerDungeon, secondsPerDungeon) {
    const xpPerDungeon = xpPerKill * killsPerDungeon;
    const dungeonsTo99 = XP_PER_99 / xpPerDungeon;
    const secondsTo99 = dungeonsTo99 * secondsPerDungeon;
    return secondsTo99 / 3600;
}

const earlyHours = calcHoursTo99(AVG_MONSTER_XP * 1.0, KILLS_PER_DUNGEON, DUNGEON_TIME);
const midHours = calcHoursTo99(AVG_MONSTER_XP * midMultiplier, KILLS_PER_DUNGEON, DUNGEON_TIME);
const lateHours = calcHoursTo99(AVG_MONSTER_XP * endMultiplier, KILLS_PER_DUNGEON, DUNGEON_TIME);

console.log(`\n  Time to level 1→99 on ONE mastery:`);
console.log(`    Early Game (1.0x): ${earlyHours.toFixed(0)} hours (${(earlyHours/HOURS_PER_DAY).toFixed(1)} days)`);
console.log(`    Mid Game (${midMultiplier.toFixed(1)}x): ${midHours.toFixed(0)} hours (${(midHours/HOURS_PER_DAY).toFixed(1)} days)`);
console.log(`    Late Game (${endMultiplier.toFixed(1)}x): ${lateHours.toFixed(0)} hours (${(lateHours/HOURS_PER_DAY).toFixed(1)} days)`);

// Full completion estimate (221 monsters, 39 areas, 15 jobs, 150 equipment)
const MONSTERS = 221;
const AREAS = 39;
const JOBS = 15;
const EQUIPMENT = 150;

// Parallel progress: 5 monsters, 1 area, 3 jobs, 18 equipment per dungeon
const monsterSets = MONSTERS / 5;
const areaSets = AREAS / 1;
const jobSets = JOBS / 3;
const equipSets = EQUIPMENT / 18;

// Average time per set (weighted toward late game since that's where most grinding happens)
const avgMultiplier = (midMultiplier + endMultiplier) / 2; // Average of mid and late
const hoursPerSet = calcHoursTo99(AVG_MONSTER_XP * avgMultiplier, KILLS_PER_DUNGEON, DUNGEON_TIME);

console.log(`\n  Total 100% Completion Estimate:`);
console.log(`    Monster Sets: ${monsterSets.toFixed(0)} (5 parallel per dungeon)`);
console.log(`    Area Sets: ${areaSets.toFixed(0)} (1 per dungeon)`);
console.log(`    Job Sets: ${jobSets.toFixed(0)} (3 parallel per dungeon)`);
console.log(`    Equipment Sets: ${equipSets.toFixed(0)} (18 parallel per dungeon)`);

const longestPath = Math.max(monsterSets, areaSets, jobSets, equipSets);
const totalHours = longestPath * hoursPerSet;
console.log(`\n    Bottleneck: ${longestPath === areaSets ? 'Areas' : longestPath === monsterSets ? 'Monsters' : 'Equipment'} (${longestPath.toFixed(0)} sets)`);
console.log(`    Estimated Total: ${totalHours.toFixed(0)} hours (${(totalHours/HOURS_PER_DAY).toFixed(0)} days)`);

console.log('\n' + '='.repeat(70));
console.log('✅ Balance verification complete!');
console.log('='.repeat(70));
