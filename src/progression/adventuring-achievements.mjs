const { loadModule } = mod.getContext(import.meta);

class AdventuringAchievementRenderQueue {
    constructor() {
        this.progress = false;
        this.completed = false;
        this.all = false;
    }

    queueAll() {
        this.progress = true;
        this.completed = true;
        this.all = true;
    }
}

export class AchievementStats {
    constructor(manager) {
        this.manager = manager;
        this.totalKills = 0;
        this.killsByTag = new Map();
        this.totalClears = 0;
        this.heroicClears = 0;
        this.mythicClears = 0;
        this.bestEndlessWave = 0;
        this.totalMaterials = 0;
        this.totalCurrencyEarned = 0;
        this.uniqueMonstersSeen = 0;
        this.flawlessWins = 0;
        this.fastWins = {};
        this.lastStandWins = 0;
        this.totalDamage = 0;
        this.totalHealing = 0;
        this.slayerTasksCompleted = 0;
        this.totalEndlessWaves = 0;
        // Slayer task tracking stats
        this.buffsApplied = 0;
        this.debuffsApplied = 0;
        this.floorsExplored = 0;
        this.specialTilesFound = 0;
    }

    encode(writer) {
        writer.writeUint32(this.totalKills);
        writer.writeUint32(this.totalClears);
        writer.writeUint32(this.heroicClears);
        writer.writeUint32(this.mythicClears);
        writer.writeUint32(this.bestEndlessWave);
        writer.writeUint32(this.totalMaterials);
        writer.writeUint32(this.totalCurrencyEarned);
        writer.writeUint32(this.uniqueMonstersSeen);
        writer.writeUint32(this.flawlessWins);
        writer.writeUint32(this.lastStandWins);
        writer.writeFloat64(this.totalDamage);
        writer.writeFloat64(this.totalHealing);
        writer.writeUint32(this.slayerTasksCompleted);
        writer.writeUint32(this.totalEndlessWaves);
        writer.writeUint32(this.buffsApplied);
        writer.writeUint32(this.debuffsApplied);
        writer.writeUint32(this.floorsExplored);
        writer.writeUint32(this.specialTilesFound);

        writer.writeUint16(this.killsByTag.size);
        for(const [tag, count] of this.killsByTag) {
            writer.writeNamespacedObject(tag);
            writer.writeUint32(count);
        }

        const fastEntries = Object.entries(this.fastWins);
        writer.writeUint16(fastEntries.length);
        for(const [rounds, count] of fastEntries) {
            writer.writeUint8(parseInt(rounds));
            writer.writeUint32(count);
        }
    }

    decode(reader, version) {
        this.totalKills = reader.getUint32();
        this.totalClears = reader.getUint32();
        this.heroicClears = reader.getUint32();
        this.mythicClears = reader.getUint32();
        this.bestEndlessWave = reader.getUint32();
        this.totalMaterials = reader.getUint32();
        this.totalCurrencyEarned = reader.getUint32();
        this.uniqueMonstersSeen = reader.getUint32();
        this.flawlessWins = reader.getUint32();
        this.lastStandWins = reader.getUint32();
        this.totalDamage = reader.getFloat64();
        this.totalHealing = reader.getFloat64();
        this.slayerTasksCompleted = reader.getUint32();
        this.totalEndlessWaves = reader.getUint32();
        this.buffsApplied = reader.getUint32();
        this.debuffsApplied = reader.getUint32();
        this.floorsExplored = reader.getUint32();
        this.specialTilesFound = reader.getUint32();

        this.killsByTag = new Map();
        const tagCount = reader.getUint16();
        for(let i = 0; i < tagCount; i++) {
            const tag = reader.getNamespacedObject(this.manager.tags);
            const count = reader.getUint32();
            if (tag && typeof tag !== 'string') {
                this.killsByTag.set(tag, count);
            }
        }

        this.fastWins = {};
        const fastCount = reader.getUint16();
        for(let i = 0; i < fastCount; i++) {
            const rounds = reader.getUint8();
            const count = reader.getUint32();
            this.fastWins[rounds] = count;
        }
    }
}

export class AdventuringAchievementCategory extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._description = data.description;
        this._media = data.media;
    }

    get name() {
        return this._name;
    }

    get description() {
        return this._description;
    }

    get media() {
        return this.manager.getMediaURL(this._media);
    }
}

