const { loadModule } = mod.getContext(import.meta);

const { AdventuringStat } = await loadModule('src/adventuring-stat.mjs');
const { AdventuringBuilding } = await loadModule('src/adventuring-building.mjs');
const { AdventuringTownAction } = await loadModule('src/adventuring-town-action.mjs');
const { AdventuringProduct } = await loadModule('src/adventuring-product.mjs');
const { AdventuringJob } = await loadModule('src/adventuring-job.mjs');
const { AdventuringGenerator } = await loadModule('src/adventuring-generator.mjs');
const { AdventuringSpender } = await loadModule('src/adventuring-spender.mjs');
const { AdventuringPassive } = await loadModule('src/adventuring-passive.mjs');
const { AdventuringBuff } = await loadModule('src/adventuring-buff.mjs');
const { AdventuringDebuff } = await loadModule('src/adventuring-debuff.mjs');
const { AdventuringArea } = await loadModule('src/adventuring-area.mjs');
const { AdventuringDifficulty } = await loadModule('src/adventuring-difficulty.mjs');
const { AdventuringMonster } = await loadModule('src/adventuring-monster.mjs');
const { AdventuringDungeonTile } = await loadModule('src/adventuring-dungeon-tile.mjs');
const { AdventuringSlayerTaskType, AdventuringRewardType } = await loadModule('src/adventuring-slayer-task.mjs');
const { AdventuringAchievementCategory, AdventuringAchievement, AchievementManager } = await loadModule('src/adventuring-achievements.mjs');

const { AdventuringOverview } = await loadModule('src/adventuring-overview.mjs');
const { AdventuringMessageLog } = await loadModule('src/adventuring-message-log.mjs');

const { AdventuringPages } = await loadModule('src/adventuring-pages.mjs');
const { AdventuringHeroParty, AdventuringEnemyParty } = await loadModule('src/adventuring-party.mjs');

const { AdventuringTown } = await loadModule('src/adventuring-town.mjs');

const { AdventuringTrainer } = await loadModule('src/adventuring-trainer.mjs');
const { AdventuringJobDetails } = await loadModule('src/adventuring-job-details.mjs');

const { AdventuringArmory } = await loadModule('src/adventuring-armory.mjs');
const { AdventuringTavern } = await loadModule('src/adventuring-tavern.mjs');
const { AdventuringSlayers } = await loadModule('src/adventuring-slayers.mjs');
const { AdventuringLemons } = await loadModule('src/adventuring-lemons.mjs');
const { AdventuringConsumables } = await loadModule('src/adventuring-consumables.mjs');
const { AdventuringConsumable } = await loadModule('src/adventuring-consumable.mjs');

const { AdventuringStash } = await loadModule('src/adventuring-stash.mjs');
const { AdventuringBestiary } = await loadModule('src/adventuring-bestiary.mjs');
const { AdventuringCrossroads } = await loadModule('src/adventuring-crossroads.mjs');
const { AdventuringDungeon } = await loadModule('src/adventuring-dungeon.mjs');
const { AdventuringEncounter } = await loadModule('src/adventuring-encounter.mjs');

const { AdventuringItemSlot } = await loadModule('src/adventuring-item-slot.mjs');
const { AdventuringItemType } = await loadModule('src/adventuring-item-type.mjs');
const { AdventuringItemBase } = await loadModule('src/adventuring-item-base.mjs');
const { AdventuringMaterial } = await loadModule('src/adventuring-material.mjs');
const { AdventuringMaterialCategory } = await loadModule('src/adventuring-material-category.mjs');
const { AdventuringConsumableCategory } = await loadModule('src/adventuring-consumable-category.mjs');
const { AdventuringMasteryCategory } = await loadModule('src/adventuring-mastery-category.mjs');

const { AdventuringTutorial } = await loadModule('src/adventuring-tutorial.mjs');
const { AdventuringTutorialManager } = await loadModule('src/adventuring-tutorial-manager.mjs');
const { AdventuringEquipmentSet } = await loadModule('src/adventuring-equipment-set.mjs');
const { AdventuringModifiers } = await loadModule('src/adventuring-modifiers.mjs');

const { AdventuringPageElement } = await loadModule('src/components/adventuring.mjs');

class AdventuringRenderQueue extends MasterySkillRenderQueue {
    constructor() {
        super(...arguments);
    }
}

