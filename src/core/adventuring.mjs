const { loadModule } = mod.getContext(import.meta);

const { AdventuringStat } = await loadModule('src/core/stats/adventuring-stat.mjs');
const { AdventuringBuilding } = await loadModule('src/town/adventuring-building.mjs');
const { AdventuringTownAction } = await loadModule('src/town/adventuring-town-action.mjs');
const { AdventuringProduct } = await loadModule('src/ui/adventuring-product.mjs');
const { AdventuringJob } = await loadModule('src/progression/adventuring-job.mjs');
const { AdventuringGenerator } = await loadModule('src/dungeon/adventuring-generator.mjs');
const { AdventuringSpender } = await loadModule('src/town/adventuring-spender.mjs');
const { AdventuringPassive } = await loadModule('src/progression/adventuring-passive.mjs');
const { AdventuringBuff } = await loadModule('src/combat/adventuring-buff.mjs');
const { AdventuringDebuff } = await loadModule('src/combat/adventuring-debuff.mjs');
const { AdventuringArea } = await loadModule('src/dungeon/adventuring-area.mjs');
const { AdventuringDifficulty } = await loadModule('src/dungeon/adventuring-difficulty.mjs');
const { AdventuringMonster } = await loadModule('src/entities/adventuring-monster.mjs');
const { AdventuringDungeonTile } = await loadModule('src/dungeon/adventuring-dungeon-tile.mjs');
const { AdventuringSlayerTaskType, AdventuringRewardType } = await loadModule('src/progression/slayer/adventuring-slayer-task.mjs');
const { AdventuringAchievementCategory, AdventuringAchievement, AdventuringMilestone, AchievementManager } = await loadModule('src/progression/adventuring-achievements.mjs');
const { AdventuringAchievementStat } = await loadModule('src/progression/adventuring-achievement-stat.mjs');

const { AdventuringOverview } = await loadModule('src/ui/adventuring-overview.mjs');
const { AdventuringMessageLog } = await loadModule('src/ui/adventuring-message-log.mjs');

const { AdventuringPages } = await loadModule('src/ui/adventuring-pages.mjs');
const { AdventuringHeroParty, AdventuringEnemyParty } = await loadModule('src/entities/adventuring-party.mjs');

const { AdventuringTown } = await loadModule('src/town/adventuring-town.mjs');

const { AdventuringTrainer } = await loadModule('src/town/adventuring-trainer.mjs');
const { AdventuringJobDetails } = await loadModule('src/ui/adventuring-job-details.mjs');

const { AdventuringArmory } = await loadModule('src/items/adventuring-armory.mjs');
const { AdventuringTavern } = await loadModule('src/town/adventuring-tavern.mjs');
const { AdventuringTavernDrink } = await loadModule('src/town/adventuring-tavern-drink.mjs');
const { AdventuringSlayers } = await loadModule('src/progression/slayer/adventuring-slayers.mjs');
const { AdventuringLemons } = await loadModule('src/town/adventuring-lemons.mjs');
const { AdventuringConsumables } = await loadModule('src/items/adventuring-consumables.mjs');
const { AdventuringConsumable } = await loadModule('src/items/adventuring-consumable.mjs');

const { AdventuringStash } = await loadModule('src/town/adventuring-stash.mjs');
const { AdventuringBestiary } = await loadModule('src/entities/adventuring-bestiary.mjs');
const { AdventuringMonsterDetails } = await loadModule('src/ui/adventuring-monster-details.mjs');
const { AdventuringCrossroads } = await loadModule('src/dungeon/adventuring-crossroads.mjs');
const { AdventuringAreaDetails } = await loadModule('src/ui/adventuring-area-details.mjs');
const { AdventuringDungeon } = await loadModule('src/dungeon/adventuring-dungeon.mjs');
const { AdventuringEncounter } = await loadModule('src/combat/adventuring-encounter.mjs');
const { CombatTracker } = await loadModule('src/combat/adventuring-combat-tracker.mjs');
const { AdventuringConductor } = await loadModule('src/core/adventuring-conductor.mjs');

const { AdventuringItemSlot } = await loadModule('src/items/adventuring-item-slot.mjs');
const { AdventuringItemType } = await loadModule('src/items/adventuring-item-type.mjs');
const { AdventuringItemCategory } = await loadModule('src/items/adventuring-item-category.mjs');
const { AdventuringItemBase } = await loadModule('src/items/adventuring-item-base.mjs');
const { AdventuringMaterial } = await loadModule('src/items/adventuring-material.mjs');
const { AdventuringMaterialCategory } = await loadModule('src/items/adventuring-material-category.mjs');
const { AdventuringConsumableCategory } = await loadModule('src/items/adventuring-consumable-category.mjs');
const { AdventuringMasteryCategory } = await loadModule('src/progression/adventuring-mastery-category.mjs');

const { AdventuringTutorial } = await loadModule('src/ui/adventuring-tutorial.mjs');
const { AdventuringTutorialManager } = await loadModule('src/ui/adventuring-tutorial-manager.mjs');
const { AdventuringEquipmentSet } = await loadModule('src/items/adventuring-equipment-set.mjs');
const { AdventuringEquipmentPool } = await loadModule('src/items/adventuring-equipment-pool.mjs');
const { AdventuringLootTable } = await loadModule('src/items/adventuring-loot-table.mjs');
const { AdventuringGrimoire } = await loadModule('src/progression/slayer/adventuring-grimoire.mjs');
const { AdventuringTag } = await loadModule('src/core/adventuring-tag.mjs');
const { loadEffectDescriptions } = await loadModule('src/core/effects/effect-descriptions.mjs');

const { AdventuringPageElement } = await loadModule('src/core/components/adventuring.mjs');

class AdventuringRenderQueue extends MasterySkillRenderQueue {
    constructor() {
        super(...arguments);
    }
}

