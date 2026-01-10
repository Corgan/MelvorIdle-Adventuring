const { loadModule } = mod.getContext(import.meta);

/**
 * Render queue for achievement UI updates
 */
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

/**
 * Achievement statistics class - tracks all stat-based progress
 */
export class AchievementStats {
    constructor() {
        this.totalKills = 0;
        this.killsByTag = {};
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
    }

    /**
     * Encode stats to save
     */
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
        
        // Write kills by tag
        const tagEntries = Object.entries(this.killsByTag);
        writer.writeUint16(tagEntries.length);
        for(const [tag, count] of tagEntries) {
            writer.writeString(tag);
            writer.writeUint32(count);
        }
        
        // Write fast wins
        const fastEntries = Object.entries(this.fastWins);
        writer.writeUint16(fastEntries.length);
        for(const [rounds, count] of fastEntries) {
            writer.writeUint8(parseInt(rounds));
            writer.writeUint32(count);
        }
    }

    /**
     * Decode stats from save
     */
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
        
        // Read kills by tag
        this.killsByTag = {};
        const tagCount = reader.getUint16();
        for(let i = 0; i < tagCount; i++) {
            const tag = reader.getString();
            const count = reader.getUint32();
            this.killsByTag[tag] = count;
        }
        
        // Read fast wins
        this.fastWins = {};
        const fastCount = reader.getUint16();
        for(let i = 0; i < fastCount; i++) {
            const rounds = reader.getUint8();
            const count = reader.getUint32();
            this.fastWins[rounds] = count;
        }
    }
}

/**
 * Achievement category for grouping achievements
 */
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

/**
 * Achievement definition - static data loaded from JSON
 */
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
        
        // Link to category
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

    /**
     * Get current progress towards this achievement
     */
    getProgress() {
        const req = this.requirement;
        const stats = this.manager.achievementManager.stats;
        
        switch(req.type) {
            case 'total_kills':
                return stats.totalKills;
            case 'kills_by_tag':
                return stats.killsByTag[req.tag] || 0;
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
                // If job is specified, check that specific job's level
                if(req.job) {
                    return this._getSpecificJobLevel(req.job);
                }
                // Otherwise check highest job level
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
            // Area cleared - check if masteryXP > 0 (any XP means at least 1 clear)
            case 'area_cleared':
                const area = this.manager.areas.getObjectByID(req.area);
                if (!area) return 0;
                return this.manager.getMasteryXP(area) > 0 ? 1 : 0;
            // Total endless waves completed across all dungeons
            case 'total_endless_waves':
                return stats.totalEndlessWaves;
            // Equipment set bonus - check if any hero has X pieces equipped
            case 'set_bonus_active':
                return this._getMaxSetBonusPieces() >= req.pieces ? 1 : 0;
            // Monster mastery - highest mastery on any single monster
            case 'monster_mastery':
                return this._getHighestMonsterMastery();
            // Total monster mastery - sum of all monster mastery levels
            case 'total_monster_mastery':
                return this._getTotalMonsterMastery();
            default:
                return 0;
        }
    }

    /**
     * Helper: Get max equipped set pieces across all heroes
     */
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

    /**
     * Helper: Get highest mastery level on any single monster (cached per check cycle)
     */
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

    /**
     * Helper: Get sum of all monster mastery levels (cached per check cycle)
     */
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

    /**
     * Get required target for completion
     */
    getTarget() {
        const req = this.requirement;
        // Some requirements use 'level' instead of 'target'
        if(req.level !== undefined) return req.level;
        // Boolean checks use target: 1
        if(req.type === 'all_passive_jobs_level')
            return this.manager.passiveJobs.length || 1;
        if(req.type === 'job_unlocked' || req.type === 'area_cleared' || req.type === 'set_bonus_active') {
            return 1;
        }
        return req.target || 1;
    }

    /**
     * Check if this achievement is complete
     */
    isComplete() {
        return this.manager.achievementManager.completedAchievements.has(this);
    }

    /**
     * Check if requirements are met (but not yet claimed)
     */
    isMet() {
        return this.getProgress() >= this.getTarget();
    }

    /**
     * Get progress as percentage (0-100)
     */
    getProgressPercent() {
        return Math.min(100, Math.floor((this.getProgress() / this.getTarget()) * 100));
    }

    /**
     * Helper: Get highest job level (cached per check cycle)
     */
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

    /**
     * Helper: Count jobs at or above a level (cached per check cycle with level key)
     */
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

    /**
     * Helper: Check if a job is unlocked (all requirements met)
     */
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

    /**
     * Helper: Check if all jobs of a tier are unlocked (cached per check cycle)
     */
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

    /**
     * Helper: Get highest passive job level (cached per check cycle)
     */
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

    /**
     * Helper: Check if all passive jobs are at or above a level (cached per check cycle)
     */
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

    /**
     * Helper: Get a specific job's level
     */
    _getSpecificJobLevel(jobId) {
        const job = this.manager.jobs.getObjectByID(jobId);
        if(!job) return 0;
        return this.manager.getMasteryLevel(job) || 1;
    }

    /**
     * Helper: Get highest area mastery level (cached per check cycle)
     */
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

    /**
     * Format rewards for display
     */
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

    /**
     * Get the ability reward if this achievement grants one
     */
    getAbilityReward() {
        const abilityReward = this.rewards.find(r => r.type === 'ability');
        if(!abilityReward) return null;
        return this.manager.getAbilityByID(abilityReward.id);
    }
}