export class Adventuring extends SkillWithMastery {
    constructor(namespace, game) {
        super(namespace, 'Adventuring', game);
        this.version = 4;
        this.saveVersion = -1;
        this._media = 'melvor:assets/media/main/adventure.svg';
        this.renderQueue = new AdventuringRenderQueue();
        this.isActive = false;
        this.timersPaused = false; // Used by tutorial system to pause exploration/combat

        // Blue Mage (Slayer) learned abilities
        this.learnedAbilities = new Set();
        
        // Track which abilities have been seen in picker (for NEW badge)
        this.seenAbilities = new Set();

        this.stats = new NamespaceRegistry(this.game.registeredNamespaces);
        this.buildings = new NamespaceRegistry(this.game.registeredNamespaces);
        this.townActions = new NamespaceRegistry(this.game.registeredNamespaces);
        this.products = new NamespaceRegistry(this.game.registeredNamespaces);
        this.jobs = new NamespaceRegistry(this.game.registeredNamespaces);
        this.generators = new NamespaceRegistry(this.game.registeredNamespaces);
        this.spenders = new NamespaceRegistry(this.game.registeredNamespaces);
        this.passives = new NamespaceRegistry(this.game.registeredNamespaces);
        this.auras = new NamespaceRegistry(this.game.registeredNamespaces);
        this.buffs = new NamespaceRegistry(this.game.registeredNamespaces);
        this.debuffs = new NamespaceRegistry(this.game.registeredNamespaces);
        this.areas = new NamespaceRegistry(this.game.registeredNamespaces);
        this.difficulties = new NamespaceRegistry(this.game.registeredNamespaces);
        this.dungeonAuras = new NamespaceRegistry(this.game.registeredNamespaces);
        this.monsters = new NamespaceRegistry(this.game.registeredNamespaces);
        this.tiles = new NamespaceRegistry(this.game.registeredNamespaces);
        this.slayerTaskTypes = new NamespaceRegistry(this.game.registeredNamespaces);
        this.rewardTypes = new NamespaceRegistry(this.game.registeredNamespaces);
        this.achievementCategories = new NamespaceRegistry(this.game.registeredNamespaces);
        this.achievements = new NamespaceRegistry(this.game.registeredNamespaces);
        
        // Mastery milestones (tag-based kill bonuses)
        this.masteryMilestones = [];
        this.unlockedMilestones = {}; // { tagName: Set of milestone IDs }

        // Achievement system state
        this.achievementStats = null;
        this.completedAchievements = new Set();
        this.achievementBonuses = {};
        this.unlockedAchievementAbilities = new Set();
        this.achievementManager = new AchievementManager(this, game);

        this.itemSlots = new NamespaceRegistry(this.game.registeredNamespaces);
        this.itemTypes = new NamespaceRegistry(this.game.registeredNamespaces);

        this.materials = new NamespaceRegistry(this.game.registeredNamespaces);
        this.materialCategories = new NamespaceRegistry(this.game.registeredNamespaces);
        this.baseItems = new NamespaceRegistry(this.game.registeredNamespaces);
        this.consumableTypes = new NamespaceRegistry(this.game.registeredNamespaces);
        this.consumableCategories = new NamespaceRegistry(this.game.registeredNamespaces);
        this.categories = new NamespaceRegistry(this.game.registeredNamespaces);
        this.equipmentSets = new NamespaceRegistry(this.game.registeredNamespaces);
        this.masteryCategories = new NamespaceRegistry(this.game.registeredNamespaces);

        // Tutorial system
        this.tutorials = new NamespaceRegistry(this.game.registeredNamespaces);

        this.component = createElement('adventuring-page');

        this.overview = new AdventuringOverview(this, this.game);
        this.overview.component.mount(this.component.overview);

        this.log = new AdventuringMessageLog(this, this.game);
        this.log.component.mount(this.overview.component.log);

        this.party = new AdventuringHeroParty(this, this.game);
        this.party.component.mount(this.component.party);

        this.pages = new AdventuringPages(this, this.game);

        this.town = new AdventuringTown(this, this.game);

        this.trainer = new AdventuringTrainer(this, this.game);
        this.jobdetails = new AdventuringJobDetails(this, this.game);

        this.armory = new AdventuringArmory(this, this.game);
        this.tavern = new AdventuringTavern(this, this.game);
        this.slayers = new AdventuringSlayers(this, this.game);
        this.lemons = new AdventuringLemons(this, this.game);
        this.consumables = new AdventuringConsumables(this, this.game);

        this.stash = new AdventuringStash(this, this.game);
        this.bestiary = new AdventuringBestiary(this, this.game);
        this.crossroads = new AdventuringCrossroads(this, this.game);
        this.dungeon = new AdventuringDungeon(this, this.game);
        this.encounter = new AdventuringEncounter(this, this.game);

        // Tutorial manager (after all pages created)
        this.tutorialManager = new AdventuringTutorialManager(this, this.game);

        // Centralized modifier system
        this.modifiers = new AdventuringModifiers(this, this.game);


        this.pages.register('town', this.town);

        this.pages.register('trainer', this.trainer);
        this.pages.register('jobdetails', this.jobdetails);

        this.pages.register('armory', this.armory);
        this.pages.register('tavern', this.tavern);
        this.pages.register('slayers', this.slayers);
        this.pages.register('lemons', this.lemons);
        this.pages.register('consumables', this.consumables);

        this.pages.register('stash', this.stash);
        this.pages.register('bestiary', this.bestiary);
        this.pages.register('crossroads', this.crossroads);
        this.pages.register('dungeon', this.dungeon);
        this.pages.register('encounter', this.encounter);

        this.townTimer = new Timer('Town', () => this.nextTownTick());
        this.townInterval = 5000;

        // Auto-repeat target area (only one at a time)
        this.autoRepeatArea = null;
    }

