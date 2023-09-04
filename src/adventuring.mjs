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
const { AdventuringMonster } = await loadModule('src/adventuring-monster.mjs');
const { AdventuringDungeonTile } = await loadModule('src/adventuring-dungeon-tile.mjs');


const { AdventuringOverview } = await loadModule('src/adventuring-overview.mjs');
const { AdventuringMessageLog } = await loadModule('src/adventuring-message-log.mjs');

const { AdventuringParty } = await loadModule('src/adventuring-party.mjs');
const { AdventuringPages } = await loadModule('src/adventuring-pages.mjs');

const { AdventuringHeroParty, AdventuringEnemyParty } = await loadModule('src/adventuring-party.mjs');

const { AdventuringTown } = await loadModule('src/adventuring-town.mjs');

const { AdventuringTrainer } = await loadModule('src/adventuring-trainer.mjs');
const { AdventuringJobDetails } = await loadModule('src/adventuring-job-details.mjs');

const { AdventuringArmory } = await loadModule('src/adventuring-armory.mjs');
const { AdventuringTavern } = await loadModule('src/adventuring-tavern.mjs');
const { AdventuringSlayers } = await loadModule('src/adventuring-slayers.mjs');
const { AdventuringLemons } = await loadModule('src/adventuring-lemons.mjs');

const { AdventuringStash } = await loadModule('src/adventuring-stash.mjs');
const { AdventuringBestiary } = await loadModule('src/adventuring-bestiary.mjs');
const { AdventuringCrossroads } = await loadModule('src/adventuring-crossroads.mjs');
const { AdventuringDungeon } = await loadModule('src/adventuring-dungeon.mjs');
const { AdventuringEncounter } = await loadModule('src/adventuring-encounter.mjs');

const { AdventuringItemSlot } = await loadModule('src/adventuring-item-slot.mjs');
const { AdventuringItemType } = await loadModule('src/adventuring-item-type.mjs');
const { AdventuringItemBase } = await loadModule('src/adventuring-item-base.mjs');
const { AdventuringMaterial } = await loadModule('src/adventuring-material.mjs');


const { AdventuringPageUIComponent } = await loadModule('src/components/adventuring.mjs');

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
        this.monsters = new NamespaceRegistry(this.game.registeredNamespaces);
        this.tiles = new NamespaceRegistry(this.game.registeredNamespaces);

        this.itemSlots = new NamespaceRegistry(this.game.registeredNamespaces);
        this.itemTypes = new NamespaceRegistry(this.game.registeredNamespaces);

        this.materials = new NamespaceRegistry(this.game.registeredNamespaces);
        this.baseItems = new NamespaceRegistry(this.game.registeredNamespaces);

        this.component = new AdventuringPageUIComponent(this, this.game);

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

        this.stash = new AdventuringStash(this, this.game);
        this.bestiary = new AdventuringBestiary(this, this.game);
        this.crossroads = new AdventuringCrossroads(this, this.game);
        this.dungeon = new AdventuringDungeon(this, this.game);
        this.encounter = new AdventuringEncounter(this, this.game);


        this.pages.register('town', this.town);

        this.pages.register('trainer', this.trainer);
        this.pages.register('jobdetails', this.jobdetails);

        this.pages.register('armory', this.armory);
        this.pages.register('tavern', this.tavern);
        this.pages.register('slayers', this.slayers);
        this.pages.register('lemons', this.lemons);

        this.pages.register('stash', this.stash);
        this.pages.register('bestiary', this.bestiary);
        this.pages.register('crossroads', this.crossroads);
        this.pages.register('dungeon', this.dungeon);
        this.pages.register('encounter', this.encounter);

        this.townTimer = new Timer('Town', () => this.nextTownTick());
        this.townInterval = 5000;
        console.log("Adventuring constructor done");
    }

    reset() {
        //this.party.decode(reader, version);
        //this.armory.decode(reader, version);
        //this.stash.decode(reader, version);
        //this.bestiary.decode(reader, version);
        //this.dungeon.decode(reader, version);
        //this.encounter.decode(reader, version);
        //this.isActive = reader.getBoolean();
    }