export class Adventuring extends SkillWithMastery {
    constructor(namespace, game) {
        super(namespace, 'Adventuring', game);
        this.version = 10; // CombatTracker
        this.saveVersion = -1;
        this._media = 'melvor:assets/media/main/adventure.svg';
        this.renderQueue = new AdventuringRenderQueue();
        this.isActive = false;
        this.timersPaused = false;

        // Configuration from data (defaults overridden by base.json)
        this.config = {
            timers: { turn: 1500, hit: 150, endTurn: 100, explore: 1500 },
            xpValues: { floorBase: 40, dungeonComplete: 250 },
            limits: { maxUpgrades: 10, maxEquippedConsumables: 3, maxEquippedDrinks: 3 }
        };

        this.learnedAbilities = new Set();

        this.seenAbilities = new Set();

        this.stats = new NamespaceRegistry(this.game.registeredNamespaces);
        this.buildings = new NamespaceRegistry(this.game.registeredNamespaces);
        this.townActions = new NamespaceRegistry(this.game.registeredNamespaces);
        this.products = new NamespaceRegistry(this.game.registeredNamespaces);
        this.jobs = new NamespaceRegistry(this.game.registeredNamespaces);
        this.generators = new NamespaceRegistry(this.game.registeredNamespaces);
        this.spenders = new NamespaceRegistry(this.game.registeredNamespaces);
        this.abilities = new NamespaceRegistry(this.game.registeredNamespaces); // Unified registry for encode/decode
        this.passives = new NamespaceRegistry(this.game.registeredNamespaces);
        this.auras = new NamespaceRegistry(this.game.registeredNamespaces);
        this.buffs = new NamespaceRegistry(this.game.registeredNamespaces);
        this.debuffs = new NamespaceRegistry(this.game.registeredNamespaces);
        this.areas = new NamespaceRegistry(this.game.registeredNamespaces);
        this.difficulties = new NamespaceRegistry(this.game.registeredNamespaces);
        this.dungeonAuras = new NamespaceRegistry(this.game.registeredNamespaces);
        this.monsters = new NamespaceRegistry(this.game.registeredNamespaces);
        this.tags = new NamespaceRegistry(this.game.registeredNamespaces);
        this.tiles = new NamespaceRegistry(this.game.registeredNamespaces);
        this.slayerTaskTypes = new NamespaceRegistry(this.game.registeredNamespaces);
        this.rewardTypes = new NamespaceRegistry(this.game.registeredNamespaces);
        this.achievementCategories = new NamespaceRegistry(this.game.registeredNamespaces);
        this.achievements = new NamespaceRegistry(this.game.registeredNamespaces);
        this.achievementMilestones = new NamespaceRegistry(this.game.registeredNamespaces);
        this.achievementStats = new NamespaceRegistry(this.game.registeredNamespaces);

        // Conductor must be created first so other systems can register listeners in constructors
        this.conductor = new AdventuringConductor(this);

        this.achievementManager = new AchievementManager(this, game);
        this.combatTracker = new CombatTracker(this);

        this.itemSlots = new NamespaceRegistry(this.game.registeredNamespaces);
        this.itemTypes = new NamespaceRegistry(this.game.registeredNamespaces);
        this.itemCategories = new NamespaceRegistry(this.game.registeredNamespaces);

        this.materials = new NamespaceRegistry(this.game.registeredNamespaces);
        this.materialCategories = new NamespaceRegistry(this.game.registeredNamespaces);
        this.baseItems = new NamespaceRegistry(this.game.registeredNamespaces);
        this.consumableTypes = new NamespaceRegistry(this.game.registeredNamespaces);
        this.consumableCategories = new NamespaceRegistry(this.game.registeredNamespaces);
        this.tavernDrinks = new NamespaceRegistry(this.game.registeredNamespaces);
        this.categories = new NamespaceRegistry(this.game.registeredNamespaces);
        this.equipmentSets = new NamespaceRegistry(this.game.registeredNamespaces);
        this.equipmentPools = new NamespaceRegistry(this.game.registeredNamespaces);
        this.lootTables = new NamespaceRegistry(this.game.registeredNamespaces);
        this.masteryCategories = new NamespaceRegistry(this.game.registeredNamespaces);

        this.tutorials = new NamespaceRegistry(this.game.registeredNamespaces);

        // Pending order data (processed in postDataRegistration)
        this._pendingAreaOrders = [];
        this._pendingJobOrders = [];
        this._pendingMaterialOrders = [];
        this._pendingItemOrders = [];
        this._pendingTavernOrders = [];
        this._pendingConsumableOrders = [];
        this._pendingMonsterOrders = [];
        this._pendingDifficultyOrders = [];
        this._pendingEquipmentSetOrders = [];

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
        this.monsterdetails = new AdventuringMonsterDetails(this, this.game);
        this.grimoire = new AdventuringGrimoire(this, this.game);
        this.crossroads = new AdventuringCrossroads(this, this.game);
        this.areadetails = new AdventuringAreaDetails(this, this.game);
        this.dungeon = new AdventuringDungeon(this, this.game);
        this.encounter = new AdventuringEncounter(this, this.game);

        this.tutorialManager = new AdventuringTutorialManager(this, this.game);

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
        this.pages.register('monsterdetails', this.monsterdetails);
        this.pages.register('crossroads', this.crossroads);
        this.pages.register('areadetails', this.areadetails);
        this.pages.register('dungeon', this.dungeon);
        this.pages.register('encounter', this.encounter);

        this.townTimer = new Timer('Town', () => this.nextTownTick());
        this.townInterval = 5000;


        this.autoRepeatArea = null;
    }

    /**
     * Check if debug speed mode is enabled (character named "Adventuring Enjoyer")
     * @returns {boolean}
     */
    get isDebugSpeed() {
        return this.game.characterName === 'Adventuring Enjoyer';
    }

