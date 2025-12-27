const { loadModule } = mod.getContext(import.meta);

/**
 * Render queue for achievement UI updates
 */
class AchievementRenderQueue {
    constructor() {
        this.progress = false;
        this.completed = false;
        this.all = false;
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
        const stats = this.manager.achievementStats;
        
        switch(req.type) {
            case 'total_kills':
                return stats.totalKills || 0;
            case 'kills_by_tag':
                return (stats.killsByTag && stats.killsByTag[req.tag]) || 0;
            case 'total_clears':
                return stats.totalClears || 0;
            case 'heroic_clears':
                return stats.heroicClears || 0;
            case 'mythic_clears':
                return stats.mythicClears || 0;
            case 'endless_wave':
                return stats.bestEndlessWave || 0;
            case 'total_materials':
                return stats.totalMaterials || 0;
            case 'total_currency':
                return stats.totalCurrencyEarned || 0;
            case 'unique_monsters':
                return stats.uniqueMonstersSeen || 0;
            case 'learned_abilities':
                return this.manager.learnedAbilities ? this.manager.learnedAbilities.size : 0;
            case 'job_level':
                return this._getHighestJobLevel();
            case 'jobs_at_level':
                return this._getJobsAtLevel(req.level);
            case 'area_mastery':
                return this._getHighestAreaMastery();
            case 'flawless_wins':
                return stats.flawlessWins || 0;
            case 'fast_wins':
                return (stats.fastWins && stats.fastWins[req.rounds]) || 0;
            case 'last_stand_wins':
                return stats.lastStandWins || 0;
            case 'total_damage':
                return stats.totalDamage || 0;
            case 'total_healing':
                return stats.totalHealing || 0;
            case 'slayer_tasks':
                return stats.slayerTasksCompleted || 0;
            case 'job_unlocked':
                return this._isJobUnlocked(req.job) ? 1 : 0;
            case 'all_jobs_tier':
                return this._areAllJobsUnlockedAtTier(req.tier) ? 1 : 0;
            default:
                return 0;
        }
    }

    /**
     * Get required target for completion
     */
    getTarget() {
        return this.requirement.target;
    }

    /**
     * Check if this achievement is complete
     */
    isComplete() {
        return this.manager.completedAchievements.has(this.id);
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
     * Helper: Get highest job level
     */
    _getHighestJobLevel() {
        let highest = 0;
        for(const job of this.manager.jobs.allObjects) {
            if(job.id === 'adventuring:none') continue;
            const level = job.level || 1;
            if(level > highest) highest = level;
        }
        return highest;
    }

    /**
     * Helper: Count jobs at or above a level
     */
    _getJobsAtLevel(targetLevel) {
        let count = 0;
        for(const job of this.manager.jobs.allObjects) {
            if(job.id === 'adventuring:none') continue;
            const level = job.level || 1;
            if(level >= targetLevel) count++;
        }
        return count;
    }

    /**
     * Helper: Check if a job is unlocked (all requirements met)
     */
    _isJobUnlocked(jobId) {
        const job = this.manager.jobs.getObjectByID(jobId);
        if(!job) return false;
        if(!job.requirements || job.requirements.length === 0) return true;
        
        for(const req of job.requirements) {
            if(req.type === 'skill_level') {
                if(this.manager.level < req.level) return false;
            }
            if(req.type === 'job_level') {
                const prereqJob = this.manager.jobs.getObjectByID(req.job);
                if(!prereqJob) return false;
                if(this.manager.getMasteryLevel(prereqJob) < req.level) return false;
            }
        }
        return true;
    }

    /**
     * Helper: Check if all jobs of a tier are unlocked
     */
    _areAllJobsUnlockedAtTier(tier) {
        const tierJobs = this.manager.jobs.allObjects.filter(job => 
            job.id !== 'adventuring:none' && job.tier === tier
        );
        if(tierJobs.length === 0) return false;
        return tierJobs.every(job => this._isJobUnlocked(job.id));
    }

    /**
     * Helper: Get highest area mastery level
     */
    _getHighestAreaMastery() {
        let highest = 0;
        for(const area of this.manager.areas.allObjects) {
            const level = this.manager.getMasteryLevel(area) || 1;
            if(level > highest) highest = level;
        }
        return highest;
    }

    /**
     * Format rewards for display
     */
    getRewardsText() {
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
                case 'permanent_stat':
                    const stat = this.manager.stats.getObjectByID(reward.stat);
                    if(stat) parts.push(`+${reward.value} ${stat.name} (permanent)`);
                    break;
            }
        }
        return parts.join(', ');
    }
}