    /**
     * Set which area is the auto-repeat target
     * Only one area can be auto-repeat at a time
     */
    setAutoRepeatArea(area) {
        const previousArea = this.autoRepeatArea;
        this.autoRepeatArea = area;
        
        // Queue re-render for all areas that have auto-repeat unlocked
        this.areas.allObjects.forEach(a => {
            if(a.autoRepeatUnlocked) {
                a.renderQueue.autoRepeat = true;
            }
        });
        
        if(area) {
            this.log.add(`Auto-run set to ${area.name}`);
        } else if(previousArea) {
            this.log.add(`Auto-run disabled`);
        }
    }

    reset() {
        // Reset party members to initial state
        this.party.all.forEach(member => {
            member.hitpoints = member.maxHitpoints;
            member.energy = 0;
            member.dead = false;
            member.auras.clear();
        });

        // Reset stash
        this.stash.reset();

        // Reset bestiary
        this.bestiary.reset();

        // Reset dungeon state
        this.dungeon.reset();

        // Reset encounter state
        this.encounter.reset();

        // Stop all timers
        if (this.townTimer.isActive)
            this.townTimer.stop();
        if (this.dungeon.exploreTimer.isActive)
            this.dungeon.exploreTimer.stop();
        if (this.encounter.turnTimer.isActive)
            this.encounter.turnTimer.stop();
        if (this.encounter.hitTimer.isActive)
            this.encounter.hitTimer.stop();

        // Reset active state
        this.isActive = false;
    }
    

    onLoad() {
        super.onLoad();

        this.buildings.forEach(building => building.onLoad());
        this.townActions.forEach(townAction => townAction.onLoad());
        this.products.forEach(product => product.onLoad());
        this.jobs.forEach(job => job.onLoad());
        this.auras.forEach(aura => aura.onLoad());
        this.areas.forEach(area => area.onLoad());
        this.baseItems.forEach(baseItem => baseItem.onLoad());
        this.monsters.forEach(monster => monster.onLoad());
        this.materials.forEach(material => material.onLoad());
        this.consumableTypes.forEach(consumable => consumable.onLoad());

        this.pages.onLoad();

        this.overview.onLoad();
        this.party.onLoad();

        this.town.checkActions();
        
        if(this.isActive) {
            this.dungeon.go();
        } else {
            this.town.go();
        }
    }

    onLevelUp(oldLevel, newLevel) {
        super.onLevelUp(oldLevel, newLevel);
        this.party.all.forEach(member => {
            member.calculateStats();
            member.renderQueue.jobs = true;
        });

        // Check tutorial triggers for skill level
        this.tutorialManager.checkTriggers('skillLevel', { level: newLevel });

        this.jobs.forEach(job => {
            job.renderQueue.name = true;
            job.renderQueue.tooltip = true;
            job.renderQueue.icon = true;
            job.renderQueue.clickable = true;
            job.renderQueue.mastery = true;
        });

        this.areas.forEach(area => {
            area.renderQueue.name = true;
            area.renderQueue.tooltip = true;
            area.renderQueue.icon = true;
            area.renderQueue.clickable = true;
            area.renderQueue.mastery = true;
        });

        this.baseItems.forEach(baseItem => {
            baseItem.renderQueue.tooltip = true;
            baseItem.renderQueue.upgrade = true;
            baseItem.renderQueue.icon = true;
            baseItem.renderQueue.upgrade = true;
        });

        this.monsters.forEach(monster => {
            monster.renderQueue.name = true;
            monster.renderQueue.tooltip = true;
            monster.renderQueue.icon = true;
            monster.renderQueue.clickable = true;
            monster.renderQueue.mastery = true;
        });
    }

