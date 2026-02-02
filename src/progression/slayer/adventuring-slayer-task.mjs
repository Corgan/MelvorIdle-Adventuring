const { loadModule } = mod.getContext(import.meta);

class SlayerTaskRenderQueue {
    constructor() {
        this.progress = false;
        this.reward = false;
        this.all = false;
    }
    queueAll() {
        this.progress = true;
        this.reward = true;
        this.all = true;
    }
}

export class AdventuringRewardType extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this.registryKey = data.registryKey; // Which manager registry to use, or null for simple values (like xp)
        this.icon = data.icon;
    }

    get name() {
        return this._name;
    }

    get media() {
        return this.manager.getMediaURL(this.icon);
    }

    getRegistry() {
        if(!this.registryKey) return null;
        return this.manager[this.registryKey];
    }

    get hasItemReference() {
        return this.registryKey !== null;
    }
}

export class AdventuringSlayerTaskType extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this.descriptionTemplate = data.descriptionTemplate;
        this.progressVerb = data.progressVerb;
        this.targetType = data.targetType;
        this.targetStat = data.targetStat || null; // For stat-based tasks
        this.targetDifficulty = data.targetDifficulty || null; // For difficulty-based tasks

        this.baseRequirements = data.baseRequirements;
        this.requirementVariance = data.requirementVariance;
        this.baseRewards = data.baseRewards;
        this.materialRewardChance = data.materialRewardChance;
        this.consumableRewardChance = data.consumableRewardChance || [0, 0, 0, 0, 0];
    }

    get name() {
        return this._name;
    }

    // Get display name, optionally with tag substitution
    getDisplayName(tag = null) {
        if (tag && this._name.includes('${tagName}')) {
            return this._name.replace('${tagName}', tag.name);
        }
        return this._name;
    }

    getRequiredForTier(tier) {
        const idx = Math.min(tier - 1, this.baseRequirements.length - 1);
        const base = this.baseRequirements[idx];
        const variance = this.requirementVariance[idx];
        return base + Math.floor(Math.random() * (variance + 1));
    }

    generateRewards(tier, manager) {
        const rewards = [];
        const idx = Math.min(tier - 1, 4);

        const materialType = manager.rewardTypes.getObjectByID('adventuring:material');
        const slayerCoins = manager.cached.slayerCoins;

        const baseCurrency = this.baseRewards.currency[idx];
        const currencyVar = this.baseRewards.currencyVariance[idx];
        rewards.push({
            rewardType: materialType,
            item: slayerCoins,
            qty: baseCurrency + Math.floor(Math.random() * (currencyVar + 1))
        });

        const jobXpType = manager.rewardTypes.getObjectByID('adventuring:job_xp');
        const unlockedJobs = manager.jobs.allObjects.filter(j => j.unlocked && j !== manager.cached.noneJob);
        if(unlockedJobs.length > 0) {
            const job = unlockedJobs[Math.floor(Math.random() * unlockedJobs.length)];
            const baseXP = this.baseRewards.xp[idx];
            const xpVar = this.baseRewards.xpVariance[idx];
            rewards.push({
                rewardType: jobXpType,
                item: job,
                qty: baseXP + Math.floor(Math.random() * (xpVar + 1))
            });
        }

        const matChance = this.materialRewardChance[idx];
        if(Math.random() < matChance) {
            const materials = manager.materials.allObjects.filter(m => m.id !== 'adventuring:currency');
            if(materials.length > 0) {
                const material = materials[Math.floor(Math.random() * materials.length)];
                rewards.push({
                    rewardType: materialType,
                    item: material,
                    qty: Math.floor(tier * (1 + Math.random()))
                });
            }
        }

        const consumableChance = this.consumableRewardChance[idx];
        if(Math.random() < consumableChance) {
            const consumableType = manager.rewardTypes.getObjectByID('adventuring:consumable');
            const consumables = [...manager.consumableTypes.allObjects];
            if(consumables.length > 0) {
                const consumable = consumables[Math.floor(Math.random() * consumables.length)];
                rewards.push({
                    rewardType: consumableType,
                    item: consumable,
                    qty: Math.max(1, Math.floor(tier * 0.5 * (1 + Math.random())))
                });
            }
        }

        return rewards;
    }

    formatDescription(required, targetName) {
        return this.descriptionTemplate
            .replace('${required}', required)
            .replace('${targetName}', targetName);
    }
}