/*
    General
        - "New" indicators for bestiary/armory/etc
        - "Seen" tracked in this.manager, indicator for new things
    Town Buildings
        - Adventurers decide what to do in town every tick
        - Tavern
            - Adventurer stops here for healing before doing anything else
            - Buy drinks aka buffs that last X dungeon runs
            - Uses coins and different monster materials
        - Lemon Stall
            - Idle here randomly
            - Lemons
        - Smithy/Workshop/Etc
            - Each tick consumes "Unknown" material based on conversion
            - Stat level determines max material type
            - Submit work orders for x count of y material
            - Work order slot count determined by building level
            - Characters turn materials into melvor items (Unidentified -> Bronze/Iron/etc)
        - Slayer's Lodge
            - Quests
                - Kill enemies
                - Clear Dungeons
                - Add quest specific event tiles in dungeons
                - Collect and turn in materials
    Monsters
        - Mastery
            - Item drop rates
            - Item Quantity
    Dungeons
        - Mastery
            - Auto-Repeat
            - Tile chances
            - New tiles
            - Unlock difficulties
    Jobs
        - Slayer (Blue Mage)
            - Learn new abilities from enemies when using "ultimate"
    Abilities
        - Mastery
            - "Talent" tree for modifying abilities
*/
    

    onLoad() {
        console.log("Adventuring onLoad");
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

    computeTotalMasteryActions() {
        this.actions.namespaceMaps.forEach((actionMap,namespace)=>{
            this.totalMasteryActions.set(namespace, actionMap.size);
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

        saveData();
        return true;
    }

    getErrorLog() {
        return `Is Active: ${this.isActive}\n`;
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

    onPageChange() {
        this.overview.renderQueue.turnProgressBar = true;
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

        if(data.overview !== undefined)
            this.overview.registerData(data.overview);

        if(data.stats !== undefined) {
            console.log(`Registering ${data.stats.length} Stats`);
            data.stats.forEach(data => {
                let stat = new AdventuringStat(namespace, data, this, this.game);
                this.stats.registerObject(stat);
            });
        }

        if(data.buildings !== undefined) {
            console.log(`Registering ${data.buildings.length} Buildings`);
            data.buildings.forEach(data => {
                let building = new AdventuringBuilding(namespace, data, this, this.game);
                this.buildings.registerObject(building);
            });
        }

        if(data.townActions !== undefined) {
            console.log(`Registering ${data.townActions.length} Town Actions`);
            data.townActions.forEach(data => {
                let townAction = new AdventuringTownAction(namespace, data, this, this.game);
                this.townActions.registerObject(townAction);
            });
        }

        if(data.products !== undefined) {
            console.log(`Registering ${data.products.length} Products`);
            data.products.forEach(data => {
                let product = new AdventuringProduct(namespace, data, this, this.game);
                this.products.registerObject(product);
            });
        }

        if(data.jobs !== undefined) {
            console.log(`Registering ${data.jobs.length} Jobs`);
            data.jobs.forEach(data => {
                let job = new AdventuringJob(namespace, data, this, this.game);
                this.jobs.registerObject(job);
                if(job.id !== "adventuring:none")
                    this.actions.registerObject(job);
            });
        }

        if(data.generators !== undefined) {
            console.log(`Registering ${data.generators.length} Generators`);
            data.generators.forEach(data => {
                let generator = new AdventuringGenerator(namespace, data, this, this.game);
                this.generators.registerObject(generator);
            });
        }

        if(data.spenders !== undefined) {
            console.log(`Registering ${data.spenders.length} Spenders`);
            data.spenders.forEach(data => {
                let spender = new AdventuringSpender(namespace, data, this, this.game);
                this.spenders.registerObject(spender);
            });
        }

        if(data.passives !== undefined) {
            console.log(`Registering ${data.passives.length} Passives`);
            data.passives.forEach(data => {
                let passive = new AdventuringPassive(namespace, data, this, this.game);
                this.passives.registerObject(passive);
            });
        }

        if(data.buffs !== undefined) {
            console.log(`Registering ${data.buffs.length} Buffs`);
            data.buffs.forEach(data => {
                let buff = new AdventuringBuff(namespace, data, this, this.game);
                this.buffs.registerObject(buff);
                this.auras.registerObject(buff);
            });
        }

        if(data.debuffs !== undefined) {
            console.log(`Registering ${data.debuffs.length} Debuffs`);
            data.debuffs.forEach(data => {
                let debuff = new AdventuringDebuff(namespace, data, this, this.game);
                this.debuffs.registerObject(debuff);
                this.auras.registerObject(debuff);
            });
        }

        if(data.areas !== undefined) {
            console.log(`Registering ${data.areas.length} Areas`);
            data.areas.forEach(data => {
                let area = new AdventuringArea(namespace, data, this, this.game);
                this.areas.registerObject(area);
                this.actions.registerObject(area);
            });
        }
        
        if(data.monsters !== undefined) {
            console.log(`Registering ${data.monsters.length} Monsters`);
            data.monsters.forEach(data => {
                let monster = new AdventuringMonster(namespace, data, this, this.game);
                this.monsters.registerObject(monster);
                this.actions.registerObject(monster);
            });
        }
        
        if(data.tiles !== undefined) {
            console.log(`Registering ${data.tiles.length} Tiles`);
            data.tiles.forEach(data => {
                let tile = new AdventuringDungeonTile(namespace, data, this, this.game);
                this.tiles.registerObject(tile);
            });
        }

        if(data.itemSlots !== undefined) {
            console.log(`Registering ${data.itemSlots.length} Item Slots`);
            data.itemSlots.forEach(data => {
                let slot = new AdventuringItemSlot(namespace, data, this, this.game);
                this.itemSlots.registerObject(slot);
            });
        }

        if(data.itemTypes !== undefined) {
            console.log(`Registering ${data.itemTypes.length} Item Types`);
            data.itemTypes.forEach(data => {
                let itemType = new AdventuringItemType(namespace, data, this, this.game);
                this.itemTypes.registerObject(itemType);
            });
        }

        if(data.materials !== undefined) {
            console.log(`Registering ${data.materials.length} Materials`);
            data.materials.forEach(data => {
                let material = new AdventuringMaterial(namespace, data, this, this.game);
                this.materials.registerObject(material);
            });
        }

        if(data.baseItems !== undefined) {
            console.log(`Registering ${data.baseItems.length} Base Items`);
            data.baseItems.forEach(data => {
                let item = new AdventuringItemBase(namespace, data, this, this.game);
                this.baseItems.registerObject(item);
                if(item.id !== "adventuring:none")
                    this.actions.registerObject(item);
            });
        }
    }

    postDataRegistration() {
        console.log("Adventuring postDataRegistration");
        super.postDataRegistration(); // Milestones setLevel

        this.buildings.forEach(building => building.postDataRegistration());
        this.townActions.forEach(townAction => townAction.postDataRegistration());
        this.products.forEach(product => product.postDataRegistration());
        this.jobs.forEach(job => job.postDataRegistration());
        this.areas.forEach(area => area.postDataRegistration());
        this.generators.forEach(generator => generator.postDataRegistration());
        this.spenders.forEach(spender => spender.postDataRegistration());
        this.auras.forEach(aura => aura.postDataRegistration());
        this.materials.forEach(material => material.postDataRegistration());
        this.baseItems.forEach(baseItem => baseItem.postDataRegistration());

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

        let capesToExclude = ["melvorF:Max_Skillcape", "melvorTotH:Superior_Max_Skillcape"];
        let skillCapes = this.game.shop.purchases.filter(purchase => capesToExclude.includes(purchase.id));
        skillCapes.forEach(cape => {
            let allSkillLevelsRequirement = cape.purchaseRequirements.find(req => req.type === "AllSkillLevels");
            if(allSkillLevelsRequirement.exceptions === undefined)
                allSkillLevelsRequirement.exceptions = new Set();
            allSkillLevelsRequirement.exceptions.add(this);
        });
    }

    encode(writer) {
        let start = writer.byteOffset;
        super.encode(writer); // Encode default skill data
        writer.writeUint32(this.version); // Store current skill version

        this.party.encode(writer);
        this.pages.encode(writer);
        writer.writeBoolean(this.isActive);

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
        } catch(e) { // Something's fucky, dump all progress and skip past the trash save data
            console.log(e);
            reader.byteOffset = start;
            reader.getFixedLengthBuffer(skillDataSize);
        }

        let end = reader.byteOffset;
        //console.log(`Read ${end-start} bytes for Adventuring save`);
    }

    checkpoints = [
        { description: "+5% increased Adventuring Mastery XP" },
        { description: "+10% increased Adventuring Mastery XP" },
        { description: "+15% increased Adventuring Mastery XP" },
        { description: "+20% increased Adventuring Mastery XP" }
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