    onMasteryLevelUp(action, oldLevel, newLevel) {
        super.onMasteryLevelUp(action, oldLevel, newLevel);
        
        // Invalidate the mastery effects cache for this action
        if (action.invalidateMasteryCache) {
            action.invalidateMasteryCache();
        }
        
        this.party.all.forEach(member => {
            member.calculateStats();
            member.renderQueue.jobs = true;
        });

        this.jobs.forEach(job => {
            job.renderQueue.name = true;
            job.renderQueue.tooltip = true;
            job.renderQueue.icon = true;
            job.renderQueue.clickable = true;
            job.renderQueue.mastery = true;
        });

        this.areas.forEach(area => {
            area.renderQueue.name = true;
            area.renderQueue.tooltip = true;
            area.renderQueue.icon = true;
            area.renderQueue.clickable = true;
            area.renderQueue.mastery = true;
        });

        this.baseItems.forEach(baseItem => {
            baseItem.renderQueue.tooltip = true;
            baseItem.renderQueue.upgrade = true;
            baseItem.renderQueue.icon = true;
            baseItem.renderQueue.upgrade = true;
        });

        this.monsters.forEach(monster => {
            monster.renderQueue.name = true;
            monster.renderQueue.tooltip = true;
            monster.renderQueue.icon = true;
            monster.renderQueue.clickable = true;
            monster.renderQueue.mastery = true;
        });
    }

    selectArea(area) {
        if(this.party.all.some(member => !member.dead)) {
            this.dungeon.setArea(area);
            this.dungeon.start();
            this.dungeon.go();
        }
    }

    selectBuilding(building) {
        if(building.page !== undefined) {
            this.town.setBuilding(building);
        }
    }

    get name() { return "Adventuring"; }
    get isCombat() { return true; }
    get hasMinibar() { return true; }
    get hasMastery() { return false; }

    get activeSkills() {
        if (!this.isActive)
            return [];
        else
            return [this];
    }

    get canStop() {
        return this.isActive && !this.game.isGolbinRaid;
    }

    get canStart() {
        return !this.game.idleChecker(this);
    }

    isMasteryActionUnlocked(action) {
        return action.unlocked;
    }

    getActionModifierQueryParams(action) {
        const scope = super.getActionModifierQueryParams(action);
        if (action && action.category !== undefined) {
            scope.category = action.category;
        }
        if (action && action.action !== undefined) {
            scope.action = action;
        }
        return scope;
    }

    /**
     * Get a modifier query with no action scope - for skill-wide modifiers
     * Uses cached modQuery created in Skill constructor
     */
    getModifierQuery() {
        return this.modQuery;
    }

    getRegistry(type) {
        switch (type) {
            case ScopeSourceType.Category:
                return this.categories;
            case ScopeSourceType.Action:
                return this.actions;
        }
    }

    /**
     * Get the next mastery level unlock for a specific category
     * @param {number} level - Current mastery level
     * @param {string} categoryId - SkillCategory ID (e.g., 'adventuring:Areas')
     * @returns {object|undefined} Next milestone for this category, or undefined if maxed
     */
    getNextMasteryUnlock(level, categoryId) {
        // Map SkillCategory IDs to MasteryCategory IDs (Areas -> areas, Jobs -> jobs, etc.)
        const masteryId = categoryId.replace(/([A-Z])/g, (match) => match.toLowerCase());
        const masteryCategory = this.masteryCategories.getObjectByID(masteryId);
        return masteryCategory ? masteryCategory.getNextMilestone(level) : undefined;
    }

    computeTotalMasteryActions() {
        this.actions.namespaceMaps.forEach((actionMap,namespace)=>{
            this.totalMasteryActions.set(namespace, actionMap.size);
        }
        );
        this.actions.forEach((action)=>{
            this.totalMasteryActionsInRealm.inc(action.realm);
        }
        );
    }
    
    getTotalUnlockedMasteryActions() {
        return this.actions.reduce(levelUnlockSum(this), 0);
    }

    start() {
        if (!this.canStart)
            return false;
        
        this.isActive = true;
        this.game.renderQueue.activeSkills = true;
        this.game.activeAction = this;

        if(!this.dungeon.exploreTimer.isActive)
            this.dungeon.exploreTimer.start(this.dungeon.exploreInterval);
        
        if(this.townTimer.isActive)
            this.townTimer.stop();
        
        this.overview.renderQueue.turnProgressBar = true;

        // Notify tutorial system of state change
        this.tutorialManager.onStateChange();

        saveData();
        return true;
    }

    stop() {
        if(!this.canStop)
            return false;
        
        if(this.dungeon.exploreTimer.isActive)
            this.dungeon.exploreTimer.stop();
        
        if(this.encounter.turnTimer.isActive)
            this.encounter.turnTimer.stop();
    
        if(this.encounter.hitTimer.isActive)
            this.encounter.hitTimer.stop();

        if(this.isActive && this.dungeon.area !== undefined)
            this.dungeon.abandon();

        this.isActive = false;
        this.game.renderQueue.activeSkills = true;
        this.game.clearActiveAction(false);

        if(!this.townTimer.isActive)
            this.townTimer.start(this.townInterval);
        
        this.town.resetActions();
        
        this.overview.renderQueue.turnProgressBar = true;

        // Notify tutorial system of state change
        this.tutorialManager.onStateChange();

        saveData();
        return true;
    }

