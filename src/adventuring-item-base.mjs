const { loadModule } = mod.getContext(import.meta);

const { AdventuringItemBaseUIComponent } = await loadModule('src/components/adventuring-item-base.mjs');

const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');

class AdventuringItemBaseRenderQueue {
    constructor(){
        this.tooltip = false;
        this.icon = false;
        this.upgrade = false;
        this.selected = false;
        this.highlight = false;
        this.equipped = false;
    }
    updateAll() {
        this.tooltip = true;
        this.icon = true;
        this.upgrade = true;
        this.selected = true;
        this.highlight = true;
        this.equipped = true;
    }
}

export class AdventuringItemBase extends MasteryAction {
    constructor(namespace, data, manager, game) {
        super(namespace, data, game);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._media = data.media;

        if(data.scaling !== undefined)
            this._scaling = data.scaling;
        if(data.base !== undefined)
            this._base = data.base;

        this.scaling = new AdventuringStats(this.manager, this.game);
        this.base = new AdventuringStats(this.manager, this.game);
        this.stats = new AdventuringStats(this.manager, this.game);

        this.component = new AdventuringItemBaseUIComponent(this.manager, this.game, this);
        this.renderQueue = new AdventuringItemBaseRenderQueue();

        if(data.materials !== undefined) {
            this._materials = data.materials;
            this.materials = new Map();
        }

        this._type = data.type;
        this.maxUpgrades = 12;
        this.selected = false;
        this.highlight = false;

        this.component.clickable.onclick = () => {
            this.slotClicked();
        }
    }

    onLoad() {
        this.calculateStats();
        this.renderQueue.tooltip = true;
        this.renderQueue.icon = true;
        this.renderQueue.upgrade = true;
        this.renderQueue.selected = true;
        this.renderQueue.highlight = true;
        this.renderQueue.equipped = true;
    }

    postDataRegistration() {
        if(this._base !== undefined) {
            this._base.forEach(({ id, value }) => {
                this.base.set(id, value);
            });
            delete this._base;
        }

        if(this._scaling !== undefined) {
            this._scaling.forEach(({ id, value }) => {
                this.scaling.set(id, value);
            });
            delete this._scaling;
        }

        if(this._materials !== undefined) {
            this._materials.forEach(({ id, qty }) => {
                let material = this.manager.materials.getObjectByID(id);
                if(material !== undefined)
                    this.materials.set(material, qty);
            });
            delete this._materials;
        }

        if(this._type !== undefined) {
            this.type = this.manager.itemTypes.getObjectByID(this._type);
            delete this._type;
        }
    }

    calculateStats() {
        this.stats.reset();

        this.base.forEach((value, stat) => this.stats.set(stat, value));
        this.scaling.forEach((value, stat) => this.stats.set(stat, this.stats.get(stat) + Math.floor(this.level * value)));
    }

    get tooltip() {
        let html = '<div>';

        html += `<div><span>${this.name}</span></div>`;
        if(this.unlocked) {
            let empty = `<i class="far fa-star"></i>`;
            let solid = `<i class="fa fa-star"></i>`;
            let half = `<i class="fa fa-star-half-alt"></i>`;
    
            let starCount = Math.floor(this.upgradeLevel / 2);
            let halfStarCount = this.upgradeLevel % 2;
            let emptyStarCount = ((this.maxUpgrades/2) - (starCount + halfStarCount));
            let stars = [...new Array(starCount).fill(solid), ...new Array(halfStarCount).fill(half), ...new Array(emptyStarCount).fill(empty)];

            html += `<div><small>${stars.join('')}</small></div>`;
            
            if(this.upgradeLevel > 0) {
                let { xp, level, percent, nextLevelXP } = this.manager.getMasteryProgress(this);
                html += `<div><small>Level ${level} / ${this.levelCap}</small></div>`;
                if(this.level < this.levelCap)
                    html += `<div><small>${xp} / ${nextLevelXP} XP</small></div>`;
            }

            this.stats.forEach((value, stat) => {
                let statImg = `<img class="skill-icon-xxs" style="height: .66rem; width: .66rem; margin-top: 0;" src="${stat.media}">`
                html += `<div><small>+${value}${statImg}</small></div>`;
            });

            //html += `</br><div><small>${this.type.name}</small></div>`;

            let validJobs = this.jobs.filter(job => job.id !== "adventuring:none");
            if(validJobs.length > 0) {
                html += `<div><small>Usable By: `;
                let jobList = validJobs.map(job => job.name).join(', ');
                if(this.jobs.length == this.manager.jobs.size)
                    jobList = "Any";
                html += `${jobList}</small></div>`;
            }
        }

        if(this.materials !== undefined) {
            let upgradeOrUnlock = (this.upgradeLevel === 0 ? 'Unlock': 'Upgrade');
            html += `<div><small>${upgradeOrUnlock} Cost: </small>`
            this.materials.forEach((amount, material) => {
                let statImg = `<img class="skill-icon-xxs" style="height: .66rem; width: .66rem; margin-top: 0;" src="${material.media}">`
                html += `<small>${this.getCost(material)}${statImg}</small>`;
            });
            html += `</div>`;
        }
        html += '</div>'
        return html;
    }

    get name() {
        return this.unlocked ? this._name : "???";
    }

