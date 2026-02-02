const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringConsumablesElement } = await loadModule('src/items/components/adventuring-consumables.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { evaluateCondition } = await loadModule('src/core/effects/condition-evaluator.mjs');
const { createEffect, filterEffects } = await loadModule('src/core/utils/adventuring-utils.mjs');
const { AdventuringCategorySectionElement } = await loadModule('src/ui/components/adventuring-category-section.mjs');

class AdventuringConsumablesRenderQueue {
    constructor() {
        this.slots = false;
        this.details = false;
        this.list = false;
    }
    queueAll() {
        this.slots = true;
        this.details = true;
        this.list = true;
    }
    updateAll() {
        this.queueAll();
    }
}

export class AdventuringConsumables extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;

        this.component = createElement('adventuring-consumables');
        this.renderQueue = new AdventuringConsumablesRenderQueue();

        this.charges = new Map();

        this.equipped = [];

        this.usedThisRun = new Set();

        this.consumables = [];
        this.selectedConsumable = undefined;
        this.selectedTier = 1; // Currently selected tier for viewing/equipping

        this.component.back.onclick = () => this.back();
        this.component.equipButton.onclick = () => this.toggleEquipSelected();

        for (let i = 0; i < 4; i++) {
            const tier = i + 1;
            this.component.tierButtonElements[i].onclick = () => this.selectTier(tier);
        }

        // Listen for dungeon lifecycle events
        this.manager.conductor.listen('dungeon_start', () => this._onDungeonStart());
        this.manager.conductor.listen('dungeon_end', () => this._onDungeonEnd());
    }

    get maxEquipped() { return this.manager.config.limits.maxEquippedConsumables; }

    back() {
        if (this.active) {
            this.manager.town.setBuilding(undefined);
        }
    }

    get active() {
        return super.active;
    }

    onLoad() {
        super.onLoad();
        this.renderQueue.list = true;
    }

    onShow() {

    }

    onHide() {
        super.onHide();
    }

    postDataRegistration() {
        this.consumables = this.manager.consumableTypes.allObjects;

        const consumablesByJob = new Map();
        this.consumables.forEach(consumable => {
            const job = consumable.sourceJob;
            if (!job) return;
            if (!consumablesByJob.has(job)) {
                consumablesByJob.set(job, []);
            }
            consumablesByJob.get(job).push(consumable);
        });

        consumablesByJob.forEach((jobConsumables, job) => {

            const section = new AdventuringCategorySectionElement();
            section.setSection({ title: job.name });

            const content = section.getContent();
            content.className = 'row no-gutters';

            jobConsumables.forEach(consumable => {
                consumable.component.mount(content);
                consumable.component.clickable.onclick = () => this.selectConsumable(consumable);
            });

            this.component.jobSections.appendChild(section);
        });

        for (let i = 0; i < this.maxEquipped; i++) {
            const slot = this.component.slots[i];
            if (slot) {
                slot.onclick = () => {
                    if (this.equipped[i]) {
                        this.unequip(this.equipped[i].consumable);
                    }
                };
            }
        }
    }




    selectConsumable(consumable, tier = 1) {
        this.selectedConsumable = consumable;
        this.selectedTier = tier;
        this.renderQueue.details = true;
        this.render();
    }

    selectTier(tier) {
        this.selectedTier = tier;
        this.updateTierButtonStates();
        this.renderQueue.details = true;
        this.render();
    }

    updateTierButtonStates() {
        for (let i = 0; i < 4; i++) {
            const btn = this.component.tierButtonElements[i];
            const tier = i + 1;
            if (tier === this.selectedTier) {
                btn.classList.remove('btn-outline-info');
                btn.classList.add('btn-info', 'active');
            } else {
                btn.classList.remove('btn-info', 'active');
                btn.classList.add('btn-outline-info');
            }
        }
    }

    toggleEquipSelected() {
        if (!this.selectedConsumable) return;

        if (this.isEquipped(this.selectedConsumable)) {
            this.unequip(this.selectedConsumable);
        } else {
            this.equip(this.selectedConsumable, this.selectedTier);
        }
        this.renderQueue.details = true;
        this.render();
    }




    getCharges(consumable, tier) {
        const tierMap = this.charges.get(consumable);
        if (!tierMap) return 0;
        return tierMap.get(tier) || 0;
    }

    getTotalCharges(consumable) {
        const tierMap = this.charges.get(consumable);
        if (!tierMap) return 0;
        let total = 0;
        for (const count of tierMap.values()) {
            total += count;
        }
        return total;
    }

    addCharges(consumable, tier, amount) {
        let tierMap = this.charges.get(consumable);
        if (!tierMap) {
            tierMap = new Map();
            this.charges.set(consumable, tierMap);
        }

        const current = tierMap.get(tier) || 0;
        tierMap.set(tier, current + amount);

        consumable.renderQueue.updateAll();

        const equipped = this.getEquippedEntry(consumable);
        if (equipped && equipped.tier === tier) {
            this.manager.party.invalidateAllEffects('consumables');
        }

        this.renderQueue.slots = true;
        this.manager.overview.renderQueue.buffs = true;
    }

    resetCharges() {
        this.charges.clear();
        this.equipped = [];
        this.selectedConsumable = null;
        this.selectedTier = 1;
        this.renderQueue.updateAll();
    }

    removeCharges(consumable, tier, amount) {
        const tierMap = this.charges.get(consumable);
        if (!tierMap) return;

        const current = tierMap.get(tier) || 0;
        const newCharges = Math.max(current - amount, 0);
        tierMap.set(tier, newCharges);

        consumable.renderQueue.updateAll();

        const equipped = this.getEquippedEntry(consumable);
        if (newCharges <= 0 && equipped && equipped.tier === tier) {
            this.unequip(consumable);
        } else if (equipped && equipped.tier === tier) {
            this.manager.party.invalidateAllEffects('consumables');
            this.manager.overview.renderQueue.buffs = true;
        }

        this.renderQueue.slots = true;
    }




    getEquippedEntry(consumable) {
        return this.equipped.find(e => e.consumable === consumable);
    }

    isEquipped(consumable) {
        return this.getEquippedEntry(consumable) !== undefined;
    }

    getEquippedTier(consumable) {
        const entry = this.getEquippedEntry(consumable);
        return entry ? entry.tier : 0;
    }

    equip(consumable, tier) {
        if (this.equipped.length >= this.maxEquipped) {
            this.manager.log.add(`Cannot equip more than ${this.maxEquipped} consumables.`, {
                category: 'town'
            });
            return false;
        }

        if (this.isEquipped(consumable)) {

            const entry = this.getEquippedEntry(consumable);
            if (entry.tier !== tier) {
                this.unequip(consumable);
            } else {
                return false; // Already equipped at this tier
            }
        }

        if (this.getCharges(consumable, tier) <= 0) {
            this.manager.log.add(`${consumable.getTierName(tier)} has no charges.`, {
                category: 'town'
            });
            return false;
        }

        this.equipped.push({ consumable, tier });
        consumable.renderQueue.equipped = true;
        this.renderQueue.slots = true;
        this.manager.log.add(`Equipped ${consumable.getTierName(tier)}`, {
            category: 'town'
        });

        this.manager.party.invalidateAllEffects('consumables');
        this.manager.overview.renderQueue.buffs = true;

        return true;
    }

    unequip(consumable) {
        const index = this.equipped.findIndex(e => e.consumable === consumable);
        if (index === -1) return false;

        const entry = this.equipped[index];
        this.equipped.splice(index, 1);
        consumable.renderQueue.equipped = true;
        this.renderQueue.slots = true;

        this.manager.party.invalidateAllEffects('consumables');
        this.manager.overview.renderQueue.buffs = true;

        return true;
    }




    /**
     * Get effects from equipped consumables
     * @param {Object} filters - Optional filters (trigger, party, type, etc.)
     * @returns {Array} Filtered effects with source metadata
     */
    getEffects(filters = { trigger: 'passive' }) {
        let effects = [];

        for (const { consumable, tier } of this.equipped) {
            if (this.getCharges(consumable, tier) > 0) {
                const tierEffects = consumable.getTierEffects(tier);
                // Effects already have sourcePath from consumable.postDataRegistration()
                // Just add tier for charge tracking
                for (const effect of tierEffects) {
                    effects.push({
                        ...effect,
                        sourceTier: tier
                    });
                }
            }
        }

        return filterEffects(effects, filters);
    }

    /**
     * @private Called via conductor dungeon_start event
     */
    _onDungeonStart() {
        this.usedThisRun.clear();
    }

    /**
     * @private Called via conductor dungeon_end event
     */
    _onDungeonEnd() {
        const preserveChance = this.manager.party.getConsumablePreservationChance();

        for (const { consumable, tier } of [...this.equipped]) {
            const tierEffects = consumable.getTierEffects(tier);
            const hasRunEndConsumption = tierEffects.some(e => e.consume_at_run_end);

            if (hasRunEndConsumption) {
                if (preserveChance > 0 && Math.random() < preserveChance) {
                    this.manager.log.add(`${consumable.getTierName(tier)} preserved!`, {
                        category: 'loot_items'
                    });
                } else {
                    consumable.useCharge();
                }
            }
        }

        this.usedThisRun.clear();
    }




    render() {
        this.consumables.forEach(c => c.render());
        this.renderSlots();
        this.renderDetails();
    }

    renderSlots() {
        if (!this.renderQueue.slots) return;

        for (let i = 0; i < this.maxEquipped; i++) {
            const slot = this.component.slots[i];
            const entry = this.equipped[i];

            if (slot) {
                if (entry) {
                    slot.querySelector('img').src = entry.consumable.getTierMedia(entry.tier);
                    slot.querySelector('img').classList.remove('invisible');
                    slot.classList.add('pointer-enabled');
                } else {
                    slot.querySelector('img').classList.add('invisible');
                    slot.classList.remove('pointer-enabled');
                }
            }
        }

        this.renderQueue.slots = false;
    }

    renderDetails() {
        if (!this.renderQueue.details) return;

        const consumable = this.selectedConsumable;
        const tier = this.selectedTier;

        if (!consumable) {
            this.component.hideDetails();
            this.renderQueue.details = false;
            return;
        }

        this.component.showDetails();
        this.updateTierButtonStates();

        this.component.detailIcon.src = consumable.getTierMedia(tier);
        this.component.detailName.textContent = consumable.getTierName(tier);
        this.component.detailDescription.innerHTML = consumable.getTierDescription(tier);

        this.component.detailCharges.textContent = `${this.getCharges(consumable, tier)}`;

        const equippedTier = this.getEquippedTier(consumable);
        if (equippedTier === tier) {
            this.component.equipButton.textContent = 'Unequip';
            this.component.equipButton.className = 'btn btn-warning';
            this.component.equipButton.disabled = false;
        } else if (equippedTier > 0) {

            this.component.equipButton.textContent = `Switch to Tier ${tier}`;
            this.component.equipButton.className = 'btn btn-info';
            this.component.equipButton.disabled = this.getCharges(consumable, tier) <= 0;
        } else if (this.getCharges(consumable, tier) <= 0) {
            this.component.equipButton.textContent = 'Equip';
            this.component.equipButton.className = 'btn btn-secondary';
            this.component.equipButton.disabled = true;
        } else if (this.equipped.length >= this.maxEquipped) {
            this.component.equipButton.textContent = 'Slots Full';
            this.component.equipButton.className = 'btn btn-secondary';
            this.component.equipButton.disabled = true;
        } else {
            this.component.equipButton.textContent = 'Equip';
            this.component.equipButton.className = 'btn btn-success';
            this.component.equipButton.disabled = false;
        }

        this.renderQueue.details = false;
    }




    reset() {
        this.charges.clear();
        this.equipped = [];
        this.usedThisRun.clear();
        this.selectedConsumable = undefined;
        this.selectedTier = 1;
        this.consumables.forEach(c => c.renderQueue.updateAll());
        this.renderQueue.updateAll();
    }

    encode(writer) {

        writer.writeUint16(this.charges.size);
        for (const [consumable, tierMap] of this.charges) {
            writer.writeNamespacedObject(consumable);
            writer.writeUint8(tierMap.size);
            for (const [tier, count] of tierMap) {
                writer.writeUint8(tier);
                writer.writeUint16(count);
            }
        }

        writer.writeArray(this.equipped, (entry, writer) => {
            writer.writeNamespacedObject(entry.consumable);
            writer.writeUint8(entry.tier);
        });

        return writer;
    }

    decode(reader, version) {

        this.charges.clear();
        const numConsumables = reader.getUint16();
        for (let i = 0; i < numConsumables; i++) {
            const consumable = reader.getNamespacedObject(this.manager.consumableTypes);
            const numTiers = reader.getUint8();

            if (typeof consumable !== "string" && consumable) {
                const tierMap = new Map();
                for (let j = 0; j < numTiers; j++) {
                    const tier = reader.getUint8();
                    const count = reader.getUint16();
                    tierMap.set(tier, count);
                }
                this.charges.set(consumable, tierMap);
            } else {

                for (let j = 0; j < numTiers; j++) {
                    reader.getUint8();
                    reader.getUint16();
                }
            }
        }

        this.equipped = reader.getArray((reader) => {
            const consumable = reader.getNamespacedObject(this.manager.consumableTypes);
            const tier = reader.getUint8();
            return { consumable, tier };
        }).filter(e => typeof e.consumable !== "string" && e.consumable && this.getCharges(e.consumable, e.tier) > 0);
    }
}


