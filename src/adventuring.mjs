const { loadModule } = mod.getContext(import.meta);

const { AdventuringEquipmentItem } = await loadModule('src/adventuring-equipment-item.mjs');

const { AdventuringStat } = await loadModule('src/adventuring-stat.mjs');
const { AdventuringJob } = await loadModule('src/adventuring-job.mjs');
const { AdventuringGenerator } = await loadModule('src/adventuring-generator.mjs');
const { AdventuringSpender } = await loadModule('src/adventuring-spender.mjs');
const { AdventuringPassive } = await loadModule('src/adventuring-passive.mjs');
const { AdventuringArea } = await loadModule('src/adventuring-area.mjs');
const { AdventuringMonster } = await loadModule('src/adventuring-monster.mjs');
const { AdventuringSuffix } = await loadModule('src/adventuring-suffix.mjs');

const { AdventuringOverview } = await loadModule('src/adventuring-overview.mjs');
const { AdventuringMessageLog } = await loadModule('src/adventuring-message-log.mjs');

const { AdventuringParty } = await loadModule('src/adventuring-party.mjs');
const { AdventuringPages } = await loadModule('src/adventuring-pages.mjs');

const { AdventuringHeroParty, AdventuringEnemyParty } = await loadModule('src/adventuring-party.mjs');

const { AdventuringTrainer } = await loadModule('src/adventuring-trainer.mjs');
const { AdventuringJobDetails } = await loadModule('src/adventuring-job-details.mjs');
const { AdventuringStash } = await loadModule('src/adventuring-stash.mjs');
const { AdventuringCrossroads } = await loadModule('src/adventuring-crossroads.mjs');
const { AdventuringDungeon } = await loadModule('src/adventuring-dungeon.mjs');
const { AdventuringEncounter } = await loadModule('src/adventuring-encounter.mjs');

const { AdventuringLootGenerator } = await loadModule('src/adventuring-loot-generator.mjs');

const { AdventuringItemSlot } = await loadModule('src/adventuring-item-slot.mjs');
const { AdventuringItemType } = await loadModule('src/adventuring-item-type.mjs');
const { AdventuringItemPool } = await loadModule('src/adventuring-item-pool.mjs');
const { AdventuringItemTier } = await loadModule('src/adventuring-item-tier.mjs');
const { AdventuringItemBase } = await loadModule('src/adventuring-item-base.mjs');


const { AdventuringPageUIComponent } = await loadModule('src/components/adventuring.mjs');

class AdventuringRenderQueue extends MasterySkillRenderQueue {
    constructor() {
        super(...arguments);
    }
}

export class Adventuring extends SkillWithMastery {
    constructor(namespace, game) {
        super(namespace, 'Adventuring', game);
        this.version = 2;
        this.saveVersion = -1;
        this._media = 'assets/media/main/adventure.svg';
        this.renderQueue = new AdventuringRenderQueue();
        this.isActive = false;
        this.emptyEquipmentItem = new AdventuringEquipmentItem(this, this.game);

        this.stats = new NamespaceRegistry(this.game.registeredNamespaces);
        this.jobs = new NamespaceRegistry(this.game.registeredNamespaces);
        this.generators = new NamespaceRegistry(this.game.registeredNamespaces);
        this.spenders = new NamespaceRegistry(this.game.registeredNamespaces);
        this.passives = new NamespaceRegistry(this.game.registeredNamespaces);
        this.areas = new NamespaceRegistry(this.game.registeredNamespaces);
        this.monsters = new NamespaceRegistry(this.game.registeredNamespaces);
        this.suffixes = new NamespaceRegistry(this.game.registeredNamespaces);

        this.itemSlots = new NamespaceRegistry(this.game.registeredNamespaces);
        this.itemTypes = new NamespaceRegistry(this.game.registeredNamespaces);
        this.itemPools = new NamespaceRegistry(this.game.registeredNamespaces);
        this.itemTiers = new NamespaceRegistry(this.game.registeredNamespaces);
        this.baseItems = new NamespaceRegistry(this.game.registeredNamespaces);

        this.component = new AdventuringPageUIComponent(this, this.game);

        this.overview = new AdventuringOverview(this, this.game);
        this.overview.component.mount(this.component.overview);

        this.log = new AdventuringMessageLog(this, this.game);
        this.log.component.mount(this.overview.component.log);

        this.party = new AdventuringHeroParty(this, this.game);
        this.party.component.mount(this.component.party);

        this.pages = new AdventuringPages(this, this.game);

        this.trainer = new AdventuringTrainer(this, this.game);
        this.jobdetails = new AdventuringJobDetails(this, this.game);
        this.stash = new AdventuringStash(this, this.game);
        this.crossroads = new AdventuringCrossroads(this, this.game);
        this.dungeon = new AdventuringDungeon(this, this.game);
        this.encounter = new AdventuringEncounter(this, this.game);

        this.lootgen = new AdventuringLootGenerator(this, this.game);

        this.healTimer = new Timer('Heal', () => this.nextHeal());
        this.healInterval = 5000;
        console.log("Adventuring constructor done");
    }


