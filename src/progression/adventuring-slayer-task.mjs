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

/**
 * Defines a type of reward (currency, xp, material, consumable, etc.)
 * Extensible via JSON data
 */
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

    /**
     * Get the registry for this reward type's items (if any)
     */
    getRegistry() {
        if(!this.registryKey) return null;
        return this.manager[this.registryKey];
    }

    /**
     * Whether this reward type references items from a registry
     */
    get hasItemReference() {
        return this.registryKey !== null;
    }
}

/**
 * Defines a type of slayer task (kill, collect, clear)
 * Static configuration loaded from JSON
 */
export class AdventuringSlayerTaskType extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;
        
        this._name = data.name;
        this.descriptionTemplate = data.descriptionTemplate;
        this.progressVerb = data.progressVerb;
        this.targetType = data.targetType; // 'monster', 'material', 'area', 'monster_tag'
        
        // For monster_tag target type, specifies which tag to filter by
        this.targetTag = (data.targetTag !== undefined) ? data.targetTag : null;
        
        // Tier-indexed arrays (index 0 = tier 1)
        this.baseRequirements = data.baseRequirements;
        this.requirementVariance = data.requirementVariance;
        this.baseRewards = data.baseRewards;
        this.materialRewardChance = data.materialRewardChance;
        this.consumableRewardChance = data.consumableRewardChance || [0, 0, 0, 0, 0];
    }

    get name() {
        return this._name;
    }

    /**
     * Generate required count for a tier
     */
    getRequiredForTier(tier) {
        const idx = Math.min(tier - 1, this.baseRequirements.length - 1);
        const base = this.baseRequirements[idx];
        const variance = this.requirementVariance[idx];
        return base + Math.floor(Math.random() * (variance + 1));
    }

    /**
     * Generate rewards for a tier
     */
    generateRewards(tier, manager) {
        const rewards = [];
        const idx = Math.min(tier - 1, 4);
        
        const materialType = manager.rewardTypes.getObjectByID('adventuring:material');
        const slayerCoins = manager.cached.slayerCoins;
        
        // Slayer Coins reward (slayer coins is a currency material)
        const baseCurrency = this.baseRewards.currency[idx];
        const currencyVar = this.baseRewards.currencyVariance[idx];
        rewards.push({
            rewardType: materialType,
            item: slayerCoins,
            qty: baseCurrency + Math.floor(Math.random() * (currencyVar + 1))
        });

        // Job XP reward - pick a random unlocked job (excluding 'none')
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

        // Chance for bonus material reward (excluding currency)
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

        // Chance for consumable reward
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

    /**
     * Format description with dynamic values
     */
    formatDescription(required, targetName) {
        return this.descriptionTemplate
            .replace('${required}', required)
            .replace('${targetName}', targetName);
    }
}

/**
 * A slayer task instance - references a TaskType and stores only dynamic data
 */
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
    }

    get completed() {
        return this.progress >= this.required;
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

    /**
     * Get the registry for the target type
     */
    getTargetRegistry() {
        if(!this.taskType) return null;
        switch(this.taskType.targetType) {
            case 'monster': return this.manager.monsters;
            case 'material': return this.manager.materials;
            case 'area': return this.manager.areas;
            default: return null;
        }
    }

    get description() {
        if(!this.taskType) return 'Complete task';
        return this.taskType.formatDescription(this.required, this.targetName);
    }

    get progressText() {
        return `${Math.min(this.progress, this.required)} / ${this.required}`;
    }

    get progressPercent() {
        return Math.min(100, (this.progress / this.required) * 100);
    }

    addProgress(amount = 1) {
        if(this.completed) return;
        
        this.progress += amount;
        this.renderQueue.progress = true;
        
        if(this.completed) {
            this.manager.log.add(`Task complete: ${this.description}`);
        }
    }

    claim() {
        if(!this.completed) return false;

        // Give rewards based on reward type
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
        // Encode task type first (needed to determine target registry on decode)
        writer.writeNamespacedObject(this.taskType);
        
        // Encode target using namespaced object
        writer.writeNamespacedObject(this.target);
        
        writer.writeUint16(this.required);
        writer.writeUint16(this.progress);
        writer.writeUint8(this.tier);
        
        // Encode rewards using NamespacedObject for reward type
        writer.writeUint8(this.rewards.length);
        this.rewards.forEach(reward => {
            writer.writeNamespacedObject(reward.rewardType);
            
            // Write a flag indicating if item was written, so decode can read unconditionally
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
        
        // Always read target bytes to stay in sync, use monsters as fallback registry
        const registry = this.getTargetRegistry() || this.manager.monsters;
        const target = reader.getNamespacedObject(registry);
        if(typeof target !== 'string' && target !== undefined) {
            this.target = target;
        }
        
        this.required = reader.getUint16();
        this.progress = reader.getUint16();
        this.tier = reader.getUint8();
        
        // Decode rewards using NamespacedObject for reward type
        const numRewards = reader.getUint8();
        this.rewards = [];
        for(let i = 0; i < numRewards; i++) {
            const rewardType = reader.getNamespacedObject(this.manager.rewardTypes);
            
            // Read the hasItem flag to know if we need to read item bytes
            let item = null;
            const hasItem = reader.getBoolean();
            if(hasItem) {
                // Use game.items as fallback registry for reading item bytes
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

    /**
     * Generate a task of a given type and tier
     */
    generateTask(taskType, tier = 1) {
        if(!taskType) return null;

        let target = null;
        
        switch(taskType.targetType) {
            case 'monster':
                target = this.pickMonsterTarget();
                break;
            case 'material':
                target = this.pickMaterialTarget();
                break;
            case 'area':
                target = this.pickAreaTarget();
                break;
        }

        if(!target) return null;

        const required = taskType.getRequiredForTier(tier);
        const rewards = taskType.generateRewards(tier, this.manager);

        return new AdventuringSlayerTask(this.manager, this.game, taskType, target, required, tier, rewards);
    }

    pickMonsterTarget() {
        // Only pick from monsters we've seen in the bestiary
        const seenMonsters = this.manager.monsters.allObjects.filter(m => 
            this.manager.bestiary.seen.has(m)
        );
        
        if(seenMonsters.length === 0) return null;
        return seenMonsters[Math.floor(Math.random() * seenMonsters.length)];
    }

    pickMaterialTarget() {
        // Only pick from materials we've seen, excluding currency
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

    /**
     * Generate a set of available tasks
     */
    generateAvailableTasks(count = 3) {
        const tasks = [];
        const taskTypes = [...this.manager.slayerTaskTypes.allObjects];
        
        if(taskTypes.length === 0) return tasks;

        // Weight towards kill tasks
        const killType = this.manager.slayerTaskTypes.getObjectByID('adventuring:kill');
        if(killType) taskTypes.push(killType); // Add extra weight
        
        // Determine tier based on skill level
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
