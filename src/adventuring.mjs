const { loadModule } = mod.getContext(import.meta);

const { AdventuringEquipmentItem } = await loadModule('src/adventuring-equipment-item.mjs');

const { AdventuringJob } = await loadModule('src/adventuring-job.mjs');
const { AdventuringGenerator } = await loadModule('src/adventuring-generator.mjs');
const { AdventuringSpender } = await loadModule('src/adventuring-spender.mjs');
const { AdventuringPassive } = await loadModule('src/adventuring-passive.mjs');
const { AdventuringArea } = await loadModule('src/adventuring-area.mjs');
const { AdventuringMonster } = await loadModule('src/adventuring-monster.mjs');
const { AdventuringSuffix } = await loadModule('src/adventuring-suffix.mjs');

const { AdventuringOverview } = await loadModule('src/adventuring-overview.mjs');
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

const { AdventuringItemMaterial } = await loadModule('src/adventuring-item-material.mjs');
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

        this.jobs = new NamespaceRegistry(this.game.registeredNamespaces);
        this.generators = new NamespaceRegistry(this.game.registeredNamespaces);
        this.spenders = new NamespaceRegistry(this.game.registeredNamespaces);
        this.passives = new NamespaceRegistry(this.game.registeredNamespaces);
        this.areas = new NamespaceRegistry(this.game.registeredNamespaces);
        this.monsters = new NamespaceRegistry(this.game.registeredNamespaces);
        this.suffixes = new NamespaceRegistry(this.game.registeredNamespaces);

        this.itemMaterials = new NamespaceRegistry(this.game.registeredNamespaces);
        this.itemTypes = new NamespaceRegistry(this.game.registeredNamespaces);
        this.itemPools = new NamespaceRegistry(this.game.registeredNamespaces);
        this.itemTiers = new NamespaceRegistry(this.game.registeredNamespaces);
        this.baseItems = new NamespaceRegistry(this.game.registeredNamespaces);

        this.component = new AdventuringPageUIComponent(this, this.game);

        this.overview = new AdventuringOverview(this, this.game);
        this.overview.component.mount(this.component.overview);

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
        
        this.turnTimer = new Timer('Turn', () => this.nextTurn());
        this.turnInterval = 1500;

        this.healTimer = new Timer('Heal', () => this.nextHeal());
        this.healInterval = 5000;
    }

    onLoad() {
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
            member.calculateLevels();
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

        if(!this.turnTimer.isActive)
            this.turnTimer.start(this.turnInterval);
        
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
        
        if(this.turnTimer.isActive)
            this.turnTimer.stop();

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
        this.turnTimer.tick();
    }

    passiveTick() {
        if(this.isActive)
            return;
        
        this.party.all.forEach(member => {
            if(member.energy > 0)
                member.setEnergy(0);
        });

        if(!this.healTimer.isActive && this.party.all.some(member => member.dead || member.hitpoints < member.maxHitpoints)) {
            this.healTimer.start(this.healInterval);
        
            this.overview.renderQueue.turnProgressBar = true;
            this.overview.renderQueue.healProgressBar = true;
        }

        if(this.healTimer.isActive && this.party.all.every(member => !member.dead && member.hitpoints == member.maxHitpoints)) {
            this.healTimer.stop();
        
            this.overview.renderQueue.turnProgressBar = true;
            this.overview.renderQueue.healProgressBar = true;
        }
        
        if(this.healTimer.isActive)
            this.healTimer.tick();
    }

    nextTurn() {
        if(!this.isActive)
            return;
        
        this.dungeon.nextTurn();

        this.turnTimer.start(this.turnInterval);
        this.overview.renderQueue.turnProgressBar = true;
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
        super.render();
        
        this.overview.render();

        this.party.render();

        this.pages.render();
    }

    registerData(namespace, data) {
        super.registerData(namespace, data); // pets, rareDrops, minibar, customMilestones

        data.jobs.forEach(data => {
            let job = new AdventuringJob(namespace, data, this, this.game);
            this.jobs.registerObject(job);
            this.actions.registerObject(job);
        });
        data.generators.forEach(data => {
            let generator = new AdventuringGenerator(namespace, data, this, this.game);
            this.generators.registerObject(generator);
        });
        data.spenders.forEach(data => {
            let spender = new AdventuringSpender(namespace, data, this, this.game);
            this.spenders.registerObject(spender);
        });
        data.passives.forEach(data => {
            let passive = new AdventuringPassive(namespace, data, this, this.game);
            this.passives.registerObject(passive);
        });
        data.areas.forEach(data => {
            let area = new AdventuringArea(namespace, data, this, this.game);
            this.areas.registerObject(area);
        });
        data.monsters.forEach(data => {
            let monster = new AdventuringMonster(namespace, data, this, this.game);
            this.monsters.registerObject(monster);
        });

        data.itemMaterials.forEach(data => {
            let material = new AdventuringItemMaterial(namespace, data, this, this.game);
            this.itemMaterials.registerObject(material);
        });

        data.itemTypes.forEach(data => {
            let itemType = new AdventuringItemType(namespace, data, this, this.game);
            this.itemTypes.registerObject(itemType);
        });

        data.itemPools.forEach(data => {
            let pool = new AdventuringItemPool(namespace, data, this, this.game);
            this.itemPools.registerObject(pool);
        });

        data.itemTiers.forEach(data => {
            let itemTier = new AdventuringItemTier(namespace, data, this, this.game);
            this.itemTiers.registerObject(itemTier);
        });

        data.baseItems.forEach(data => {
            let item = new AdventuringItemBase(namespace, data, this, this.game);
            this.baseItems.registerObject(item);
        });

        data.suffixes.forEach(data => {
            let suffix = new AdventuringSuffix(namespace, data, this, this.game);
            this.suffixes.registerObject(suffix);
        });
    }

    canJobHaveMultiple(job) {
        return job.alwaysMultiple || this.getMasteryLevel(job) >= 99;
    }

    get availableJobs() {
        return this.jobs.allObjects.filter(job => this.canJobHaveMultiple(job) || !this.party.all.map(member => member.job).includes(job));
    }

    postDataRegistration() {
        super.postDataRegistration(); // Milestones setLevel

        let jobMilestones = this.jobs.allObjects.filter(job => job.isMilestoneReward);
        let areaMilestones = this.areas.allObjects;

        this.milestones.push(...jobMilestones, ...areaMilestones);
        this.sortMilestones();
        
        this.sortedMasteryActions = jobMilestones.sort((a,b)=> a.level - b.level);

        this.trainer.postDataRegistration();
        this.stash.postDataRegistration();
        this.crossroads.postDataRegistration();
    }

    encode(writer) {
        //let pre = writer.byteOffset;
        super.encode(writer); // Encode default skill data
        writer.writeUint32(this.version); // Store current skill version

        this.party.encode(writer);
        this.stash.encode(writer);
        this.dungeon.encode(writer);
        this.encounter.encode(writer);
        this.turnTimer.encode(writer);
        writer.writeBoolean(this.isActive);

        //let post = writer.byteOffset;
        //console.log(`Wrote ${post-pre} bytes for Adventuring save`);
        return writer;
    }

    decode(reader, version) {
        //let pre = reader.byteOffset;
        super.decode(reader, version); // Decode default skill data
        this.saveVersion = reader.getUint32(); // Read save skill version

        this.party.decode(reader, version);
        this.stash.decode(reader, version);
        this.dungeon.decode(reader, version);
        this.encounter.decode(reader, version);
        this.turnTimer.decode(reader, version);
        this.isActive = reader.getBoolean();

        //let post = reader.byteOffset;
        //console.log(`Read ${post-pre} bytes for Adventuring save`);
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