    // Passive Jobs
    //  - Xp passively
    //  - generates tiles
    //  - main game resources
    // Town Buildings
    //  - Production
    // Dunegon Mastery
    

    onLoad() {
        console.log("Adventuring onLoad");
        super.onLoad();
        this.overview.onLoad();
        this.party.onLoad();

        this.pages.register(this.trainer);
        this.pages.register(this.jobdetails);
        this.pages.register(this.stash);
        this.pages.register(this.crossroads);
        this.pages.register(this.dungeon);
        this.pages.register(this.encounter);

        this.pages.onLoad();

        this.overview.renderQueue.turnProgressBar = true;
        this.overview.renderQueue.healProgressBar = true;
        
        if(this.isActive) {
            if(this.encounter.isFighting) {
                this.encounter.go();
            } else {
                this.dungeon.go();
            }
        } else {
            this.trainer.go();
        }
    }

    onLevelUp(oldLevel, newLevel) {
        super.onLevelUp(oldLevel, newLevel);
        this.jobs.allObjects.forEach(job => {
            job.renderQueue.name = true;
            job.renderQueue.icon = true;
        });

        this.areas.allObjects.forEach(area => {
            area.renderQueue.name = true;
            area.renderQueue.icon = true;
            area.renderQueue.clickable = true;
        });

        this.party.all.forEach(member => {
            member.renderQueue.jobs = true;
        });
    }

    onMasteryLevelUp(action, oldLevel, newLevel) {
        super.onMasteryLevelUp(action, oldLevel, newLevel);
        this.party.all.forEach(member => {
            member.calculateStats();
            member.renderQueue.jobs = true;
        });
    }

    selectArea(area) {
        if(this.party.all.some(member => !member.dead)) {
            this.dungeon.setArea(area);
            this.dungeon.start();
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
        
        if(this.healTimer.isActive)
            this.healTimer.stop();
        
        this.overview.renderQueue.turnProgressBar = true;
        this.overview.renderQueue.healProgressBar = true;

        saveData();
        return true;
    }

    stop() {
        if (!this.canStop)
            return false;
        
        if(this.dungeon.exploreTimer.isActive)
            this.dungeon.exploreTimer.stop();
        
        if(this.encounter.turnTimer.isActive)
            this.encounter.turnTimer.stop();
    
        if(this.encounter.hitTimer.isActive)
            this.encounter.hitTimer.stop();

        if(this.isActive) {
            this.dungeon.reset();
            this.trainer.go();
        }

        this.isActive = false;
        this.game.renderQueue.activeSkills = true;
        this.game.clearActiveAction(false);

        if(!this.healTimer.isActive && this.party.all.some(member => member.dead || member.hitpoints < member.maxHitpoints))
            this.healTimer.start(this.healInterval);
        
        this.overview.renderQueue.turnProgressBar = true;
        this.overview.renderQueue.healProgressBar = true;

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
            this.dungeon.exploreTimer.tick();
        }
    }

    passiveTick() {
        if(this.isActive)
            return;
        
        this.party.all.forEach(member => {
            if(member.energy > 0)
                member.setEnergy(0);
        });

        if(!this.healTimer.isActive) {
            this.healTimer.start(this.healInterval);
        
            this.overview.renderQueue.turnProgressBar = true;
            this.overview.renderQueue.healProgressBar = true;
        }

        /*
        if(this.healTimer.isActive && this.party.all.every(member => !member.dead && member.hitpoints == member.maxHitpoints)) {
            this.healTimer.stop();
        
            this.overview.renderQueue.turnProgressBar = true;
            this.overview.renderQueue.healProgressBar = true;
        }
        */
        
        if(this.healTimer.isActive)
            this.healTimer.tick();
    }

    getMasteryXP(action) {
        if(!action.unlocked)
            return -Infinity;
        return super.getMasteryXP(action);
    }

    nextHeal() {
        if(this.isActive)
            return;
        
        this.party.all.forEach(member => {
            if(member.dead) {
                member.revive(0.10);
            } else if(member.hitpoints < member.maxHitpoints) {
                member.heal(Math.floor(member.maxHitpoints * 0.05));
            }
            if(member.energy > 0)
                member.setEnergy(0);
        });

        this.healTimer.start(this.healInterval);
        this.overview.renderQueue.healProgressBar = true;
    }

    render() {
        this.renderQueue.actionMastery.forEach(masteryItem => {
            masteryItem.renderQueue.mastery = true;
        });
        super.render();
        
        this.overview.render();

        this.log.render();

        this.party.render();

        this.pages.render();
    }