export class AdventuringAchievement extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._description = data.description;
        this._media = data.media;
        this.requirement = data.requirement;
        this.rewards = data.rewards;

        this.category = manager.achievementCategories.getObjectByID(data.category);
    }

    get name() {
        return this._name;
    }

    get description() {
        return this._description;
    }

    get media() {
        return this.manager.getMediaURL(this._media);
    }

    getProgress() {
        const req = this.requirement;
        const stats = this.manager.achievementManager.stats;

        switch(req.type) {
            case 'total_kills':
                return stats.totalKills;
            case 'kills_by_tag': {
                const fullTagId = req.tag.includes(':') ? req.tag : `adventuring:${req.tag}`;
                const tag = this.manager.tags.getObjectByID(fullTagId);
                return tag ? (stats.killsByTag.get(tag) || 0) : 0;
            }
            case 'total_clears':
                return stats.totalClears;
            case 'heroic_clears':
                return stats.heroicClears;
            case 'mythic_clears':
                return stats.mythicClears;
            case 'endless_wave':
                return stats.bestEndlessWave;
            case 'total_materials':
                return stats.totalMaterials;
            case 'total_currency':
                return stats.totalCurrencyEarned;
            case 'unique_monsters':
                return stats.uniqueMonstersSeen;
            case 'learned_abilities':
                return this.manager.learnedAbilities ? this.manager.learnedAbilities.size : 0;
            case 'job_level':

                if(req.job) {
                    return this._getSpecificJobLevel(req.job);
                }

                return this._getHighestJobLevel();
            case 'jobs_at_level':
                return this._getJobsAtLevel(req.level);
            case 'area_mastery':
                return this._getHighestAreaMastery();
            case 'flawless_wins':
                return stats.flawlessWins;
            case 'fast_wins':
                return stats.fastWins[req.rounds] || 0;
            case 'last_stand_wins':
                return stats.lastStandWins;
            case 'total_damage':
                return stats.totalDamage;
            case 'total_healing':
                return stats.totalHealing;
            case 'slayer_tasks':
                return stats.slayerTasksCompleted;
            case 'job_unlocked':
                return this._isJobUnlocked(req.job) ? 1 : 0;
            case 'any_passive_job_level':
                return this._getHighestPassiveJobLevel();
            case 'all_passive_jobs_level':
                return this._getAllPassiveJobsAtLevel(req.level) ? 1 : 0;
            case 'specific_job_level':
                return this._getSpecificJobLevel(req.job);

            case 'area_cleared':
                const area = this.manager.areas.getObjectByID(req.area);
                if (!area) return 0;
                return this.manager.getMasteryXP(area) > 0 ? 1 : 0;

            case 'total_endless_waves':
                return stats.totalEndlessWaves;

            case 'set_bonus_active':
                return this._getMaxSetBonusPieces() >= req.pieces ? 1 : 0;

            case 'monster_mastery':
                return this._getHighestMonsterMastery();

            case 'total_monster_mastery':
                return this._getTotalMonsterMastery();
            default:
                return 0;
        }
    }

    _getMaxSetBonusPieces() {
        let maxPieces = 0;
        if (!this.manager.equipmentSets) return 0;

        for (const hero of this.manager.party.all) {
            for (const set of this.manager.equipmentSets.allObjects) {
                const pieces = set.countEquippedPieces(hero);
                if (pieces > maxPieces) maxPieces = pieces;
            }
        }
        return maxPieces;
    }

    _getHighestMonsterMastery() {
        const cache = this.manager.achievementManager._checkCache;
        if(cache && cache.highestMonsterMastery !== undefined) {
            return cache.highestMonsterMastery;
        }

        let highest = 0;
        for (const monster of this.manager.monsters.allObjects) {
            const mastery = this.manager.getMasteryLevel(monster) || 0;
            if (mastery > highest) highest = mastery;
        }

        if(cache) cache.highestMonsterMastery = highest;
        return highest;
    }

    _getTotalMonsterMastery() {
        const cache = this.manager.achievementManager._checkCache;
        if(cache && cache.totalMonsterMastery !== undefined) {
            return cache.totalMonsterMastery;
        }

        let total = 0;
        for (const monster of this.manager.monsters.allObjects) {
            total += this.manager.getMasteryLevel(monster) || 0;
        }

        if(cache) cache.totalMonsterMastery = total;
        return total;
    }

    getTarget() {
        const req = this.requirement;

        if(req.level !== undefined) return req.level;

        if(req.type === 'all_passive_jobs_level')
            return this.manager.passiveJobs.length || 1;
        if(req.type === 'job_unlocked' || req.type === 'area_cleared' || req.type === 'set_bonus_active') {
            return 1;
        }
        return req.target || 1;
    }

    isComplete() {
        return this.manager.achievementManager.completedAchievements.has(this);
    }

    isMet() {
        return this.getProgress() >= this.getTarget();
    }

    getProgressPercent() {
        return Math.min(100, Math.floor((this.getProgress() / this.getTarget()) * 100));
    }

    _getHighestJobLevel() {
        const cache = this.manager.achievementManager._checkCache;
        if(cache && cache.highestJobLevel !== undefined) {
            return cache.highestJobLevel;
        }

        let highest = 0;
        const noneJob = this.manager.cached.noneJob;
        for(const job of this.manager.jobs.allObjects) {
            if(job === noneJob) continue;
            const level = job.level || 1;
            if(level > highest) highest = level;
        }

        if(cache) cache.highestJobLevel = highest;
        return highest;
    }

    _getJobsAtLevel(targetLevel) {
        const cache = this.manager.achievementManager._checkCache;
        const cacheKey = `jobsAtLevel_${targetLevel}`;
        if(cache && cache[cacheKey] !== undefined) {
            return cache[cacheKey];
        }

        let count = 0;
        const noneJob = this.manager.cached.noneJob;
        for(const job of this.manager.jobs.allObjects) {
            if(job === noneJob) continue;
            const level = job.level || 1;
            if(level >= targetLevel) count++;
        }

        if(cache) cache[cacheKey] = count;
        return count;
    }

    _isJobUnlocked(jobId) {
        const cache = this.manager.achievementManager._checkCache;
        const cacheKey = `jobUnlocked_${jobId}`;
        if(cache && cache[cacheKey] !== undefined) {
            return cache[cacheKey];
        }

        const job = this.manager.jobs.getObjectByID(jobId);
        if(!job) {
            if(cache) cache[cacheKey] = false;
            return false;
        }
        if(!job.requirements || job.requirements.length === 0) {
            if(cache) cache[cacheKey] = true;
            return true;
        }

        for(const req of job.requirements) {
            if(req.type === 'skill_level') {
                if(this.manager.level < req.level) {
                    if(cache) cache[cacheKey] = false;
                    return false;
                }
            }
            if(req.type === 'job_level') {
                const prereqJob = this.manager.jobs.getObjectByID(req.job);
                if(!prereqJob) {
                    if(cache) cache[cacheKey] = false;
                    return false;
                }
                if(this.manager.getMasteryLevel(prereqJob) < req.level) {
                    if(cache) cache[cacheKey] = false;
                    return false;
                }
            }
        }

        if(cache) cache[cacheKey] = true;
        return true;
    }

    _areAllJobsUnlockedAtTier(tier) {
        const cache = this.manager.achievementManager._checkCache;
        const cacheKey = `allJobsTier_${tier}`;
        if(cache && cache[cacheKey] !== undefined) {
            return cache[cacheKey];
        }

        const noneJob = this.manager.cached.noneJob;
        const tierJobs = this.manager.jobs.allObjects.filter(job =>
            job !== noneJob && job.tier === tier
        );
        if(tierJobs.length === 0) {
            if(cache) cache[cacheKey] = false;
            return false;
        }
        const result = tierJobs.every(job => this._isJobUnlocked(job.id));

        if(cache) cache[cacheKey] = result;
        return result;
    }

    _getHighestPassiveJobLevel() {
        const cache = this.manager.achievementManager._checkCache;
        if(cache && cache.highestPassiveJobLevel !== undefined) {
            return cache.highestPassiveJobLevel;
        }

        let highest = 0;
        const noneJob = this.manager.cached.noneJob;
        for(const job of this.manager.jobs.allObjects) {
            if(job === noneJob || !job.isPassive) continue;
            const level = this.manager.getMasteryLevel(job) || 1;
            if(level > highest) highest = level;
        }

        if(cache) cache.highestPassiveJobLevel = highest;
        return highest;
    }

    _getAllPassiveJobsAtLevel(targetLevel) {
        const cache = this.manager.achievementManager._checkCache;
        const cacheKey = `allPassiveJobsAtLevel_${targetLevel}`;
        if(cache && cache[cacheKey] !== undefined) {
            return cache[cacheKey];
        }

        const noneJob = this.manager.cached.noneJob;
        const passiveJobs = this.manager.jobs.allObjects.filter(job =>
            job !== noneJob && job.isPassive
        );
        if(passiveJobs.length === 0) {
            if(cache) cache[cacheKey] = false;
            return false;
        }
        const result = passiveJobs.every(job => {
            const level = this.manager.getMasteryLevel(job) || 1;
            return level >= targetLevel;
        });

        if(cache) cache[cacheKey] = result;
        return result;
    }

    _getSpecificJobLevel(jobId) {
        const job = this.manager.jobs.getObjectByID(jobId);
        if(!job) return 0;
        return this.manager.getMasteryLevel(job) || 1;
    }

    _getHighestAreaMastery() {
        const cache = this.manager.achievementManager._checkCache;
        if(cache && cache.highestAreaMastery !== undefined) {
            return cache.highestAreaMastery;
        }

        let highest = 0;
        for(const area of this.manager.areas.allObjects) {
            const level = this.manager.getMasteryLevel(area) || 1;
            if(level > highest) highest = level;
        }

        if(cache) cache.highestAreaMastery = highest;
        return highest;
    }

    getRewardsText() {
        const { getEffectDescriptionsList } = loadModule('src/core/adventuring-utils.mjs');
        const parts = [];
        for(const reward of this.rewards) {
            switch(reward.type) {
                case 'currency':
                    parts.push(`${reward.qty} Gold`);
                    break;
                case 'material':
                    const mat = this.manager.materials.getObjectByID(reward.id);
                    if(mat) parts.push(`${reward.qty}x ${mat.name}`);
                    break;
                case 'effect':
                    const descs = getEffectDescriptionsList(reward.effects, this.manager);
                    for(const desc of descs) {
                        parts.push(`${desc} (permanent)`);
                    }
                    break;
                case 'ability':
                    const ability = this.manager.getAbilityByID(reward.id);
                    if(ability) parts.push(`Unlock: ${ability.name}`);
                    break;
            }
        }
        return parts.join(', ');
    }

    getAbilityReward() {
        const abilityReward = this.rewards.find(r => r.type === 'ability');
        if(!abilityReward) return null;
        return this.manager.getAbilityByID(abilityReward.id);
    }
}