    getErrorLog() {
        let log = `Is Active: ${this.isActive}\n`;
        log += `Current Page: ${this.pages.current?.constructor?.name || 'none'}\n`;
        log += this.party.getErrorLog();
        log += this.dungeon.getErrorLog();
        log += this.encounter.getErrorLog();
        return log;
    }

    activeTick() {
        if(this.encounter.isFighting) {
            this.encounter.currentTimer.tick();
        } else {
            if(!this.dungeon.exploreTimer.isActive)
                this.dungeon.exploreTimer.start(this.dungeon.exploreInterval);
            this.dungeon.exploreTimer.tick();
        }
    }

    passiveTick() {
        if(this.isActive)
            return;
        
        if(this.dungeon.exploreTimer.isActive)
            this.dungeon.exploreTimer.stop();
        
        if(this.encounter.turnTimer.isActive)
            this.encounter.turnTimer.stop();
    
        if(this.encounter.hitTimer.isActive)
            this.encounter.hitTimer.stop();
        
        this.party.all.forEach(member => {
            if(member.energy > 0)
                member.setEnergy(0);
        });

        if(!this.townTimer.isActive) {
            this.townTimer.start(this.townInterval);

            this.town.resetActions();
        
            this.overview.renderQueue.turnProgressBar = true;
        }
        
        if(this.townTimer.isActive)
            this.townTimer.tick();
    }

    getMasteryXP(action) {
        //if(!action.unlocked)
        //    return -Infinity;
        return super.getMasteryXP(action);
    }

    addMasteryXP(action, xp) {
        const oldLevel = this.getMasteryLevel(action);
        super.addMasteryXP(action, xp);
        const newLevel = this.getMasteryLevel(action);

        // Check tutorial triggers on mastery level up
        if(newLevel > oldLevel) {
            let category = 'other';
            if(action instanceof this.jobs.registeredObjects.values().next().value?.constructor) {
                category = 'job';
            } else if(this.areas.allObjects.includes(action)) {
                category = 'area';
            } else if(this.baseItems.allObjects.includes(action)) {
                category = 'equipment';
            }
            this.tutorialManager.checkTriggers('mastery', { category, level: newLevel });
        }
    }

    onPageChange() {
        this.overview.renderQueue.turnProgressBar = true;
        this.pages.onPageChange();
    }

    onShow() {
        // Called when the adventuring page becomes visible
        this.tutorialManager.onPageVisible();
    }

    nextTownTick() {
        if(this.isActive)
            return;
            
        this.town.performActions();

        this.townTimer.start(this.townInterval);
        this.overview.renderQueue.turnProgressBar = true;
    }

    render() {
        super.render();
        this.overview.render();
        this.log.render();
        this.party.render();
        this.pages.render();
    }