    /**
     * Scale an interval for debug speed mode (divides by 100 if enabled)
     * @param {number} interval - The base interval in ms
     * @returns {number} The scaled interval (minimum 50ms for tick compatibility)
     */
    scaleInterval(interval) {
        if (this.isDebugSpeed) {
            return Math.max(50, Math.floor(interval / 2));
        }
        return Math.max(50, interval);
    }

    setAutoRepeatArea(area) {
        const previousArea = this.autoRepeatArea;
        this.autoRepeatArea = area;

        this.areas.allObjects.forEach(a => {
            if(a.autoRunUnlocked) {
                a.renderQueue.autoRepeat = true;
            }
        });

        if(area) {
            this.log.add(`Auto-run set to ${area.name}`, {
                category: 'dungeon_progress'
            });
        } else if(previousArea) {
            this.log.add(`Auto-run disabled`, {
                category: 'dungeon_progress'
            });
        }
    }

    reset() {

        this.party.forEach(member => {
            member.hitpoints = member.maxHitpoints;
            member.energy = 0;
            member.dead = false;
            member.auras.clear();
        });

        this.stash.reset();

        this.bestiary.reset();

        this.dungeon.reset();

        this.encounter.reset();

        if (this.townTimer.isActive)
            this.townTimer.stop();
        if (this.dungeon.exploreTimer.isActive)
            this.dungeon.exploreTimer.stop();
        if (this.encounter.turnTimer.isActive)
            this.encounter.turnTimer.stop();
        if (this.encounter.hitTimer.isActive)
            this.encounter.hitTimer.stop();

        this.isActive = false;
    }

    resetSkill() {

        this.reset();

        if (this.townTimer.isActive)
            this.townTimer.stop();

        this._xp = 0;
        this.masteryPoolXP = 0;
        // Reset both xp AND level for each mastery action
        this.actionMastery.forEach((data, action) => {
            data.xp = 0;
            data.level = 1;
        });

        this.learnedAbilities.clear();

        this.seenAbilities.clear();

        this.autoRepeatArea = null;

        this.armory.unlocked.clear();
        this.armory.viewed.clear();
        this.armory.upgradeLevels.forEach((level, item) => {
            this.armory.upgradeLevels.set(item, 0);
        });
        this.armory.masterfulItems.clear();
        this.armory.droppedItems.clear();
        // Reset artifact tiers on items before clearing
        this.armory.artifactTiers.forEach((tier, item) => {
            if (item.isArtifact && typeof item.applyArtifactTier === 'function') {
                item.applyArtifactTier(0);
            }
        });
        this.armory.artifactTiers.clear();
        this.armory.clearSelected();

        this.materials.allObjects.forEach(material => {
            material.renderQueue.updateAll();
        });

        this.tavern.resetDrinks();

        // Reset workshop buildings (stored items and work orders)
        this.buildings.allObjects.forEach(building => {
            if (building.type === 'workshop' && building.page) {
                building.page.storedItems.clear();
                building.page.workOrders.forEach(order => {
                    order.active = false;
                    order.product = null;
                    order.tier = 1;
                    order.count = 0;
                    order.completed = 0;
                });
            }
        });

        this.consumables.resetCharges();

        this.slayers.resetTasks();

        this.lemons.resetStats();

        this.achievementManager.resetAll();

        this.combatTracker.run.reset();
        this.combatTracker.encounter.reset();
        this.combatTracker.history = [];

        this.grimoire.resetAll();

        this.tutorialManager.resetState();

        // Reset crossroads progress
        this.crossroads.clearedAreas.clear();

        // Clear all cached unlock states (entities cache unlock checks for performance)
        this.jobs.allObjects.forEach(job => { job._unlockedCached = undefined; });
        this.areas.allObjects.forEach(area => { area._unlockedCached = undefined; });
        this.baseItems.allObjects.forEach(item => { item._unlockedCached = undefined; });
        this.generators.allObjects.forEach(gen => { gen._unlockedCached = undefined; });
        this.spenders.allObjects.forEach(spd => { spd._unlockedCached = undefined; });
        this.passives.allObjects.forEach(pas => { pas._unlockedCached = undefined; });
        this.buildings.allObjects.forEach(bld => { bld._unlockedCached = undefined; });

        this.areas.allObjects.forEach(area => {
            area.selectedDifficulty = null;
            area.bestEndlessStreak = 0;
        });

        this.areas.allObjects.forEach(area => {
            area.renderQueue.updateAll();
        });

        // Reset all heroes to "new player" state
        this.party.forEach(hero => {
            // Clear combat state
            hero.dead = false;
            hero.energy = 0;
            hero.auras.clear();

            // Clear equipment
            hero.equipment.slots.forEach(slot => {
                slot.setEmpty();
            });

            // Reset stats to base
            hero.stats.reset();
            this.stats.allObjects.forEach(stat => {
                if(stat.base !== undefined)
                    hero.stats.set(stat, stat.base);
            });

            // Reset jobs and abilities to defaults
            hero.setCombatJob(this.jobs.getObjectByID('adventuring:none'));
            hero.setPassiveJob(this.jobs.getObjectByID('adventuring:none'));
            hero.setGenerator(this.generators.getObjectByID('adventuring:slap'));
            hero.setSpender(this.spenders.getObjectByID('adventuring:backhand'));

            // Generate new name and apply starter loadout
            hero.name = hero.getRandomName(this.party.all.map(m => m.name));
            hero.renderQueue.name = true;
            hero._applyStarterLoadout();

            // Recalculate stats and set HP to max
            hero.calculateStats();
            hero.hitpoints = hero.maxHitpoints;
            hero.renderQueue.hitpoints = true;

            // Invalidate caches (don't re-initialize them)
            hero.effectCache.invalidate();
            if (hero.statBreakdownCache) {
                hero.statBreakdownCache.invalidate();
            }
        });

        // Invalidate party and encounter effect caches
        this.party.effectCache.invalidate();
        if (this.encounter.effectCache) {
            this.encounter.effectCache.invalidate();
        }

        this.jobs.allObjects.forEach(job => job.renderQueue.updateAll());
        this.areas.allObjects.forEach(area => area.renderQueue.updateAll());
        this.baseItems.allObjects.forEach(item => item.renderQueue.updateAll());
        this.monsters.allObjects.forEach(monster => monster.renderQueue.updateAll());
        this.materials.allObjects.forEach(material => material.renderQueue.updateAll());
        this.tavernDrinks.allObjects.forEach(drink => drink.renderQueue.updateAll());
        this.consumableTypes.allObjects.forEach(consumable => consumable.renderQueue.updateAll());
        this.party.forEach(hero => hero.renderQueue.updateAll());

        this.town.go();

        this.log.add('Skill has been reset to initial state.');
    }