    get media() {
        return this.unlocked ? this.getMediaURL(this._media) : this.getMediaURL('melvor:assets/media/main/question.svg');
    }

    get level() {
        return this.manager.getMasteryLevel(this);
    }

    get levelCap() {
        return this.upgradeLevel * 10;
    }

    get upgradeLevel() {
        return this.manager.armory.upgradeLevels.get(this);
    }

    get unlocked() {
        return this.manager.armory.unlocked.get(this) === true;
    }

    get upgradeable() {
        if(this.upgradeLevel >= this.maxUpgrades)
            return false;
        for(let material of this.materials.keys()) {
            if(this.getCost(material) > this.manager.stash.materialCounts.get(material))
                return false;
        }
        return true;
    }

    get equipped() {
        for(let member of this.manager.party.all) {
            for(let slot of this.slots) {
                let equipmentSlot = member.equipment.slots.get(slot);
                if(equipmentSlot.item === this)
                    return true;
            }
        }
        return false;
    }

    get currentSlot() {
        for(let member of this.manager.party.all) {
            for(let slot of this.slots) {
                let equipmentSlot = member.equipment.slots.get(slot);
                if(equipmentSlot.item === this)
                    return equipmentSlot;
            }
        }
    }

    get jobs() {
        let jobs = this.manager.jobs.allObjects.filter(job => job.allowedItems !== undefined && job.allowedItems.includes(this.type));
        return jobs;
    }

    get slots() {
        let slots = [];
        if(this.type.slots !== undefined)
            slots = this.type.slots.map(slotType => this.manager.itemSlots.getObjectByID(slotType));
        return slots;
    }

    get occupies() {
        let occupies = [];
        if(this.type.occupies !== undefined)
            occupies = this.type.occupies.map(slotType => this.manager.itemSlots.getObjectByID(slotType));
        return occupies;
    }

    get pairs() {
        let pairs = [];
        if(this.type.pairs !== undefined)
            pairs = this.type.pairs.map(pair => this.manager.itemTypes.getObjectByID(pair))
        return pairs;
    }

    getCost(material) {
        let amount = this.materials.get(material);
        return amount !== undefined ? Math.pow(5, this.upgradeLevel) * amount : 0;
    }

    addXP(xp) {
        let { currentXP, level, percent, nextLevelXP } = this.manager.getMasteryProgress(this);
        if(level < this.levelCap) {
            this.manager.addMasteryXP(this, xp);
            this.manager.addMasteryPoolXP(xp);
        }
        this.renderQueue.tooltip = true;
        this.manager.party.all.forEach(member => member.equipment.slots.forEach(equipmentSlot => {
            equipmentSlot.renderQueue.icon = true;
            equipmentSlot.renderQueue.upgrade = true;
        }));
    }

    slotClicked() {
        if(!this.manager.armory.active)
            return;

        if(!this.unlocked)
            return;

        if(this.manager.armory.selectedItem !== undefined) {
            if(this.manager.armory.selectedItem === this) {
                if(this.manager.armory.selectedItem.currentSlot !== undefined)
                    this.manager.armory.selectedItem.currentSlot.setEmpty();
                this.manager.armory.clearSelected();
            } else {
                this.manager.armory.selectItem(this);
            }
        } else {
            this.manager.armory.selectItem(this);
        }

        this.manager.party.all.forEach(member => member.calculateStats());
    }

    setSelected(selected) {
        this.selected = selected;
        this.renderQueue.selected = true;
        this.renderQueue.highlight = true;
        this.renderQueue.equipped = true;
    }

    setHighlight(highlight) {
        this.highlight = highlight;
        this.renderQueue.highlight = true;
        this.renderQueue.selected = true;
        this.renderQueue.equipped = true;
    }

    render() {
        this.renderTooltip();
        this.renderIcon();
        this.renderUpgrade();
        this.renderSelected();
        this.renderHighlight();
        this.renderEquipped();
    }

    renderTooltip() {
        if(!this.renderQueue.tooltip)
            return;

        this.component.tooltip.setContent(this.tooltip);

        this.renderQueue.tooltip = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        this.component.icon.src = this.media;
        this.component.lock.classList.toggle('invisible', !this.unlocked || this.upgradeLevel > 0);

        this.renderQueue.icon = false;
    }

    renderSelected() {
        if(!this.renderQueue.selected)
            return;

        this.component.border.classList.toggle('border-success', this.selected);

        this.renderQueue.selected = false;
    }

    renderHighlight() {
        if(!this.renderQueue.highlight)
            return;

        this.component.border.classList.toggle('border-warning', this.highlight && !this.selected);

        this.renderQueue.highlight = false;
    }

    renderUpgrade() {
        if(!this.renderQueue.upgrade)
            return;

        this.component.upgrade.classList.toggle('d-none', this.upgradeLevel === 0);
        this.component.upgrade.textContent = this.level;

        this.renderQueue.upgrade = false;
    }

    renderEquipped() {
        if(!this.renderQueue.equipped)
            return;

        this.component.border.classList.toggle('opacity-40', this.equipped && !(this.selected || this.highlight));
        this.component.icon.classList.toggle('opacity-40', this.equipped && (this.selected || this.highlight));

        this.renderQueue.equipped = false;
    }
}