/**
 * Achievement manager - handles tracking, completion, and rewards
 */
export class AchievementManager {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.renderQueue = new AchievementRenderQueue();
    }

    /**
     * Initialize the achievement system
     */
    init() {
        // Ensure achievement stats object exists
        if(!this.manager.achievementStats) {
            this.manager.achievementStats = this._createDefaultStats();
        }
        
        // Ensure completed achievements set exists
        if(!this.manager.completedAchievements) {
            this.manager.completedAchievements = new Set();
        }
        
        // Ensure permanent stat bonuses object exists
        if(!this.manager.achievementBonuses) {
            this.manager.achievementBonuses = {};
        }
    }

    /**
     * Create default stats object
     */
    _createDefaultStats() {
        return {
            totalKills: 0,
            killsByTag: {},
            totalClears: 0,
            heroicClears: 0,
            mythicClears: 0,
            bestEndlessWave: 0,
            totalMaterials: 0,
            totalCurrencyEarned: 0,
            uniqueMonstersSeen: 0,
            flawlessWins: 0,
            fastWins: {},
            lastStandWins: 0,
            totalDamage: 0,
            totalHealing: 0,
            slayerTasksCompleted: 0
        };
    }

    /**
     * Record a monster kill
     */
    recordKill(monster) {
        const stats = this.manager.achievementStats;
        stats.totalKills = (stats.totalKills || 0) + 1;
        
        // Track by tag
        if(!stats.killsByTag) stats.killsByTag = {};
        if(monster.tags) {
            for(const tag of monster.tags) {
                const tagId = typeof tag === 'string' ? tag : tag.id;
                const tagName = tagId.replace('adventuring:', '');
                stats.killsByTag[tagName] = (stats.killsByTag[tagName] || 0) + 1;
                
                // Check mastery milestones for this tag
                this.checkMasteryMilestones(tagName, stats.killsByTag[tagName]);
            }
        }
        
        this.checkAchievements();
    }

    /**
     * Check and unlock mastery milestones for a specific tag
     */
    checkMasteryMilestones(tagName, killCount) {
        // Ensure unlocked milestones structure exists
        if(!this.manager.unlockedMilestones[tagName]) {
            this.manager.unlockedMilestones[tagName] = new Set();
        }
        
        const unlocked = this.manager.unlockedMilestones[tagName];
        
        // Check each milestone
        for(const milestone of this.manager.masteryMilestones) {
            // Skip if already unlocked for this tag
            if(unlocked.has(milestone.id)) continue;
            
            // Check if kill count meets the threshold
            if(killCount >= milestone.level) {
                unlocked.add(milestone.id);
                this.grantMilestoneRewards(tagName, milestone);
                this.manager.log.add(`Mastery Milestone: ${milestone.name} (${tagName})!`, 'important');
            }
        }
    }

    /**
     * Grant rewards for a mastery milestone
     */
    grantMilestoneRewards(tagName, milestone) {
        for(const reward of milestone.rewards) {
            switch(reward.type) {
                case 'modifier':
                    // Store tag-specific modifiers
                    if(!this.manager.milestoneModifiers) {
                        this.manager.milestoneModifiers = {};
                    }
                    if(!this.manager.milestoneModifiers[tagName]) {
                        this.manager.milestoneModifiers[tagName] = {};
                    }
                    const currentValue = this.manager.milestoneModifiers[tagName][reward.id] || 0;
                    this.manager.milestoneModifiers[tagName][reward.id] = currentValue + reward.value;
                    break;
                    
                case 'material_bonus':
                    // Store material bonuses by tag
                    if(!this.manager.milestoneMaterialBonuses) {
                        this.manager.milestoneMaterialBonuses = {};
                    }
                    if(!this.manager.milestoneMaterialBonuses[tagName]) {
                        this.manager.milestoneMaterialBonuses[tagName] = 0;
                    }
                    this.manager.milestoneMaterialBonuses[tagName] += reward.value;
                    break;
                    
                case 'unlock':
                    // Track general unlocks
                    if(!this.manager.milestoneUnlocks) {
                        this.manager.milestoneUnlocks = new Set();
                    }
                    this.manager.milestoneUnlocks.add(reward.id);
                    break;
                    
                case 'cosmetic':
                    // Track cosmetic unlocks
                    if(!this.manager.milestoneCosmeticUnlocks) {
                        this.manager.milestoneCosmeticUnlocks = new Set();
                    }
                    this.manager.milestoneCosmeticUnlocks.add(`${tagName}:${reward.id}`);
                    break;
                    
                case 'ability':
                    // Store ability bonuses by tag
                    if(!this.manager.milestoneAbilities) {
                        this.manager.milestoneAbilities = {};
                    }
                    if(!this.manager.milestoneAbilities[tagName]) {
                        this.manager.milestoneAbilities[tagName] = {};
                    }
                    this.manager.milestoneAbilities[tagName][reward.id] = reward.value;
                    break;
            }
        }
    }

    /**
     * Get damage bonus against a monster with specific tags
     * @deprecated Use manager.modifiers.getMilestoneDamageBonusVsType() or getTotalDamageBonusVsType()
     */
    getMilestoneDamageBonus(tags) {
        return this.manager.modifiers.getMilestoneDamageBonusVsType(tags);
    }

    /**
     * Get damage reduction against a monster with specific tags
     * @deprecated Use manager.modifiers.getMilestoneDamageReductionVsType() or getTotalDamageReductionVsType()
     */
    getMilestoneDamageReduction(tags) {
        return this.manager.modifiers.getMilestoneDamageReductionVsType(tags);
    }

    /**
     * Record a dungeon clear
     */
    recordDungeonClear(area, difficulty, isEndless, endlessWave) {
        const stats = this.manager.achievementStats;
        stats.totalClears = (stats.totalClears || 0) + 1;
        
        if(difficulty === 'heroic') {
            stats.heroicClears = (stats.heroicClears || 0) + 1;
        } else if(difficulty === 'mythic') {
            stats.mythicClears = (stats.mythicClears || 0) + 1;
        }
        
        if(isEndless && endlessWave > (stats.bestEndlessWave || 0)) {
            stats.bestEndlessWave = endlessWave;
        }
        
        this.checkAchievements();
    }

    /**
     * Record materials collected
     */
    recordMaterials(qty) {
        const stats = this.manager.achievementStats;
        stats.totalMaterials = (stats.totalMaterials || 0) + qty;
        this.checkAchievements();
    }

    /**
     * Record currency earned
     */
    recordCurrency(qty) {
        const stats = this.manager.achievementStats;
        stats.totalCurrencyEarned = (stats.totalCurrencyEarned || 0) + qty;
        this.checkAchievements();
    }

    /**
     * Record a new unique monster seen
     */
    recordUniqueMonster() {
        const stats = this.manager.achievementStats;
        stats.uniqueMonstersSeen = (stats.uniqueMonstersSeen || 0) + 1;
        this.checkAchievements();
    }

    /**
     * Record combat stats
     */
    recordCombatEnd(flawless, rounds, lastStand, totalDamage, totalHealing) {
        const stats = this.manager.achievementStats;
        
        if(flawless) {
            stats.flawlessWins = (stats.flawlessWins || 0) + 1;
        }
        
        if(rounds <= 3) {
            if(!stats.fastWins) stats.fastWins = {};
            stats.fastWins[3] = (stats.fastWins[3] || 0) + 1;
        }
        
        if(lastStand) {
            stats.lastStandWins = (stats.lastStandWins || 0) + 1;
        }
        
        stats.totalDamage = (stats.totalDamage || 0) + totalDamage;
        stats.totalHealing = (stats.totalHealing || 0) + totalHealing;
        
        this.checkAchievements();
    }

    /**
     * Record slayer task completion
     */
    recordSlayerTask() {
        const stats = this.manager.achievementStats;
        stats.slayerTasksCompleted = (stats.slayerTasksCompleted || 0) + 1;
        this.checkAchievements();
    }

    /**
     * Check all achievements for completion
     */
    checkAchievements() {
        let newCompletions = false;
        
        for(const achievement of this.manager.achievements.allObjects) {
            if(!achievement.isComplete() && achievement.isMet()) {
                this.completeAchievement(achievement);
                newCompletions = true;
            }
        }
        
        if(newCompletions) {
            this.renderQueue.completed = true;
        }
    }

    /**
     * Complete an achievement and grant rewards
     */
    completeAchievement(achievement) {
        if(achievement.isComplete()) return;
        
        // Mark as complete
        this.manager.completedAchievements.add(achievement.id);
        
        // Grant rewards
        for(const reward of achievement.rewards) {
            this.grantReward(reward);
        }
        
        // Show notification
        if(typeof notifyPlayer === 'function') {
            notifyPlayer(this.manager, `Achievement Unlocked: ${achievement.name}`, 'success');
        }
        
        // Trigger render update
        this.renderQueue.completed = true;
    }

    /**
     * Grant a single reward
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
                
            case 'permanent_stat':
                // Add to permanent bonuses
                if(!this.manager.achievementBonuses) {
                    this.manager.achievementBonuses = {};
                }
                const statId = reward.stat;
                this.manager.achievementBonuses[statId] = 
                    (this.manager.achievementBonuses[statId] || 0) + reward.value;
                break;
                
            case 'ability':
                // Unlock an achievement ability (works like Blue Mage learning)
                if(reward.id && !this.manager.unlockedAchievementAbilities.has(reward.id)) {
                    this.manager.unlockedAchievementAbilities.add(reward.id);
                }
                break;
        }
    }

    /**
     * Get permanent stat bonus from achievements
     */
    getStatBonus(statId) {
        if(!this.manager.achievementBonuses) return 0;
        return this.manager.achievementBonuses[statId] || 0;
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
        const completed = this.manager.completedAchievements.size;
        return { total, completed, percent: Math.floor((completed / total) * 100) };
    }

    /**
     * Encode for save
     */
    encode(writer) {
        const stats = this.manager.achievementStats || this._createDefaultStats();
        
        // Write stats
        writer.writeUint32(stats.totalKills || 0);
        writer.writeUint32(stats.totalClears || 0);
        writer.writeUint32(stats.heroicClears || 0);
        writer.writeUint32(stats.mythicClears || 0);
        writer.writeUint32(stats.bestEndlessWave || 0);
        writer.writeUint32(stats.totalMaterials || 0);
        writer.writeUint32(stats.totalCurrencyEarned || 0);
        writer.writeUint32(stats.uniqueMonstersSeen || 0);
        writer.writeUint32(stats.flawlessWins || 0);
        writer.writeUint32(stats.lastStandWins || 0);
        writer.writeFloat64(stats.totalDamage || 0);
        writer.writeFloat64(stats.totalHealing || 0);
        writer.writeUint32(stats.slayerTasksCompleted || 0);
        
        // Write kills by tag
        const killsByTag = stats.killsByTag || {};
        const tagEntries = Object.entries(killsByTag);
        writer.writeUint16(tagEntries.length);
        for(const [tag, count] of tagEntries) {
            writer.writeString(tag);
            writer.writeUint32(count);
        }
        
        // Write fast wins
        const fastWins = stats.fastWins || {};
        const fastEntries = Object.entries(fastWins);
        writer.writeUint16(fastEntries.length);
        for(const [rounds, count] of fastEntries) {
            writer.writeUint8(parseInt(rounds));
            writer.writeUint32(count);
        }
        
        // Write completed achievements
        const completed = [...(this.manager.completedAchievements || [])];
        writer.writeUint16(completed.length);
        for(const id of completed) {
            writer.writeString(id);
        }
        
        // Write permanent bonuses
        const bonuses = this.manager.achievementBonuses || {};
        const bonusEntries = Object.entries(bonuses);
        writer.writeUint16(bonusEntries.length);
        for(const [stat, value] of bonusEntries) {
            writer.writeString(stat);
            writer.writeInt32(value);
        }
        
        // Write unlocked achievement abilities
        const abilities = [...(this.manager.unlockedAchievementAbilities || [])];
        writer.writeUint16(abilities.length);
        for(const id of abilities) {
            writer.writeString(id);
        }
        
        // Write unlocked milestones by tag
        const milestones = this.manager.unlockedMilestones || {};
        const milestoneEntries = Object.entries(milestones);
        writer.writeUint16(milestoneEntries.length);
        for(const [tag, milestoneSet] of milestoneEntries) {
            writer.writeString(tag);
            const milestoneIds = [...milestoneSet];
            writer.writeUint16(milestoneIds.length);
            for(const id of milestoneIds) {
                writer.writeString(id);
            }
        }
        
        // Write milestone modifiers
        const modifiers = this.manager.milestoneModifiers || {};
        const modEntries = Object.entries(modifiers);
        writer.writeUint16(modEntries.length);
        for(const [tag, mods] of modEntries) {
            writer.writeString(tag);
            const modPairs = Object.entries(mods);
            writer.writeUint16(modPairs.length);
            for(const [modId, value] of modPairs) {
                writer.writeString(modId);
                writer.writeInt32(value);
            }
        }
        
        // Write milestone material bonuses
        const matBonuses = this.manager.milestoneMaterialBonuses || {};
        const matEntries = Object.entries(matBonuses);
        writer.writeUint16(matEntries.length);
        for(const [tag, value] of matEntries) {
            writer.writeString(tag);
            writer.writeInt32(value);
        }
    }

    /**
     * Decode from save
     */
    decode(reader, version) {
        const stats = this._createDefaultStats();
        
        // Read stats
        stats.totalKills = reader.getUint32();
        stats.totalClears = reader.getUint32();
        stats.heroicClears = reader.getUint32();
        stats.mythicClears = reader.getUint32();
        stats.bestEndlessWave = reader.getUint32();
        stats.totalMaterials = reader.getUint32();
        stats.totalCurrencyEarned = reader.getUint32();
        stats.uniqueMonstersSeen = reader.getUint32();
        stats.flawlessWins = reader.getUint32();
        stats.lastStandWins = reader.getUint32();
        stats.totalDamage = reader.getFloat64();
        stats.totalHealing = reader.getFloat64();
        stats.slayerTasksCompleted = reader.getUint32();
        
        // Read kills by tag
        stats.killsByTag = {};
        const tagCount = reader.getUint16();
        for(let i = 0; i < tagCount; i++) {
            const tag = reader.getString();
            const count = reader.getUint32();
            stats.killsByTag[tag] = count;
        }
        
        // Read fast wins
        stats.fastWins = {};
        const fastCount = reader.getUint16();
        for(let i = 0; i < fastCount; i++) {
            const rounds = reader.getUint8();
            const count = reader.getUint32();
            stats.fastWins[rounds] = count;
        }
        
        this.manager.achievementStats = stats;
        
        // Read completed achievements
        this.manager.completedAchievements = new Set();
        const completedCount = reader.getUint16();
        for(let i = 0; i < completedCount; i++) {
            const id = reader.getString();
            this.manager.completedAchievements.add(id);
        }
        
        // Read permanent bonuses
        this.manager.achievementBonuses = {};
        const bonusCount = reader.getUint16();
        for(let i = 0; i < bonusCount; i++) {
            const stat = reader.getString();
            const value = reader.getInt32();
            this.manager.achievementBonuses[stat] = value;
        }
        
        // Read unlocked achievement abilities
        this.manager.unlockedAchievementAbilities = new Set();
        const abilityCount = reader.getUint16();
        for(let i = 0; i < abilityCount; i++) {
            const id = reader.getString();
            this.manager.unlockedAchievementAbilities.add(id);
        }
        
        // Read unlocked milestones by tag (if present in save)
        try {
            this.manager.unlockedMilestones = {};
            const milestoneTagCount = reader.getUint16();
            for(let i = 0; i < milestoneTagCount; i++) {
                const tag = reader.getString();
                const milestoneCount = reader.getUint16();
                this.manager.unlockedMilestones[tag] = new Set();
                for(let j = 0; j < milestoneCount; j++) {
                    const milestoneId = reader.getString();
                    this.manager.unlockedMilestones[tag].add(milestoneId);
                }
            }
            
            // Read milestone modifiers
            this.manager.milestoneModifiers = {};
            const modTagCount = reader.getUint16();
            for(let i = 0; i < modTagCount; i++) {
                const tag = reader.getString();
                const modCount = reader.getUint16();
                this.manager.milestoneModifiers[tag] = {};
                for(let j = 0; j < modCount; j++) {
                    const modId = reader.getString();
                    const value = reader.getInt32();
                    this.manager.milestoneModifiers[tag][modId] = value;
                }
            }
            
            // Read milestone material bonuses
            this.manager.milestoneMaterialBonuses = {};
            const matBonusCount = reader.getUint16();
            for(let i = 0; i < matBonusCount; i++) {
                const tag = reader.getString();
                const value = reader.getInt32();
                this.manager.milestoneMaterialBonuses[tag] = value;
            }
        } catch(e) {
            // Old save format without milestones - initialize empty
            this.manager.unlockedMilestones = {};
            this.manager.milestoneModifiers = {};
            this.manager.milestoneMaterialBonuses = {};
        }
    }
}