    triggerEffects(trigger, context = {}) {
        // Party trigger handles dungeon effects (registered as source)
        if(this.party) {
            this.party.trigger(trigger, context);
        }

        // Individual hero triggers
        if(this.party) {
            this.party.forEach(member => {
                member.trigger(trigger, context);
            });
        }
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
        this.tavernDrinks.forEach(drink => drink.onLoad());

        this.pages.onLoad();

        this.overview.onLoad();
        this.party.onLoad();
        this.encounter.onLoad();
        this.achievementManager.onLoad();

        if(this._pendingReset) {
            this._pendingReset = false;
            try {
                this.resetSkill();
                this.log.add('Save data was corrupted. Skill has been reset.');
                SwalLocale.fire({
                    title: 'Adventuring Reset',
                    html: `<p>Your Adventuring save data was from an older version and could not be loaded.</p>
                           <p>The skill has been reset to ensure proper functionality.</p>
                           <p><strong>Please refresh the page</strong> to complete the reset process.</p>`,
                    icon: 'warning',
                    confirmButtonText: 'Refresh Now',
                    showCancelButton: true,
                    cancelButtonText: 'Later'
                }).then((result) => {
                    if(result.isConfirmed) {
                        location.reload();
                    }
                });
            } catch(e) {
                console.warn('Adventuring resetSkill failed after decode error:', e);
            }
        }

        this.town.checkActions();

        if(this.isActive) {
            this.dungeon.go();
        } else {
            this.town.go();
        }
    }