/**
 * Achievement manager - handles tracking, completion, rewards, and permanent bonuses
 * Accessible via manager.achievementManager
 */
export class AchievementManager {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.renderQueue = new AdventuringAchievementRenderQueue();
        
        // Achievement stats
        this.stats = new AchievementStats();
        
        // Completed achievements - stored as NamespacedObject Set
        this.completedAchievements = new Set();
        
        // Effect cache for permanent bonuses from achievements
        this.bonusEffects = null; // Will be initialized when EffectCache is available
        
        // Dirty flag - marks achievements as needing a check
        // Checked once per tick instead of on every event
        this._needsCheck = false;
    }

    /**
     * Initialize the achievement system
     */
    init() {
        // Create effect cache for permanent bonuses
        const { EffectCache } = loadModule('src/core/adventuring-utils.mjs');
        if(typeof EffectCache !== 'undefined') {
            this.bonusEffects = new EffectCache();
            this.bonusEffects.registerSource('achievements', () => this._getAchievementEffects());
        }
    }

    /**
     * Get permanent effects from completed achievements
     * @returns {StandardEffect[]}
     */
    _getAchievementEffects() {
        const effects = [];
        
        for(const achievement of this.completedAchievements) {
            for(const reward of achievement.rewards) {
                if(reward.type === 'effect') {
                    // Add all effects from the effect reward
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

    /**
     * Rebuild bonus effects cache
     */
    rebuildBonuses() {
        if(this.bonusEffects) {
            this.bonusEffects.invalidate('achievements');
        }
    }

    /**
     * Get permanent stat bonus from completed achievements
     */
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

    /**
     * Get all unlocked achievement abilities (derived from completedAchievements)
     */
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

    /**
     * Check if an ability is unlocked from achievements
     */
    isAbilityUnlocked(abilityId) {
        for(const achievement of this.completedAchievements) {
            const ability = achievement.getAbilityReward();
            if(ability && ability.id === abilityId) {
                return true;
            }
        }
        return false;
    }

    /**
     * Record a monster kill
     */
    recordKill(monster) {
        this.stats.totalKills++;
        
        // Track by tag
        if(monster.tags) {
            for(const tag of monster.tags) {
                const tagId = typeof tag === 'string' ? tag : tag.id;
                const tagName = tagId.replace('adventuring:', '');
                this.stats.killsByTag[tagName] = (this.stats.killsByTag[tagName] || 0) + 1;
            }
        }
        
        this.markDirty();
    }

    /**
     * Record a dungeon clear
     */
    recordDungeonClear(area, difficulty, isEndless, endlessWave) {
        this.stats.totalClears++;
        
        if(difficulty === 'heroic') {
            this.stats.heroicClears++;
        } else if(difficulty === 'mythic') {
            this.stats.mythicClears++;
        }
        
        if(isEndless) {
            // Track best wave reached
            if(endlessWave > this.stats.bestEndlessWave) {
                this.stats.bestEndlessWave = endlessWave;
            }
            // Track total waves completed
            this.stats.totalEndlessWaves += endlessWave;
        }
        
        this.markDirty();
    }

    /**
     * Record materials collected
     */
    recordMaterials(qty) {
        this.stats.totalMaterials += qty;
        this.markDirty();
    }

    /**
     * Record currency earned
     */
    recordCurrency(qty) {
        this.stats.totalCurrencyEarned += qty;
        this.markDirty();
    }

    /**
     * Record a new unique monster seen
     */
    recordUniqueMonster() {
        this.stats.uniqueMonstersSeen++;
        this.markDirty();
    }

    /**
     * Record combat stats
     */
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

    /**
     * Record slayer task completion
     */
    recordSlayerTask() {
        this.stats.slayerTasksCompleted++;
        this.markDirty();
    }

    /**
     * Mark achievements as needing a check (called by stat recording methods)
     */
    markDirty() {
        this._needsCheck = true;
    }

    /**
     * Check achievements if dirty (called once per tick)
     */
    checkIfDirty() {
        if(this._needsCheck) {
            this._needsCheck = false;
            this.checkAchievements();
        }
    }

    /**
     * Check all achievements for completion
     */
    checkAchievements() {
        let newCompletions = false;
        
        // Cache expensive computed values for this check cycle
        this._checkCache = {};
        
        for(const achievement of this.manager.achievements.allObjects) {
            if(!achievement.isComplete() && achievement.isMet()) {
                this.completeAchievement(achievement);
                newCompletions = true;
            }
        }
        
        // Clear the cache
        this._checkCache = null;
        
        if(newCompletions) {
            this.renderQueue.completed = true;
        }
    }

    /**
     * Complete an achievement and grant rewards
     */
    completeAchievement(achievement) {
        if(achievement.isComplete()) return;
        
        // Mark as complete (stores the actual object)
        this.completedAchievements.add(achievement);
        
        // Grant rewards (except effect and ability, which are derived)
        for(const reward of achievement.rewards) {
            this.grantReward(reward);
        }
        
        // Rebuild bonus effects cache
        this.rebuildBonuses();
        
        // Show notification (skip during offline progress)
        if(typeof notifyPlayer === 'function' && !loadingOfflineProgress) {
            notifyPlayer(this.manager, `Achievement Unlocked: ${achievement.name}`, 'success');
        }
        
        // Trigger render update
        this.renderQueue.completed = true;
    }

    /**
     * Grant a single reward (only material/currency rewards, not permanent bonuses or abilities)
     */
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
                
            // effect and ability are now derived from completedAchievements
            // No need to store them separately
        }
    }

    /**
     * Get all achievements in a category
     */
    getAchievementsByCategory(category) {
        return this.manager.achievements.allObjects.filter(a => a.category === category);
    }

    /**
     * Get completion stats
     */
    getCompletionStats() {
        const total = this.manager.achievements.allObjects.length;
        const completed = this.completedAchievements.size;
        return { total, completed, percent: Math.floor((completed / total) * 100) };
    }

    /**
     * Reset all achievement state (for skill reset)
     */
    resetAll() {
        // Reset stats by creating a fresh AchievementStats object
        this.stats = new AchievementStats();
        
        // Clear completed achievements
        this.completedAchievements.clear();
        
        // Clear bonuses
        this.rebuildBonuses();
        
        this.renderQueue.completed = true;
    }

    /**
     * Encode for save
     */
    encode(writer) {
        // Encode stats
        this.stats.encode(writer);
        
        // Encode completed achievements as NamespacedObject set
        writer.writeSet(this.completedAchievements, (achievement, w) => {
            w.writeNamespacedObject(achievement);
        });
    }

    /**
     * Decode from save
     */
    decode(reader, version) {
        // Decode stats
        this.stats.decode(reader, version);
        
        // Decode completed achievements as NamespacedObject set
        reader.getSet((r) => {
            const achievement = r.getNamespacedObject(this.manager.achievements);
            if (achievement && typeof achievement !== 'string') {
                this.completedAchievements.add(achievement);
            }
        });
        
        // Rebuild bonus effects from loaded achievements
        this.rebuildBonuses();
    }
}