    registerData(namespace, data) {
        super.registerData(namespace, data); // pets, rareDrops, minibar, customMilestones

        // Register mastery milestones (tag-based kill bonuses)
        if(data.masteryMilestones !== undefined) {
            data.masteryMilestones.forEach(milestone => {
                this.masteryMilestones.push({
                    id: milestone.id,
                    level: milestone.level,
                    name: milestone.name,
                    description: milestone.description,
                    rewards: milestone.rewards || []
                });
            });
            // Sort by level for easy checking
            this.masteryMilestones.sort((a, b) => a.level - b.level);
        }

        if(data.categories !== undefined) {
            data.categories.forEach(data => {
                this.categories.registerObject(new SkillCategory(namespace, data, this, this.game));
            });
        }

        if(data.materialCategories !== undefined) {
            data.materialCategories.forEach(data => {
                let category = new AdventuringMaterialCategory(namespace, data, this, this.game);
                this.materialCategories.registerObject(category);
            });
        }

        if(data.consumableCategories !== undefined) {
            data.consumableCategories.forEach(data => {
                let category = new AdventuringConsumableCategory(namespace, data, this, this.game);
                this.consumableCategories.registerObject(category);
            });
        }

        if(data.masteryCategories !== undefined) {
            data.masteryCategories.forEach(data => {
                let category = new AdventuringMasteryCategory(namespace, data, this, this.game);
                this.masteryCategories.registerObject(category);
            });
        }

        if(data.overview !== undefined)
            this.overview.registerData(data.overview);

        if(data.stats !== undefined) {
            data.stats.forEach(data => {
                let stat = new AdventuringStat(namespace, data, this, this.game);
                this.stats.registerObject(stat);
            });
        }

        if(data.buildings !== undefined) {
            data.buildings.forEach(data => {
                let building = new AdventuringBuilding(namespace, data, this, this.game);
                this.buildings.registerObject(building);
            });
        }

        if(data.townActions !== undefined) {
            data.townActions.forEach(data => {
                let townAction = new AdventuringTownAction(namespace, data, this, this.game);
                this.townActions.registerObject(townAction);
            });
        }

        if(data.products !== undefined) {
            data.products.forEach(data => {
                let product = new AdventuringProduct(namespace, data, this, this.game);
                this.products.registerObject(product);
            });
        }

        if(data.jobs !== undefined) {
            data.jobs.forEach(data => {
                let job = new AdventuringJob(namespace, data, this, this.game);
                this.jobs.registerObject(job);
                if(job.id !== "adventuring:none")
                    this.actions.registerObject(job);
            });
        }

        if(data.generators !== undefined) {
            data.generators.forEach(data => {
                let generator = new AdventuringGenerator(namespace, data, this, this.game);
                this.generators.registerObject(generator);
            });
        }

        if(data.spenders !== undefined) {
            data.spenders.forEach(data => {
                let spender = new AdventuringSpender(namespace, data, this, this.game);
                this.spenders.registerObject(spender);
            });
        }

        if(data.passives !== undefined) {
            data.passives.forEach(data => {
                let passive = new AdventuringPassive(namespace, data, this, this.game);
                this.passives.registerObject(passive);
            });
        }

        if(data.buffs !== undefined) {
            data.buffs.forEach(data => {
                let buff = new AdventuringBuff(namespace, data, this, this.game);
                this.buffs.registerObject(buff);
                this.auras.registerObject(buff);
            });
        }

        if(data.debuffs !== undefined) {
            data.debuffs.forEach(data => {
                let debuff = new AdventuringDebuff(namespace, data, this, this.game);
                this.debuffs.registerObject(debuff);
                this.auras.registerObject(debuff);
            });
        }

        if(data.difficulties !== undefined) {
            data.difficulties.forEach(data => {
                let difficulty = new AdventuringDifficulty(namespace, data, this, this.game);
                this.difficulties.registerObject(difficulty);
            });
        }

        if(data.areas !== undefined) {
            data.areas.forEach(data => {
                let area = new AdventuringArea(namespace, data, this, this.game);
                this.areas.registerObject(area);
                this.actions.registerObject(area);
                
                // Register dungeon mastery aura if defined
                if(data.masteryAura) {
                    let aura = new AdventuringBuff(namespace, data.masteryAura, this, this.game);
                    this.dungeonAuras.registerObject(aura);
                    this.auras.registerObject(aura);
                }
            });
        }
        
        if(data.monsters !== undefined) {
            data.monsters.forEach(data => {
                let monster = new AdventuringMonster(namespace, data, this, this.game);
                this.monsters.registerObject(monster);
                this.actions.registerObject(monster);
            });
        }
        
        if(data.tiles !== undefined) {
            data.tiles.forEach(data => {
                let tile = new AdventuringDungeonTile(namespace, data, this, this.game);
                this.tiles.registerObject(tile);
            });
        }

        if(data.slayerTaskTypes !== undefined) {
            data.slayerTaskTypes.forEach(data => {
                let taskType = new AdventuringSlayerTaskType(namespace, data, this, this.game);
                this.slayerTaskTypes.registerObject(taskType);
            });
        }

        if(data.rewardTypes !== undefined) {
            data.rewardTypes.forEach(data => {
                let rewardType = new AdventuringRewardType(namespace, data, this, this.game);
                this.rewardTypes.registerObject(rewardType);
            });
        }

        if(data.itemSlots !== undefined) {
            data.itemSlots.forEach(data => {
                let slot = new AdventuringItemSlot(namespace, data, this, this.game);
                this.itemSlots.registerObject(slot);
            });
        }

        if(data.itemTypes !== undefined) {
            data.itemTypes.forEach(data => {
                let itemType = new AdventuringItemType(namespace, data, this, this.game);
                this.itemTypes.registerObject(itemType);
            });
        }

        if(data.materials !== undefined) {
            data.materials.forEach(data => {
                let material = new AdventuringMaterial(namespace, data, this, this.game);
                this.materials.registerObject(material);
            });
        }

        if(data.baseItems !== undefined) {
            data.baseItems.forEach(data => {
                let item = new AdventuringItemBase(namespace, data, this, this.game);
                this.baseItems.registerObject(item);
                if(item.id !== "adventuring:none")
                    this.actions.registerObject(item);
            });
        }

        if(data.consumables !== undefined) {
            data.consumables.forEach(data => {
                let consumable = new AdventuringConsumable(namespace, data, this, this.game);
                this.consumableTypes.registerObject(consumable);
            });
        }

        if(data.equipmentSets !== undefined) {
            data.equipmentSets.forEach(data => {
                let set = new AdventuringEquipmentSet(namespace, data, this, this.game);
                this.equipmentSets.registerObject(set);
            });
        }

        if(data.tutorials !== undefined) {
            data.tutorials.forEach(data => {
                let tutorial = new AdventuringTutorial(namespace, data, this);
                this.tutorials.registerObject(tutorial);
            });
        }

        if(data.achievementCategories !== undefined) {
            data.achievementCategories.forEach(data => {
                let category = new AdventuringAchievementCategory(namespace, data, this, this.game);
                this.achievementCategories.registerObject(category);
            });
        }

        if(data.achievements !== undefined) {
            data.achievements.forEach(data => {
                let achievement = new AdventuringAchievement(namespace, data, this, this.game);
                this.achievements.registerObject(achievement);
            });
        }
    }