export class AdventuringSlayerTask {
    constructor(manager, game, taskType = null, target = null, required = 0, tier = 1, rewards = []) {
        this.manager = manager;
        this.game = game;
        this.renderQueue = new SlayerTaskRenderQueue();

        this.taskType = taskType;
        this.target = target;
        this.required = required;
        this.tier = tier;
        this.rewards = rewards;
        this.progress = 0;
        this.startingValue = 0; // For stat-based tasks, stores the stat value when task was accepted
    }

    get isStatTask() {
        return this.target && this.target.isStatTarget;
    }

    get currentProgress() {
        if (this.isStatTask && this.target.stat) {
            const currentValue = this.getStatValue(this.target.stat);
            const starting = isNaN(this.startingValue) ? 0 : this.startingValue;
            return Math.max(0, currentValue - starting);
        }
        return this.progress;
    }

    get completed() {
        return this.currentProgress >= this.required;
    }

    get targetName() {
        return this.target ? this.target.name : 'Unknown';
    }

    get targetMedia() {
        return this.target ? this.target.media : cdnMedia('assets/media/main/question.png');
    }

    get targetId() {
        return this.target ? this.target.id : null;
    }

    getTargetRegistry() {
        if(!this.taskType) return null;
        switch(this.taskType.targetType) {
            case 'monster': return this.manager.monsters;
            case 'material': return this.manager.materials;
            case 'area': return this.manager.areas;
            default: return null;
        }
    }

    getStatValue(stat) {
        if (!this.manager.achievementManager) return 0;
        const stats = this.manager.achievementManager.stats;
        return stats.get(stat);
    }

    get description() {
        if(!this.taskType) return 'Complete task';
        return this.taskType.formatDescription(this.required, this.targetName);
    }

    get progressText() {
        const progress = this.currentProgress;
        return `${Math.min(progress, this.required)} / ${this.required}`;
    }

    get progressPercent() {
        const progress = this.currentProgress;
        return Math.min(100, (progress / this.required) * 100);
    }

    addProgress(amount = 1) {
        if(this.completed) return;

        this.progress += amount;
        this.renderQueue.progress = true;

        if(this.completed) {
            this.manager.log.add(`Task complete: ${this.description}`, {
                category: 'slayer'
            });
        }
    }

    initializeStatTask() {
        if (this.isStatTask && this.target.stat) {
            this.startingValue = this.getStatValue(this.target.stat);
        }
    }

    claim() {
        if(!this.completed) return false;

        this.rewards.forEach(reward => {
            if(!reward.rewardType) return;

            const typeId = reward.rewardType.localID;
            if(typeId === 'job_xp') {
                if(reward.item && reward.item.addXP) {
                    reward.item.addXP(reward.qty);
                }
            } else if(typeId === 'material') {
                if(reward.item) {
                    this.manager.stash.add(reward.item, reward.qty);
                }
            } else if(typeId === 'consumable') {
                if(reward.item) {
                    this.manager.consumables.addCharges(reward.item, reward.qty);
                }
            }
        });

        return true;
    }