    onLevelUp(oldLevel, newLevel) {
        super.onLevelUp(oldLevel, newLevel);
        this.party.forEach(member => {
            member.invalidateStats();
            member.calculateStats();
            member.renderQueue.jobs = true;
        });

        this.achievementManager.markDirty();
        this.conductor.trigger('skill_level_up', { level: newLevel, oldLevel });

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
        });

        this.monsters.forEach(monster => {
            monster.renderQueue.name = true;
            monster.renderQueue.tooltip = true;
            monster.renderQueue.icon = true;
            monster.renderQueue.clickable = true;
            monster.renderQueue.mastery = true;
        });

        this.armory.checkUnlocked();
    }

    onMasteryLevelUp(action, oldLevel, newLevel) {
        super.onMasteryLevelUp(action, oldLevel, newLevel);

        // Fire job_level_up trigger for job mastery increases
        if (action instanceof AdventuringJob) {
            this.conductor.trigger('job_level_up', {
                job: action,
                jobId: action.id,
                jobName: action.name,
                oldLevel: oldLevel,
                newLevel: newLevel,
                isCombatJob: action.isCombatJob,
                isPassiveJob: action.isPassiveJob,
                tier: action.tier
            });
        }

        if (action.invalidateMasteryCache) {
            action.invalidateMasteryCache();
        }

        this.party.forEach(member => {
            member.invalidateStats();
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
        // Need at least one hero with a combat job to go adventuring
        if(this.party.combatParty.length === 0) {
            this.log.add('Cannot start - no heroes have combat jobs!');
            return;
        }
        if(this.party.combatParty.some(member => !member.dead)) {
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

    getNextMasteryUnlock(level, categoryId) {

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
            this.dungeon.exploreTimer.start(this.dungeon.getEffectiveExploreInterval());

        if(this.townTimer.isActive)
            this.townTimer.stop();

        this.overview.renderQueue.turnProgressBar = true;

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
            this.townTimer.start(this.scaleInterval(this.townInterval));

        this.town.resetActions();

        this.overview.renderQueue.turnProgressBar = true;

        this.tutorialManager.onStateChange();

        saveData();
        return true;
    }

    getErrorLog() {
        let log = `Is Active: ${this.isActive}\n`;
        const currentPage = this.pages.current;
        const pageName = currentPage !== undefined && currentPage.constructor !== undefined ? currentPage.constructor.name : 'none';
        log += `Current Page: ${pageName}\n`;
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
                this.dungeon.exploreTimer.start(this.dungeon.getEffectiveExploreInterval());
            this.dungeon.exploreTimer.tick();
        }

        this.achievementManager.checkIfDirty();
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

        this.party.forEach(member => {
            if(member.energy > 0)
                member.setEnergy(0);
        });

        if(!this.townTimer.isActive) {
            this.townTimer.start(this.scaleInterval(this.townInterval));

            this.town.resetActions();

            this.overview.renderQueue.turnProgressBar = true;
        }

        if(this.townTimer.isActive)
            this.townTimer.tick();
    }

    getMasteryXP(action) {
        return super.getMasteryXP(action);
    }

    getMasteryLevel(action) {
        // Mastery entities should be level 0 until discovered/unlocked
        if (action && action.unlocked === false) {
            return 0;
        }
        return super.getMasteryLevel(action);
    }

    addMasteryXP(action, xp) {
        const oldLevel = this.getMasteryLevel(action);
        super.addMasteryXP(action, xp);
        const newLevel = this.getMasteryLevel(action);

        if(newLevel > oldLevel) {
            let category = 'other';
            const firstJob = this.jobs.registeredObjects.values().next().value;
            if(firstJob !== undefined && action instanceof firstJob.constructor) {
                category = 'job';
                // Update mastery bonus cache and invalidate job effects for all heroes using this job
                action.updateCachedMasteryBonus();
                this.party.forEach(hero => {
                    if (hero.combatJob === action || hero.passiveJob === action) {
                        hero.invalidateJobEffects();
                    }
                });
            } else if(this.areas.allObjects.includes(action)) {
                category = 'area';
            } else if(this.baseItems.allObjects.includes(action)) {
                category = 'equipment';
            }
            this.conductor.trigger('mastery_level_up', { category, level: newLevel, action });

            if(newLevel >= 99 && this.party) {
                this.party.onMasteryMaxed();
            }
        }
    }

    onPageChange() {
        this.overview.renderQueue.turnProgressBar = true;
        this.pages.onPageChange();
    }

    /**
     * Syncs the current page to match the game state.
     * Called after offline progress to ensure UI reflects actual state.
     */
    syncPageState() {
        if (this.isActive) {
            // In a dungeon run
            if (this.encounter.isFighting) {
                this.encounter.go();
            } else {
                this.dungeon.go();
            }
        } else {
            // Not in a run - should be in town
            this.town.go();
        }
    }

    onShow() {

        this.tutorialManager.onPageVisible();
    }

    onPageVisible() {

        this.tutorialManager.onPageVisible();
    }

    nextTownTick() {
        if(this.isActive)
            return;

        this.town.performActions();

        this.townTimer.start(this.scaleInterval(this.townInterval));
        this.overview.renderQueue.turnProgressBar = true;
    }

    render() {
        // Skip all rendering during offline progress to prevent visual flickering
        if (loadingOfflineProgress)
            return;

        if (this._pendingReset)
            return;
        super.render();
        this.overview.render();
        this.log.render();
        this.party.render();
        this.pages.render();
    }

    registerData(namespace, data) {
        super.registerData(namespace, data); // pets, rareDrops, minibar, customMilestones

        // Load effect descriptions (triggers, targets, templates, conditions, layouts, starterLoadouts)
        if(data.effectDescriptions !== undefined || data.triggers !== undefined || data.targets !== undefined || data.conditions !== undefined || data.layouts !== undefined || data.starterLoadouts !== undefined) {
            loadEffectDescriptions(data);
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

        // Load constants from data
        if(data.timers !== undefined) {
            this.config.timers = { ...this.config.timers, ...data.timers };
        }
        if(data.xpValues !== undefined) {
            this.config.xpValues = { ...this.config.xpValues, ...data.xpValues };
        }
        if(data.limits !== undefined) {
            this.config.limits = { ...this.config.limits, ...data.limits };
        }

        if(data.stats !== undefined) {
            data.stats.forEach(data => {
                let stat = new AdventuringStat(namespace, data, this, this.game);
                this.stats.registerObject(stat);
            });
        }

        if(data.tags !== undefined) {
            data.tags.forEach(data => {
                let tag = new AdventuringTag(namespace, data, this, this.game);
                this.tags.registerObject(tag);
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
                this.abilities.registerObject(generator);
            });
        }

        if(data.spenders !== undefined) {
            data.spenders.forEach(data => {
                let spender = new AdventuringSpender(namespace, data, this, this.game);
                this.spenders.registerObject(spender);
                this.abilities.registerObject(spender);
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

        if(data.itemCategories !== undefined) {
            data.itemCategories.forEach(data => {
                let category = new AdventuringItemCategory(namespace, data, this, this.game);
                this.itemCategories.registerObject(category);
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

        if(data.consumableTypes !== undefined) {
            data.consumableTypes.forEach(data => {
                let consumable = new AdventuringConsumable(namespace, data, this, this.game);
                this.consumableTypes.registerObject(consumable);
            });
        }

        if(data.tavernDrinks !== undefined) {
            data.tavernDrinks.forEach(data => {
                let drink = new AdventuringTavernDrink(namespace, data, this, this.game);
                this.tavernDrinks.registerObject(drink);
            });
        }

        if(data.equipmentSets !== undefined) {
            data.equipmentSets.forEach(data => {
                let set = new AdventuringEquipmentSet(namespace, data, this, this.game);
                this.equipmentSets.registerObject(set);
            });
        }

        if(data.equipmentPools !== undefined) {
            data.equipmentPools.forEach(data => {
                let pool = new AdventuringEquipmentPool(namespace, data, this, this.game);
                this.equipmentPools.registerObject(pool);
            });
        }

        if(data.lootTables !== undefined) {
            data.lootTables.forEach(data => {
                let table = new AdventuringLootTable(namespace, data, this, this.game);
                this.lootTables.registerObject(table);
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

                // Register milestone objects if this achievement has milestones
                if (achievement._milestoneData && Array.isArray(achievement._milestoneData)) {
                    const milestoneObjects = [];
                    achievement._milestoneData.forEach((milestoneData, index) => {
                        const milestone = new AdventuringMilestone(
                            namespace,
                            { ...milestoneData, order: index },
                            achievement,
                            this,
                            this.game
                        );
                        this.achievementMilestones.registerObject(milestone);
                        milestoneObjects.push(milestone);
                    });
                    achievement.registerMilestones(milestoneObjects);
                }
            });
        }

        if(data.achievementStats !== undefined) {
            data.achievementStats.forEach(data => {
                let stat = new AdventuringAchievementStat(namespace, data, this);
                this.achievementStats.registerObject(stat);
            });
        }

        // Collect order data for processing in postDataRegistration
        if(data.areaOrder !== undefined) {
            this._pendingAreaOrders.push(data.areaOrder);
        }
        if(data.jobOrder !== undefined) {
            this._pendingJobOrders.push(data.jobOrder);
        }
        if(data.materialOrder !== undefined) {
            this._pendingMaterialOrders.push(data.materialOrder);
        }
        if(data.itemOrder !== undefined) {
            this._pendingItemOrders.push(data.itemOrder);
        }
        if(data.tavernOrder !== undefined) {
            this._pendingTavernOrders.push(data.tavernOrder);
        }
        if(data.consumableOrder !== undefined) {
            this._pendingConsumableOrders.push(data.consumableOrder);
        }
        if(data.monsterOrder !== undefined) {
            this._pendingMonsterOrders.push(data.monsterOrder);
        }
        if(data.difficultyOrder !== undefined) {
            this._pendingDifficultyOrders.push(data.difficultyOrder);
        }
        if(data.equipmentSetOrder !== undefined) {
            this._pendingEquipmentSetOrders.push(data.equipmentSetOrder);
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

        // Process all entity orderings after all entities are registered
        this._buildAllSortOrders();

        this.passivesByJob = new Map();
        this.jobs.forEach(job => {
            const jobPassives = this.passives.allObjects.filter(p => p.unlockedBy(job));
            this.passivesByJob.set(job.id, jobPassives);
        });

        this.cached = {
            // Jobs
            noneJob: this.jobs.getObjectByID('adventuring:none'),
            slayerJob: this.jobs.getObjectByID('adventuring:slayer'),
            
            // Items
            noneItem: this.baseItems.getObjectByID('adventuring:none'),
            noneItemSlot: this.itemSlots.getObjectByID('adventuring:none'),
            
            // Abilities
            noneGenerator: this.generators.getObjectByID('adventuring:none_generator'),
            noneSpender: this.spenders.getObjectByID('adventuring:none_spender'),
            
            // Materials
            slayerCoins: this.materials.getObjectByID('adventuring:slayer_coins'),
            currency: this.materials.getObjectByID('adventuring:currency'),
            salvage: this.materials.getObjectByID('adventuring:salvage'),
            pristineSalvage: this.materials.getObjectByID('adventuring:pristine_salvage'),
            mythicSalvage: this.materials.getObjectByID('adventuring:mythic_salvage'),
            
            // Common buffs
            might: this.buffs.getObjectByID('adventuring:might'),
            haste: this.buffs.getObjectByID('adventuring:haste'),
            regeneration: this.buffs.getObjectByID('adventuring:regeneration'),
            barrier: this.buffs.getObjectByID('adventuring:barrier'),
            focus: this.buffs.getObjectByID('adventuring:focus'),
            
            // Common debuffs
            vulnerability: this.debuffs.getObjectByID('adventuring:vulnerability'),
            slow: this.debuffs.getObjectByID('adventuring:slow'),
            poison: this.debuffs.getObjectByID('adventuring:poison'),
            burn: this.debuffs.getObjectByID('adventuring:burn'),
            bleed: this.debuffs.getObjectByID('adventuring:bleed'),
            stun: this.debuffs.getObjectByID('adventuring:stun'),
            
            // Difficulties
            normalDifficulty: this.difficulties.getObjectByID('adventuring:normal'),
            heroicDifficulty: this.difficulties.getObjectByID('adventuring:heroic'),
            mythicDifficulty: this.difficulties.getObjectByID('adventuring:mythic'),
            endlessDifficulty: this.difficulties.getObjectByID('adventuring:endless'),
            
            // Item categories
            meleeCategory: this.itemCategories.getObjectByID('adventuring:melee'),
            rangedCategory: this.itemCategories.getObjectByID('adventuring:ranged'),
            magicCategory: this.itemCategories.getObjectByID('adventuring:magic'),
            heavyCategory: this.itemCategories.getObjectByID('adventuring:heavy'),
            mediumCategory: this.itemCategories.getObjectByID('adventuring:medium'),
            lightCategory: this.itemCategories.getObjectByID('adventuring:light'),
            accessoriesCategory: this.itemCategories.getObjectByID('adventuring:accessories'),
            artifactsCategory: this.itemCategories.getObjectByID('adventuring:artifacts'),
            jobweaponsCategory: this.itemCategories.getObjectByID('adventuring:jobweapons')
        };

        this.combatJobs = this.jobs.allObjects.filter(job => job.id !== 'adventuring:none' && !job.isPassive);
        this.passiveJobs = this.jobs.allObjects.filter(job => job.id !== 'adventuring:none' && job.isPassive);

        this.auras.forEach(aura => aura.postDataRegistration());
        this.itemTypes.forEach(itemType => itemType.postDataRegistration());
        this.materials.forEach(material => material.postDataRegistration());
        this.baseItems.forEach(baseItem => baseItem.postDataRegistration());
        this.consumableTypes.forEach(consumable => consumable.postDataRegistration());
        this.tavernDrinks.forEach(drink => drink.postDataRegistration());
        this.equipmentSets.forEach(set => set.postDataRegistration());
        this.equipmentPools.forEach(pool => pool.postDataRegistration());

        this.buildSourceLookups();

        let jobMilestones = this.jobs.allObjects.filter(job => job.isMilestoneReward);
        let areaMilestones = this.areas.allObjects.filter(area => area.isMilestoneReward);

        [...jobMilestones, ...areaMilestones].forEach(milestone => {
            if(milestone.requirements.length === 1 && milestone.requirements[0].type === "skill_level") {
                this.milestones.push({
                    get name() { return milestone.name },
                    get media() { return milestone.media },
                    get level() { return milestone.requirements[0].level }
                });
            }
        });
        this.sortMilestones();

        this.sortedMasteryActions = [];

        this.overview.postDataRegistration();

        this.party.postDataRegistration();

        this.pages.postDataRegistration();

        this.tutorialManager.postDataRegistration();

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
     * Generic method to build sort order for any entity registry.
     * @param {NamespaceRegistry} registry - The registry containing the entities
     * @param {Array} pendingOrders - Array of order arrays collected from data
     * @param {string} orderKey - Key name for storing the ordered list (e.g., 'areaOrder')
     * @returns {Array} The ordered entity list
     */
    _buildEntitySortOrder(registry, pendingOrders, orderKey) {
        // Start with the combined order from all order arrays
        const orderedIds = [];
        pendingOrders.forEach(orderArray => {
            orderArray.forEach(id => {
                if (!orderedIds.includes(id)) {
                    orderedIds.push(id);
                }
            });
        });

        // Process individual orderPosition overrides
        registry.allObjects.forEach(entity => {
            if (!entity.orderPosition) return;
            
            const pos = entity.orderPosition;
            const currentIndex = orderedIds.indexOf(entity.id);
            
            // Remove from current position if present
            if (currentIndex !== -1) {
                orderedIds.splice(currentIndex, 1);
            }
            
            if (pos.insertStart) {
                orderedIds.unshift(entity.id);
            } else if (pos.insertEnd) {
                orderedIds.push(entity.id);
            } else if (pos.insertAfter) {
                const afterIndex = orderedIds.indexOf(pos.insertAfter);
                if (afterIndex !== -1) {
                    orderedIds.splice(afterIndex + 1, 0, entity.id);
                } else {
                    orderedIds.push(entity.id);
                }
            } else if (pos.insertBefore) {
                const beforeIndex = orderedIds.indexOf(pos.insertBefore);
                if (beforeIndex !== -1) {
                    orderedIds.splice(beforeIndex, 0, entity.id);
                } else {
                    orderedIds.push(entity.id);
                }
            }
        });

        // Assign sortOrder to each entity (unordered entities get a high sortOrder)
        registry.allObjects.forEach(entity => {
            const index = orderedIds.indexOf(entity.id);
            entity.sortOrder = index !== -1 ? index : 9999;
        });

        // Store the ordered list for reference
        const orderedList = orderedIds.map(id => registry.getObjectByID(id)).filter(e => e);
        this[orderKey] = orderedList;

        return orderedList;
    }

    /**
     * Build sort orders for all entity types that have ordering data.
     */
    _buildAllSortOrders() {
        // Areas
        this._buildEntitySortOrder(this.areas, this._pendingAreaOrders, 'areaOrder');
        this._pendingAreaOrders = [];

        // Jobs
        this._buildEntitySortOrder(this.jobs, this._pendingJobOrders, 'jobOrder');
        this._pendingJobOrders = [];

        // Materials
        this._buildEntitySortOrder(this.materials, this._pendingMaterialOrders, 'materialOrder');
        this._pendingMaterialOrders = [];

        // Base Items
        this._buildEntitySortOrder(this.baseItems, this._pendingItemOrders, 'itemOrder');
        this._pendingItemOrders = [];

        // Tavern Drinks
        this._buildEntitySortOrder(this.tavernDrinks, this._pendingTavernOrders, 'tavernOrder');
        this._pendingTavernOrders = [];

        // Consumables
        this._buildEntitySortOrder(this.consumableTypes, this._pendingConsumableOrders, 'consumableOrder');
        this._pendingConsumableOrders = [];

        // Monsters
        this._buildEntitySortOrder(this.monsters, this._pendingMonsterOrders, 'monsterOrder');
        this._pendingMonsterOrders = [];

        // Difficulties
        this._buildEntitySortOrder(this.difficulties, this._pendingDifficultyOrders, 'difficultyOrder');
        this._pendingDifficultyOrders = [];

        // Equipment Sets
        this._buildEntitySortOrder(this.equipmentSets, this._pendingEquipmentSetOrders, 'equipmentSetOrder');
        this._pendingEquipmentSetOrders = [];
    }

    buildSourceLookups() {

        this.monsterSources = new Map();
        this.areas.forEach(area => {
            if(!area.floors) return;
            area.floors.forEach(floor => {

                if(floor.monsters) {
                    floor.monsters.forEach(entry => {
                        const monster = this.monsters.getObjectByID(entry.id);
                        if(!monster) return;
                        if(!this.monsterSources.has(monster)) {
                            this.monsterSources.set(monster, []);
                        }
                        const sources = this.monsterSources.get(monster);
                        if(!sources.includes(area)) {
                            sources.push(area);
                        }
                    });
                }

                if(floor.exit) {
                    floor.exit.forEach(monsterId => {
                        const monster = this.monsters.getObjectByID(monsterId);
                        if(!monster) return;
                        if(!this.monsterSources.has(monster)) {
                            this.monsterSources.set(monster, []);
                        }
                        const sources = this.monsterSources.get(monster);
                        if(!sources.includes(area)) {
                            sources.push(area);
                        }
                    });
                }
            });
        });

        this.materialSources = new Map();
        this.monsters.forEach(monster => {
            if(monster.lootGenerator === undefined || monster.lootGenerator.table === undefined) return;
            monster.lootGenerator.table.forEach(entry => {
                const material = this.materials.getObjectByID(entry.id);
                if(!material) return;
                if(!this.materialSources.has(material)) {
                    this.materialSources.set(material, []);
                }
                const sources = this.materialSources.get(material);
                if(!sources.includes(monster)) {
                    sources.push(monster);
                }
            });
        });

        this.equipmentSources = new Map();
        this.monsters.forEach(monster => {
            if(monster.lootGenerator === undefined || monster.lootGenerator.table === undefined) return;
            this.scanLootTableForEquipment(monster.lootGenerator.table, monster);
        });
    }

    scanLootTableForEquipment(entries, monster) {
        for(const entry of entries) {
            if(entry.type === 'table') {

                const table = this.lootTables.getObjectByID(entry.table);
                if(table) {
                    this.scanLootTableForEquipment(table.getEntries(), monster);
                }
            } else if(entry.type === 'equipment') {

                const item = this.baseItems.getObjectByID(entry.id);
                if(item) {
                    if(!this.equipmentSources.has(item)) {
                        this.equipmentSources.set(item, []);
                    }
                    const sources = this.equipmentSources.get(item);
                    if(!sources.includes(monster)) {
                        sources.push(monster);
                    }
                }
            } else if(entry.type === 'equipment_pool') {

                const pool = this.equipmentPools.getObjectByID(entry.pool);
                if(pool) {
                    for(const poolEntry of pool.items) {
                        const item = poolEntry.item;
                        if(!this.equipmentSources.has(item)) {
                            this.equipmentSources.set(item, []);
                        }
                        const sources = this.equipmentSources.get(item);
                        if(!sources.includes(monster)) {
                            sources.push(monster);
                        }
                    }
                }
            }
        }
    }

    getPassivesForJob(job) {
        if (this.passivesByJob === undefined) return [];
        const passives = this.passivesByJob.get(job.id);
        return passives !== undefined ? passives : [];
    }

    getGlobalPassives() {
        // Return passives that are not tied to any job (e.g., achievement passives)
        // These have achievement_completion requirements instead of job_level requirements
        if (this.passives === undefined) return [];
        return this.passives.allObjects.filter(p => {
            // Has achievement requirement and no job requirements
            const hasAchievementReq = p.requirements.some(r => r.type === 'achievement_completion');
            const hasJobReq = p.requirements.some(r => r.type === 'job_level' || r.type === 'current_job_level');
            return hasAchievementReq && !hasJobReq;
        });
    }

    /**
     * Get all global passive effects that the character can use.
     * @param {Object} character - The character to check requirements against
     * @returns {Array} Array of flat effects with source metadata
     */
    getGlobalPassiveEffects(character) {
        const results = [];
        const passives = this.getGlobalPassives();

        for (const passive of passives) {
            if (!passive.canEquip(character)) continue;
            if (!passive.effects) continue;
            
            for (const effect of passive.effects) {
                const effectObj = {
                    ...effect,
                    sourcePath: [{ type: 'globalPassive', name: `Achievement (${passive.name})`, ref: passive }]
                };
                // Preserve getAmount and getStacks methods if they exist
                if (typeof effect.getAmount === 'function') {
                    effectObj.getAmount = effect.getAmount.bind(effect);
                }
                if (typeof effect.getStacks === 'function') {
                    effectObj.getStacks = effect.getStacks.bind(effect);
                }
                results.push(effectObj);
            }
        }

        return results;
    }

    /**
     * Get global passive effects (achievement-unlocked) for a trigger type.
     * @param {Object} character - The character to check requirements against
     * @param {string} triggerType - The trigger type to filter by
     * @returns {Array} Array of flat effects with source metadata
     */
    getGlobalPassivesForTrigger(character, triggerType) {
        return this.getGlobalPassiveEffects(character).filter(e => e.trigger === triggerType);
    }

    getAbilityByID(id) {
        const gen = this.generators.getObjectByID(id);
        if (gen !== undefined) return gen;
        return this.spenders.getObjectByID(id);
    }

    /**
     * Checks if an ability is one of the "none" placeholder abilities.
     * @param {AdventuringAbility} ability - The ability to check
     * @returns {boolean} True if the ability is the none_generator or none_spender
     */
    isNoneAbility(ability) {
        return ability === this.cached.noneGenerator || ability === this.cached.noneSpender;
    }

    encode(writer) {
        const start = writer.byteOffset;

        super.encode(writer);

        writer.writeUint32(this.version);

        this.party.encode(writer);

        this.pages.encode(writer);

        writer.writeBoolean(this.isActive);

        writer.writeUint32(this.learnedAbilities.size);
        this.learnedAbilities.forEach(abilityId => {
            const ability = this.getAbilityByID(abilityId);
            writer.writeNamespacedObject(ability);
        });

        this.slayers.encode(writer);

        this.tavern.encode(writer);

        this.lemons.encode(writer);

        this.consumables.encode(writer);

        const validSeenAbilities = [...this.seenAbilities]
            .map(id => this.getAbilityByID(id))
            .filter(ability => ability !== undefined);
        writer.writeUint32(validSeenAbilities.length);
        validSeenAbilities.forEach(ability => {
            writer.writeNamespacedObject(ability);
        });

        this.tutorialManager.encode(writer);

        this.achievementManager.encode(writer);

        this.combatTracker.encode(writer);

        this.grimoire.encode(writer);

        // Version 6+: Log filter settings
        this.log.encode(writer);

        console.log(`Wrote ${writer.byteOffset - start} bytes for Adventuring save`);

        return writer;
    }

    decode(reader, version) {
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

            const numLearned = reader.getUint32();
            for(let i = 0; i < numLearned; i++) {
                const ability = reader.getNamespacedObject(this.abilities);
                if(ability && typeof ability !== 'string') {
                    this.learnedAbilities.add(ability.id);
                }
            }

            this.slayers.decode(reader, version);

            this.tavern.decode(reader, version);
            this.lemons.decode(reader, version);

            this.consumables.decode(reader, version);

            const numSeen = reader.getUint32();
            for(let i = 0; i < numSeen; i++) {
                const ability = reader.getNamespacedObject(this.abilities);
                if(ability && typeof ability !== 'string') {
                    this.seenAbilities.add(ability.id);
                }
            }

            this.tutorialManager.decode(reader, version);

            this.achievementManager.decode(reader, version);

            // Version 10+: CombatTracker
            if(this.saveVersion >= 10) {
                this.combatTracker.decode(reader, version);
            }

            if(this.saveVersion >= 5) {
                this.grimoire.decode(reader, version);
            }
            
            // Version 9+: Log filter settings
            if(this.saveVersion >= 9) {
                this.log.decode(reader, version);
            }
        } catch(e) {

            console.warn('Adventuring save decode failed, performing full reset:', e);
            reader.byteOffset = start;
            reader.getFixedLengthBuffer(skillDataSize);

            this._pendingReset = true;
        }
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