    postDataRegistration() {
        super.postDataRegistration(); // Milestones setLevel

        this.buildings.forEach(building => building.postDataRegistration());
        this.townActions.forEach(townAction => townAction.postDataRegistration());
        this.products.forEach(product => product.postDataRegistration());
        this.jobs.forEach(job => job.postDataRegistration());
        this.difficulties.forEach(difficulty => difficulty.postDataRegistration());
        this.areas.forEach(area => area.postDataRegistration());
        this.generators.forEach(generator => generator.postDataRegistration());
        this.spenders.forEach(spender => spender.postDataRegistration());
        this.passives.forEach(passive => passive.postDataRegistration());
        this.auras.forEach(aura => aura.postDataRegistration());
        this.materials.forEach(material => material.postDataRegistration());
        this.baseItems.forEach(baseItem => baseItem.postDataRegistration());
        this.consumableTypes.forEach(consumable => consumable.postDataRegistration());
        this.equipmentSets.forEach(set => set.postDataRegistration());

        let jobMilestones = this.jobs.allObjects.filter(job => job.isMilestoneReward);
        let areaMilestones = this.areas.allObjects.filter(area => area.isMilestoneReward);

        let milestones = [...jobMilestones, ...areaMilestones].map(milestone => {
            if(milestone.requirements.length === 1 && milestone.requirements[0].type === "skill_level")
                return {
                    get name() { return milestone.name },
                    get media() { return milestone.media },
                    get level() { return milestone.requirements[0].level }
                };
            return undefined;
        }).filter(milestone => milestone !== undefined);

        this.milestones.push(...milestones);
        this.sortMilestones();
        
        this.sortedMasteryActions = [];

        this.overview.postDataRegistration();

        this.party.postDataRegistration();

        this.pages.postDataRegistration();

        this.tutorialManager.postDataRegistration();

        // Initialize achievement system
        this.achievementManager.init();

        let capesToExclude = ["melvorF:Max_Skillcape", "melvorTotH:Superior_Max_Skillcape"];
        let skillCapes = this.game.shop.purchases.filter(purchase => capesToExclude.includes(purchase.id));
        skillCapes.forEach(cape => {
            let allSkillLevelsRequirement = cape.purchaseRequirements.find(req => req.type === "AllSkillLevels");
            if(allSkillLevelsRequirement !== undefined) {
                if(allSkillLevelsRequirement.exceptions === undefined)
                    allSkillLevelsRequirement.exceptions = new Set();
                allSkillLevelsRequirement.exceptions.add(this);
            }
        });
    }

    /**
     * Get an ability by ID from either generators or spenders registry
     * @param {string} id - The ability ID
     * @returns {AdventuringAbility|undefined}
     */
    getAbilityByID(id) {
        return this.generators.getObjectByID(id) ?? this.spenders.getObjectByID(id);
    }

    encode(writer) {
        let start = writer.byteOffset;
        super.encode(writer); // Encode default skill data
        writer.writeUint32(this.version); // Store current skill version

        this.party.encode(writer);
        this.pages.encode(writer);
        writer.writeBoolean(this.isActive);

        // Encode learned abilities (Blue Mage)
        writer.writeUint32(this.learnedAbilities.size);
        this.learnedAbilities.forEach(abilityId => {
            const ability = this.getAbilityByID(abilityId);
            writer.writeNamespacedObject(ability);
        });

        // Encode slayer tasks (version 6+)
        this.slayers.encode(writer);

        // Encode tavern drinks (version 7+)
        this.tavern.encode(writer);

        // Encode lemon stats (version 7+)
        this.lemons.encode(writer);

        // Encode consumables (version 9+)
        this.consumables.encode(writer);

        // Encode seen abilities (version 11+)
        // Filter out any undefined abilities before writing
        const validSeenAbilities = [...this.seenAbilities]
            .map(id => this.getAbilityByID(id))
            .filter(ability => ability !== undefined);
        writer.writeUint32(validSeenAbilities.length);
        validSeenAbilities.forEach(ability => {
            writer.writeNamespacedObject(ability);
        });

        // Encode tutorial state (version 12+)
        this.tutorialManager.encode(writer);

        // Encode achievement state (version 13+)
        this.achievementManager.encode(writer);

        let end = writer.byteOffset;
        //console.log(`Wrote ${end-start} bytes for Adventuring save`);
        return writer;
    }