    encode(writer) {
        writer.writeNamespacedObject(this.taskType);

        // Write target type: 0 = regular, 1 = tag, 2 = stat, 3 = difficulty, 4 = endless
        const isTagTarget = this.target && this.target.isTagTarget;
        const isStatTarget = this.target && this.target.isStatTarget && this.target.stat;
        const isDifficultyTarget = this.target && this.target.isDifficultyTarget;
        const isEndlessTarget = this.target && this.target.isEndlessTarget;
        
        if (isStatTarget) {
            writer.writeUint8(2);
            writer.writeNamespacedObject(this.target.stat);
            writer.writeFloat64(this.startingValue); // Save starting value for stat tasks
        } else if (isDifficultyTarget) {
            writer.writeUint8(3);
            writer.writeNamespacedObject(this.target.difficulty);
        } else if (isEndlessTarget) {
            writer.writeUint8(4);
            // No additional data needed for endless
        } else if (isTagTarget) {
            writer.writeUint8(1);
            writer.writeNamespacedObject(this.target.tag);
        } else {
            writer.writeUint8(0);
            writer.writeNamespacedObject(this.target);
        }

        writer.writeUint16(this.required);
        writer.writeUint16(this.progress);
        writer.writeUint8(this.tier);

        writer.writeUint8(this.rewards.length);
        this.rewards.forEach(reward => {
            writer.writeNamespacedObject(reward.rewardType);

            const hasItem = reward.rewardType && reward.rewardType.hasItemReference;
            writer.writeBoolean(hasItem);
            if(hasItem) {
                writer.writeNamespacedObject(reward.item);
            }

            writer.writeUint32(reward.qty);
        });
    }

    decode(reader, version) {
        const taskType = reader.getNamespacedObject(this.manager.slayerTaskTypes);
        if(typeof taskType !== 'string' && taskType !== undefined) {
            this.taskType = taskType;
        }

        const targetType = reader.getUint8();
        
        if (targetType === 2) {
            // Stat target
            const stat = reader.getNamespacedObject(this.manager.achievementStats);
            this.startingValue = reader.getFloat64(); // Load starting value for stat tasks
            if (stat && typeof stat !== 'string') {
                this.target = {
                    id: `stat:${stat.localID}`,
                    name: this.taskType ? this.taskType.name : 'Task',
                    media: stat.media || cdnMedia('assets/media/main/statistics_header.png'),
                    isStatTarget: true,
                    stat: stat
                };
            }
        } else if (targetType === 3) {
            // Difficulty target
            const difficulty = reader.getNamespacedObject(this.manager.difficulties);
            if (difficulty && typeof difficulty !== 'string') {
                this.target = {
                    id: `difficulty:${difficulty.localID}`,
                    name: difficulty.name,
                    media: difficulty.media || cdnMedia('assets/media/main/statistics_header.png'),
                    isDifficultyTarget: true,
                    difficulty: difficulty
                };
            }
        } else if (targetType === 4) {
            // Endless target - no data to read
            this.target = {
                id: 'endless:waves',
                name: 'Endless Mode',
                media: cdnMedia('assets/media/main/statistics_header.png'),
                isEndlessTarget: true
            };
        } else if (targetType === 1) {
            // Tag target
            const tag = reader.getNamespacedObject(this.manager.tags);
            if (tag && typeof tag !== 'string') {
                const seenMonsters = this.manager.monsters.allObjects.filter(m =>
                    this.manager.bestiary.seen.has(m) && m.tags && m.tags.includes(tag.localID)
                );
                this.target = {
                    id: tag.id,
                    name: tag.name,
                    media: seenMonsters.length > 0 ? seenMonsters[0].media : tag.media,
                    isTagTarget: true,
                    tag: tag
                };
            }
        } else {
            // Regular target (type 0)
            const registry = this.getTargetRegistry() || this.manager.monsters;
            const target = reader.getNamespacedObject(registry);
            if(typeof target !== 'string' && target !== undefined) {
                this.target = target;
            }
        }

        this.required = reader.getUint16();
        this.progress = reader.getUint16();
        this.tier = reader.getUint8();

        const numRewards = reader.getUint8();
        this.rewards = [];
        for(let i = 0; i < numRewards; i++) {
            const rewardType = reader.getNamespacedObject(this.manager.rewardTypes);

            let item = null;
            const hasItem = reader.getBoolean();
            if(hasItem) {

                let itemRegistry = this.game.items;
                if (typeof rewardType !== 'string' && rewardType && typeof rewardType.getRegistry === 'function') {
                    itemRegistry = rewardType.getRegistry();
                }
                const decoded = reader.getNamespacedObject(itemRegistry);
                if(typeof decoded !== 'string' && decoded !== undefined) {
                    item = decoded;
                }
            }

            const qty = reader.getUint32();

            if(typeof rewardType !== 'string' && rewardType !== undefined) {
                this.rewards.push({
                    rewardType: rewardType,
                    item: item,
                    qty: qty
                });
            }
        }
    }
}