    registerData(namespace, data) {
        super.registerData(namespace, data); // pets, rareDrops, minibar, customMilestones

        console.log(`Registering ${data.stats.length} Stats`);
        data.stats.forEach(data => {
            let stat = new AdventuringStat(namespace, data, this, this.game);
            this.stats.registerObject(stat);
        });

        console.log(`Registering ${data.jobs.length} Jobs`);
        data.jobs.forEach(data => {
            let job = new AdventuringJob(namespace, data, this, this.game);
            this.jobs.registerObject(job);
            this.actions.registerObject(job);
        });

        console.log(`Registering ${data.generators.length} Generators`);
        data.generators.forEach(data => {
            let generator = new AdventuringGenerator(namespace, data, this, this.game);
            this.generators.registerObject(generator);
        });

        console.log(`Registering ${data.spenders.length} Spenders`);
        data.spenders.forEach(data => {
            let spender = new AdventuringSpender(namespace, data, this, this.game);
            this.spenders.registerObject(spender);
        });

        console.log(`Registering ${data.passives.length} Passives`);
        data.passives.forEach(data => {
            let passive = new AdventuringPassive(namespace, data, this, this.game);
            this.passives.registerObject(passive);
        });

        console.log(`Registering ${data.areas.length} Areas`);
        data.areas.forEach(data => {
            let area = new AdventuringArea(namespace, data, this, this.game);
            this.areas.registerObject(area);
            this.actions.registerObject(area);
        });
        
        console.log(`Registering ${data.monsters.length} Monsters`);
        data.monsters.forEach(data => {
            let monster = new AdventuringMonster(namespace, data, this, this.game);
            this.monsters.registerObject(monster);
        });

        console.log(`Registering ${data.itemSlots.length} Item Slots`);
        data.itemSlots.forEach(data => {
            let slot = new AdventuringItemSlot(namespace, data, this, this.game);
            this.itemSlots.registerObject(slot);
        });

        console.log(`Registering ${data.itemTypes.length} Item Types`);
        data.itemTypes.forEach(data => {
            let itemType = new AdventuringItemType(namespace, data, this, this.game);
            this.itemTypes.registerObject(itemType);
        });

        console.log(`Registering ${data.itemPools.length} Item Pools`);
        data.itemPools.forEach(data => {
            let pool = new AdventuringItemPool(namespace, data, this, this.game);
            this.itemPools.registerObject(pool);
        });

        console.log(`Registering ${data.itemTiers.length} Item Tiers`);
        data.itemTiers.forEach(data => {
            let itemTier = new AdventuringItemTier(namespace, data, this, this.game);
            this.itemTiers.registerObject(itemTier);
        });

        console.log(`Registering ${data.baseItems.length} Base Items`);
        data.baseItems.forEach(data => {
            let item = new AdventuringItemBase(namespace, data, this, this.game);
            this.baseItems.registerObject(item);
        });

        console.log(`Registering ${data.suffixes.length} Suffixes`);
        data.suffixes.forEach(data => {
            let suffix = new AdventuringSuffix(namespace, data, this, this.game);
            this.suffixes.registerObject(suffix);
        });
    }

    postDataRegistration() {
        console.log("Adventuring postDataRegistration");
        super.postDataRegistration(); // Milestones setLevel

        this.jobs.allObjects.forEach(job => job.postDataRegistration());
        this.generators.allObjects.forEach(generator => generator.postDataRegistration());
        this.spenders.allObjects.forEach(spender => spender.postDataRegistration());

        let jobMilestones = this.jobs.allObjects.filter(job => job.isMilestoneReward);
        let areaMilestones = this.areas.allObjects;

        this.milestones.push(...jobMilestones, ...areaMilestones);
        this.sortMilestones();
        
        this.sortedMasteryActions = [...jobMilestones.sort((a,b)=> a.level - b.level), ...areaMilestones.sort((a,b)=> a.level - b.level)];

        this.party.postDataRegistration();
        this.trainer.postDataRegistration();
        this.stash.postDataRegistration();
        this.crossroads.postDataRegistration();
        this.encounter.postDataRegistration();

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
        this.stash.encode(writer);
        this.dungeon.encode(writer);
        this.encounter.encode(writer);
        writer.writeBoolean(this.isActive);

        let end = writer.byteOffset;
        //console.log(`Wrote ${end-start} bytes for Adventuring save`);
        return writer;
    }

    decode(reader, version) {
        console.log("Adventuring save decoding");
        let start = reader.byteOffset;
        reader.byteOffset -= Uint32Array.BYTES_PER_ELEMENT; // Let's back up a minute and get the size of our skill data
        let skillDataSize = reader.getUint32();

        try {
            super.decode(reader, version);
            this.saveVersion = reader.getUint32(); // Read save version

            this.party.decode(reader, version);
            this.stash.decode(reader, version);
            this.dungeon.decode(reader, version);
            this.encounter.decode(reader, version);
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
                checkPointStatus = templateLangString('MENU_TEXT', 'CHECKPOINT_ACTIVE', {
                    xp: numberWithCommas(checkpointXP),
                });
            } else {
                checkPointStatus = templateLangString('MENU_TEXT', 'XP_REMAINING', {
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