export class AchievementManager {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.renderQueue = new AdventuringAchievementRenderQueue();

        this.stats = new AchievementStats(manager);

        this.completedAchievements = new Set();

        this.bonusEffects = null; // Will be initialized when EffectCache is available


        this._needsCheck = false;
    }

    init() {

        const { EffectCache } = loadModule('src/core/adventuring-utils.mjs');
        if(typeof EffectCache !== 'undefined') {
            this.bonusEffects = new EffectCache();
            this.bonusEffects.registerSource('achievements', () => this._getAchievementEffects());
        }
    }

    _getAchievementEffects() {
        const effects = [];

        for(const achievement of this.completedAchievements) {
            for(const reward of achievement.rewards) {
                if(reward.type === 'effect') {

                    for(const effect of reward.effects) {
                        effects.push({
                            ...effect,
                            id: `achievement:${achievement.localID}:${effect.type}:${effect.stat || ''}`,
                            source: achievement
                        });
                    }
                }
            }
        }

        return effects;
    }

    rebuildBonuses() {
        if(this.bonusEffects) {
            this.bonusEffects.invalidate('achievements');
        }
    }

    getStatBonus(statId) {
        let total = 0;
        for(const achievement of this.completedAchievements) {
            for(const reward of achievement.rewards) {
                if(reward.type === 'effect') {
                    for(const effect of reward.effects) {
                        if(effect.type === 'stat_flat' && effect.stat === statId) {
                            total += effect.amount;
                        }
                    }
                }
            }
        }
        return total;
    }

    get unlockedAbilities() {
        const abilities = new Set();
        for(const achievement of this.completedAchievements) {
            const ability = achievement.getAbilityReward();
            if(ability) {
                abilities.add(ability.id);
            }
        }
        return abilities;
    }

    isAbilityUnlocked(abilityId) {
        for(const achievement of this.completedAchievements) {
            const ability = achievement.getAbilityReward();
            if(ability && ability.id === abilityId) {
                return true;
            }
        }
        return false;
    }

    recordKill(monster) {
        this.stats.totalKills++;

        if(monster.tags) {
            for(const tagName of monster.tags) {
                const fullTagId = tagName.includes(':') ? tagName : `adventuring:${tagName}`;
                const tag = this.manager.tags.getObjectByID(fullTagId);
                if (tag) {
                    this.stats.killsByTag.set(tag, (this.stats.killsByTag.get(tag) || 0) + 1);
                }
            }
        }

        this.markDirty();
    }

    recordDungeonClear(area, difficulty, isEndless, endlessWave) {
        this.stats.totalClears++;

        if(difficulty === 'heroic') {
            this.stats.heroicClears++;
        } else if(difficulty === 'mythic') {
            this.stats.mythicClears++;
        }

        if(isEndless) {

            if(endlessWave > this.stats.bestEndlessWave) {
                this.stats.bestEndlessWave = endlessWave;
            }

            this.stats.totalEndlessWaves += endlessWave;
        }

        this.markDirty();
    }

    recordMaterials(qty) {
        this.stats.totalMaterials += qty;
        this.markDirty();
    }

    recordCurrency(qty) {
        this.stats.totalCurrencyEarned += qty;
        this.markDirty();
    }

    recordUniqueMonster() {
        this.stats.uniqueMonstersSeen++;
        this.markDirty();
    }

    recordCombatEnd(flawless, rounds, lastStand, totalDamage, totalHealing) {
        if(flawless) {
            this.stats.flawlessWins++;
        }

        if(rounds <= 3) {
            this.stats.fastWins[3] = (this.stats.fastWins[3] || 0) + 1;
        }

        if(lastStand) {
            this.stats.lastStandWins++;
        }

        this.stats.totalDamage += totalDamage;
        this.stats.totalHealing += totalHealing;

        this.markDirty();
    }

    recordSlayerTask() {
        this.stats.slayerTasksCompleted++;
        this.markDirty();
    }

    recordBuffApplied(count = 1) {
        this.stats.buffsApplied += count;
        this.markDirty();
    }

    recordDebuffApplied(count = 1) {
        this.stats.debuffsApplied += count;
        this.markDirty();
    }

    recordFloorExplored() {
        this.stats.floorsExplored++;
        this.markDirty();
    }

    recordSpecialTile() {
        this.stats.specialTilesFound++;
        this.markDirty();
    }

    markDirty() {
        this._needsCheck = true;
    }

    checkIfDirty() {
        if(this._needsCheck) {
            this._needsCheck = false;
            this.checkAchievements();
        }
    }

    checkAchievements() {
        let newCompletions = false;

        this._checkCache = {};

        for(const achievement of this.manager.achievements.allObjects) {
            if(!achievement.isComplete() && achievement.isMet()) {
                this.completeAchievement(achievement);
                newCompletions = true;
            }
        }

        this._checkCache = null;

        if(newCompletions) {
            this.renderQueue.completed = true;
        }
    }

    completeAchievement(achievement) {
        if(achievement.isComplete()) return;

        this.completedAchievements.add(achievement);

        for(const reward of achievement.rewards) {
            this.grantReward(reward);
        }

        this.rebuildBonuses();

        if(typeof notifyPlayer === 'function' && !loadingOfflineProgress) {
            notifyPlayer(this.manager, `Achievement Unlocked: ${achievement.name}`, 'success');
        }

        this.renderQueue.completed = true;
    }

    grantReward(reward) {
        switch(reward.type) {
            case 'currency':
                const currency = this.manager.materials.getObjectByID(reward.id);
                if(currency) {
                    this.manager.stash.add(currency, reward.qty);
                }
                break;

            case 'material':
                const material = this.manager.materials.getObjectByID(reward.id);
                if(material) {
                    this.manager.stash.add(material, reward.qty);
                }
                break;


        }
    }

    getAchievementsByCategory(category) {
        return this.manager.achievements.allObjects.filter(a => a.category === category);
    }

    getCompletionStats() {
        const total = this.manager.achievements.allObjects.length;
        const completed = this.completedAchievements.size;
        return { total, completed, percent: Math.floor((completed / total) * 100) };
    }

    resetAll() {

        this.stats = new AchievementStats(this.manager);

        this.completedAchievements.clear();

        this.rebuildBonuses();

        this.renderQueue.completed = true;
    }

    encode(writer) {
        this.stats.encode(writer);

        writer.writeSet(this.completedAchievements, (achievement, w) => {
            w.writeNamespacedObject(achievement);
        });
    }

    decode(reader, version) {

        this.stats.decode(reader, version);

        reader.getSet((r) => {
            const achievement = r.getNamespacedObject(this.manager.achievements);
            if (achievement && typeof achievement !== 'string') {
                this.completedAchievements.add(achievement);
            }
        });

        this.rebuildBonuses();
    }
}