export class SlayerTaskGenerator {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
    }

    generateTask(taskType, tier = 1) {
        if(!taskType) return null;

        let target = null;

        switch(taskType.targetType) {
            case 'monster':
                target = this.pickMonsterTarget();
                break;
            case 'monster_tag':
                target = this.pickRandomTagTarget();
                break;
            case 'material':
                target = this.pickMaterialTarget();
                break;
            case 'area':
                target = this.pickAreaTarget();
                break;
            case 'stat':
                // Stat-based tasks use achievement stats
                target = this.createStatTarget(taskType);
                break;
            case 'difficulty':
                // Difficulty tasks don't need a stat - create a simple target
                target = this.createDifficultyTarget(taskType);
                break;
            case 'endless_wave':
                // Endless wave tasks don't need a stat - create a simple target
                target = this.createEndlessTarget(taskType);
                break;
        }

        if(!target) return null;

        const required = taskType.getRequiredForTier(tier);
        const rewards = taskType.generateRewards(tier, this.manager);

        return new AdventuringSlayerTask(this.manager, this.game, taskType, target, required, tier, rewards);
    }

    // Create a placeholder target for stat-based tasks
    createStatTarget(taskType) {
        // Map task targetStat to achievement stat ID
        const statIdMap = {
            'totalDamage': 'total_damage',
            'totalHealing': 'total_healing',
            'debuffsApplied': 'debuffs_applied',
            'buffsApplied': 'buffs_applied',
            'floorsExplored': 'floors_explored',
            'specialTilesFound': 'special_tiles_found'
        };
        const statLocalId = statIdMap[taskType.targetStat] || taskType.targetStat;
        const stat = this.manager.achievementStats.getObjectByID(`adventuring:${statLocalId}`);
        
        if (!stat) {
            console.warn(`[Adventuring] Stat not found for slayer task: adventuring:${statLocalId} (from targetStat: ${taskType.targetStat})`);
            return null; // Return null so task generation fails gracefully
        }
        
        return {
            id: `stat:${taskType.targetStat || taskType.targetType}`,
            name: taskType.name,
            media: stat.media || cdnMedia('assets/media/main/statistics_header.png'),
            isStatTarget: true,
            stat: stat
        };
    }

    // Create target for difficulty-based tasks (Heroic, Mythic clears)
    createDifficultyTarget(taskType) {
        const difficulty = this.manager.difficulties.getObjectByID(`adventuring:${taskType.targetDifficulty}`);
        return {
            id: `difficulty:${taskType.targetDifficulty}`,
            name: difficulty?.name || taskType.targetDifficulty,
            media: difficulty?.media || cdnMedia('assets/media/main/statistics_header.png'),
            isDifficultyTarget: true,
            difficulty: difficulty
        };
    }

    // Create target for endless wave tasks
    createEndlessTarget(taskType) {
        return {
            id: 'endless:waves',
            name: 'Endless Mode',
            media: cdnMedia('assets/media/main/statistics_header.png'),
            isEndlessTarget: true
        };
    }

    pickMonsterTarget() {

        const seenMonsters = this.manager.monsters.allObjects.filter(m =>
            this.manager.bestiary.seen.has(m)
        );

        if(seenMonsters.length === 0) return null;
        return seenMonsters[Math.floor(Math.random() * seenMonsters.length)];
    }

    // Get all tags that have at least one seen monster
    getAvailableTags() {
        return this.manager.tags.allObjects.filter(tag => {
            const tagId = tag.localID;
            return this.manager.monsters.allObjects.some(m =>
                this.manager.bestiary.seen.has(m) && m.tags && m.tags.includes(tagId)
            );
        });
    }

    // Pick a random tag that has seen monsters, then create the target
    pickRandomTagTarget() {
        const availableTags = this.getAvailableTags();
        if (availableTags.length === 0) return null;

        const tag = availableTags[Math.floor(Math.random() * availableTags.length)];
        return this.pickMonsterTagTarget(tag);
    }

    pickMonsterTagTarget(tag) {
        if (!tag) return null;

        const tagId = tag.localID || tag.id || tag;

        const seenMonsters = this.manager.monsters.allObjects.filter(m =>
            this.manager.bestiary.seen.has(m) && m.tags && m.tags.includes(tagId)
        );

        if(seenMonsters.length === 0) return null;

        return {
            id: tag.id,
            name: tag.name,
            media: seenMonsters[0].media,
            isTagTarget: true,
            tag: tag
        };
    }

    pickMaterialTarget() {

        const seenMaterials = this.manager.materials.allObjects.filter(m =>
            m.id !== 'adventuring:currency' && this.manager.stash.seenMaterials.has(m)
        );

        if(seenMaterials.length === 0) return null;
        return seenMaterials[Math.floor(Math.random() * seenMaterials.length)];
    }

    pickAreaTarget() {
        const unlockedAreas = this.manager.areas.allObjects.filter(a => a.unlocked);
        if(unlockedAreas.length === 0) return null;
        return unlockedAreas[Math.floor(Math.random() * unlockedAreas.length)];
    }

    canGenerateTaskType(taskType) {
        switch(taskType.targetType) {
            case 'monster':
                return this.manager.monsters.allObjects.some(m => this.manager.bestiary.seen.has(m));
            case 'monster_tag':
                // Can generate if any tag has seen monsters
                return this.getAvailableTags().length > 0;
            case 'material':
                return this.manager.materials.allObjects.some(m => 
                    m.id !== 'adventuring:currency' && this.manager.stash.seenMaterials.has(m)
                );
            case 'area':
                return this.manager.areas.allObjects.some(a => a.unlocked);
            case 'stat':
            case 'difficulty':
            case 'endless_wave':
                // Always available - these track cumulative stats
                return true;
            default:
                return false;
        }
    }

    generateAvailableTasks(count = 3) {
        const tasks = [];
        const allTaskTypes = [...this.manager.slayerTaskTypes.allObjects];

        if(allTaskTypes.length === 0) return tasks;

        const taskTypes = allTaskTypes.filter(tt => this.canGenerateTaskType(tt));
        
        if(taskTypes.length === 0) return tasks;

        const killType = this.manager.slayerTaskTypes.getObjectByID('adventuring:kill');
        if(killType && taskTypes.includes(killType)) {
            taskTypes.push(killType);
        }

        const skillLevel = this.manager.level;
        let maxTier = 1;
        if(skillLevel >= 80) maxTier = 5;
        else if(skillLevel >= 60) maxTier = 4;
        else if(skillLevel >= 40) maxTier = 3;
        else if(skillLevel >= 20) maxTier = 2;

        for(let i = 0; i < count; i++) {
            const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
            const tier = Math.max(1, Math.floor(Math.random() * maxTier) + 1);

            const task = this.generateTask(taskType, tier);
            if(task) {
                tasks.push(task);
            }
        }

        return tasks;
    }
}
