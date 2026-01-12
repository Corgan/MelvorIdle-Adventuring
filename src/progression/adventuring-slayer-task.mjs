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

        this._targetTagId = data.targetTag || null;

        this.baseRequirements = data.baseRequirements;
        this.requirementVariance = data.requirementVariance;
        this.baseRewards = data.baseRewards;
        this.materialRewardChance = data.materialRewardChance;
        this.consumableRewardChance = data.consumableRewardChance || [0, 0, 0, 0, 0];
    }

    get targetTag() {
        if (!this._targetTagId) return null;
        const fullId = this._targetTagId.includes(':') ? this._targetTagId : `adventuring:${this._targetTagId}`;
        return this.manager.tags.getObjectByID(fullId);
    }

    get name() {
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

        const isTagTarget = this.target && this.target.isTagTarget;
        writer.writeBoolean(isTagTarget);
        if(isTagTarget) {
            writer.writeNamespacedObject(this.target.tag);
        } else {
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

        const isTagTarget = reader.getBoolean();
        if(isTagTarget) {
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
                target = this.pickMonsterTagTarget(taskType.targetTag);
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

        const seenMonsters = this.manager.monsters.allObjects.filter(m =>
            this.manager.bestiary.seen.has(m)
        );

        if(seenMonsters.length === 0) return null;
        return seenMonsters[Math.floor(Math.random() * seenMonsters.length)];
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
            case 'monster_tag': {
                const tag = taskType.targetTag;
                if (!tag) return false;
                const tagId = tag.localID || tag.id || tag;
                return this.manager.monsters.allObjects.some(m => 
                    this.manager.bestiary.seen.has(m) && m.tags && m.tags.includes(tagId)
                );
            }
            case 'material':
                return this.manager.materials.allObjects.some(m => 
                    m.id !== 'adventuring:currency' && this.manager.stash.seenMaterials.has(m)
                );
            case 'area':
                return this.manager.areas.allObjects.some(a => a.unlocked);
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