    decode(reader, version) {
        //console.log("Adventuring save decoding");
        let start = reader.byteOffset;
        reader.byteOffset -= Uint32Array.BYTES_PER_ELEMENT; // Let's back up a minute and get the size of our skill data
        let skillDataSize = reader.getUint32();

        try {
            super.decode(reader, version);
            this.saveVersion = reader.getUint32(); // Read save version
            if(this.saveVersion < this.version)
                throw new Error("Old Save Version");

            this.party.decode(reader, version);
            this.pages.decode(reader, version);
            this.isActive = reader.getBoolean();

            // Decode learned abilities (Blue Mage)
            const numLearned = reader.getUint32();
            for(let i = 0; i < numLearned; i++) {
                // Try generators first, then spenders
                let ability = reader.getNamespacedObject(this.generators);
                if(typeof ability === 'string') {
                    // Not found in generators, try spenders
                    ability = this.spenders.getObjectByID(ability);
                }
                if(ability !== undefined && typeof ability !== 'string') {
                    this.learnedAbilities.add(ability.id);
                }
            }

            // Decode slayer tasks
            this.slayers.decode(reader, version);

            // Decode tavern and lemons
            this.tavern.decode(reader, version);
            this.lemons.decode(reader, version);

            // Decode consumables (includes tavern drinks as charges)
            this.consumables.decode(reader, version);

            // Decode seen abilities
            const numSeen = reader.getUint32();
            for(let i = 0; i < numSeen; i++) {
                // Try generators first, then spenders
                let ability = reader.getNamespacedObject(this.generators);
                if(typeof ability === 'string') {
                    // Not found in generators, try spenders
                    ability = this.spenders.getObjectByID(ability);
                }
                if(ability !== undefined && typeof ability !== 'string') {
                    this.seenAbilities.add(ability.id);
                }
            }

            // Decode tutorial state (version 12+)
            this.tutorialManager.decode(reader, version);

            // Decode achievement state (version 13+)
            this.achievementManager.decode(reader, version);
        } catch(e) { // Something's fucky, dump all progress and skip past the trash save data
            console.log(e);
            reader.byteOffset = start;
            reader.getFixedLengthBuffer(skillDataSize);
        }

        let end = reader.byteOffset;
        //console.log(`Read ${end-start} bytes for Adventuring save`);
    }

    checkpoints = [
        { description: "+5% Adventuring Mastery XP" },
        { description: "+50% Consumable Preservation Chance" },
        { description: "+10% Material Drop Rate" },
        { description: "+10 Starting Energy" }
    ]

    openMasteryPoolBonusModal() {
        const html = masteryCheckpoints.map((percentRequired,i)=>{
            const isActive = this.isPoolTierActive(i);
            const checkpointXP = Math.floor((this.baseMasteryPoolCap * percentRequired) / 100);
            let checkPointStatus = '';
            if (isActive) {
                checkPointStatus = templateLangString('MENU_TEXT_CHECKPOINT_ACTIVE', {
                    xp: numberWithCommas(checkpointXP),
                });
            } else {
                checkPointStatus = templateLangString('MENU_TEXT_XP_REMAINING', {
                    xpLeft: numberWithCommas(Math.ceil(checkpointXP - this.masteryPoolXP)),
                    xp: numberWithCommas(checkpointXP),
                });
            }
            const bonusDescription = this.checkpoints[i].description;
            return `<div class="col-12">
      <div class="block block-rounded-double bg-combat-inner-dark p-3">
        <div class="media d-flex align-items-center push">
          <div class="mr-3">
            <h2 class="font-w700 ${isActive ? 'text-success' : 'text-danger'} mb-0" id="mastery-modal-checkpoint-percent-0">
              ${formatPercent(percentRequired)}
            </h2>
          </div>
          <div class="media-body">
            <div class="font-w600 font-size-sm" id="mastery-modal-checkpoint-description-0">
              ${bonusDescription}
            </div>
            <div class="font-size-sm" id="mastery-modal-checkpoint-xp-required-0">
              <small>${checkPointStatus}</small>
            </div>
          </div>
        </div>
      </div>
    </div>`;
        }
        ).join('');
        $('#modal-content-checkpoints').html(html);
        $('#modal-mastery-checkpoints').modal('show');
    }
}

