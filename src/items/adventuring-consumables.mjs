const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringConsumablesElement } = await loadModule('src/items/components/adventuring-consumables.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { evaluateCondition } = await loadModule('src/core/adventuring-utils.mjs');

const MAX_EQUIPPED_CONSUMABLES = 3;

class AdventuringConsumablesRenderQueue {
    constructor() {
        this.slots = false;
        this.details = false;
        this.list = false;
    }
    updateAll() {
        this.slots = true;
        this.details = true;
        this.list = true;
    }
}

/**
 * Manager for consumables with tier-based charge tracking.
 * 
 * Charge storage: Map<consumable, Map<tier, count>>
 * Equipped storage: Array of { consumable, tier } objects
 * 
 * Only one tier of a consumable can be equipped at a time.
 */
export class AdventuringConsumables extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;

        this.component = createElement('adventuring-consumables');
        this.renderQueue = new AdventuringConsumablesRenderQueue();

        // Charges: Map<Consumable, Map<tier, count>>
        this.charges = new Map();
        
        // Equipped: Array of { consumable, tier } (max 3)
        this.equipped = [];
        
        // Track once-per-run consumables
        this.usedThisRun = new Set();

        this.consumables = [];
        this.selectedConsumable = undefined;
        this.selectedTier = 1; // Currently selected tier for viewing/equipping

        this.component.back.onclick = () => this.back();
        this.component.equipButton.onclick = () => this.toggleEquipSelected();
        
        // Set up tier button click handlers
        for (let i = 0; i < 4; i++) {
            const tier = i + 1;
            this.component.tierButtonElements[i].onclick = () => this.selectTier(tier);
        }
    }

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
        // Allow interaction while viewing consumables
    }

    onHide() {
        super.onHide();
    }

    postDataRegistration() {
        this.consumables = this.manager.consumableTypes.allObjects;

        // Group consumables by source job
        const consumablesByJob = new Map();
        this.consumables.forEach(consumable => {
            const job = consumable.sourceJob;
            if (!job) return;
            if (!consumablesByJob.has(job)) {
                consumablesByJob.set(job, []);
            }
            consumablesByJob.get(job).push(consumable);
        });
        
        // Create sections for each job
        consumablesByJob.forEach((jobConsumables, job) => {
            // Create section container
            const section = document.createElement('div');
            section.className = 'mb-3';
            
            // Create simple header
            const header = document.createElement('h6');
            header.className = 'font-w600 text-muted mb-2';
            header.textContent = job.name;
            
            // Create content container
            const content = document.createElement('div');
            content.className = 'row no-gutters';
            
            // Mount consumables into this section
            jobConsumables.forEach(consumable => {
                consumable.component.mount(content);
                consumable.component.clickable.onclick = () => this.selectConsumable(consumable);
            });
            
            section.appendChild(header);
            section.appendChild(content);
            this.component.jobSections.appendChild(section);
        });

        // Setup slot click handlers for unequipping
        for (let i = 0; i < MAX_EQUIPPED_CONSUMABLES; i++) {
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
    
    // =========================================
    // Selection & UI
    // =========================================

    /**
     * Select a consumable to view in the details panel
     */
    selectConsumable(consumable, tier = 1) {
        this.selectedConsumable = consumable;
        this.selectedTier = tier;
        this.renderQueue.details = true;
        this.render();
    }

    /**
     * Select a specific tier of the currently selected consumable
     */
    selectTier(tier) {
        this.selectedTier = tier;
        this.updateTierButtonStates();
        this.renderQueue.details = true;
        this.render();
    }
    
    /**
     * Update visual state of tier buttons
     */
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

    /**
     * Toggle equip/unequip for the selected consumable at the selected tier
     */
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

    // =========================================
    // Charge Management (Tier-based)
    // =========================================

    /**
     * Get charge count for a consumable at a specific tier
     */
    getCharges(consumable, tier) {
        const tierMap = this.charges.get(consumable);
        if (!tierMap) return 0;
        return tierMap.get(tier) || 0;
    }

    /**
     * Get total charges across all tiers for a consumable
     */
    getTotalCharges(consumable) {
        const tierMap = this.charges.get(consumable);
        if (!tierMap) return 0;
        let total = 0;
        for (const count of tierMap.values()) {
            total += count;
        }
        return total;
    }

    /**
     * Add charges to a consumable at a specific tier
     */
    addCharges(consumable, tier, amount) {
        let tierMap = this.charges.get(consumable);
        if (!tierMap) {
            tierMap = new Map();
            this.charges.set(consumable, tierMap);
        }
        
        const current = tierMap.get(tier) || 0;
        tierMap.set(tier, current + amount);
        
        consumable.renderQueue.updateAll();
        
        // Invalidate effect cache if this consumable is equipped at this tier
        const equipped = this.getEquippedEntry(consumable);
        if (equipped && equipped.tier === tier) {
            this.invalidateAllHeroEffects();
        }
        
        this.renderQueue.slots = true;
        this.manager.overview.renderQueue.buffs = true;
    }

    /**
     * Remove charges from a consumable at a specific tier
     */
    removeCharges(consumable, tier, amount) {
        const tierMap = this.charges.get(consumable);
        if (!tierMap) return;
        
        const current = tierMap.get(tier) || 0;
        const newCharges = Math.max(current - amount, 0);
        tierMap.set(tier, newCharges);
        
        consumable.renderQueue.updateAll();

        // Auto-unequip if no charges left and this tier is equipped
        const equipped = this.getEquippedEntry(consumable);
        if (newCharges <= 0 && equipped && equipped.tier === tier) {
            this.unequip(consumable);
        } else if (equipped && equipped.tier === tier) {
            this.invalidateAllHeroEffects();
        }
        
        this.renderQueue.slots = true;
    }

    /**
     * Invalidate effect cache for all heroes
     */
    invalidateAllHeroEffects() {
        if (this.manager.party) {
            this.manager.party.all.forEach(hero => {
                if (hero.effectCache) {
                    hero.invalidateEffects('consumables');
                }
            });
        }
    }

    // =========================================
    // Equipment Management
    // =========================================

    /**
     * Get the equipped entry for a consumable
     * @returns {{ consumable, tier } | undefined}
     */
    getEquippedEntry(consumable) {
        return this.equipped.find(e => e.consumable === consumable);
    }

    /**
     * Check if a consumable is equipped (any tier)
     */
    isEquipped(consumable) {
        return this.getEquippedEntry(consumable) !== undefined;
    }

    /**
     * Get the equipped tier for a consumable (0 if not equipped)
     */
    getEquippedTier(consumable) {
        const entry = this.getEquippedEntry(consumable);
        return entry ? entry.tier : 0;
    }

    /**
     * Equip a consumable at a specific tier
     */
    equip(consumable, tier) {
        if (this.equipped.length >= MAX_EQUIPPED_CONSUMABLES) {
            this.manager.log.add(`Cannot equip more than ${MAX_EQUIPPED_CONSUMABLES} consumables.`);
            return false;
        }
        
        // Check if already equipped
        if (this.isEquipped(consumable)) {
            // If equipped at a different tier, unequip first
            const entry = this.getEquippedEntry(consumable);
            if (entry.tier !== tier) {
                this.unequip(consumable);
            } else {
                return false; // Already equipped at this tier
            }
        }
        
        // Check charges
        if (this.getCharges(consumable, tier) <= 0) {
            this.manager.log.add(`${consumable.getTierName(tier)} has no charges.`);
            return false;
        }

        this.equipped.push({ consumable, tier });
        consumable.renderQueue.equipped = true;
        this.renderQueue.slots = true;
        this.manager.overview.renderQueue.buffs = true;
        this.manager.log.add(`Equipped ${consumable.getTierName(tier)}`);
        
        this.invalidateAllHeroEffects();
        return true;
    }

    /**
     * Unequip a consumable
     */
    unequip(consumable) {
        const index = this.equipped.findIndex(e => e.consumable === consumable);
        if (index === -1) return false;

        const entry = this.equipped[index];
        this.equipped.splice(index, 1);
        consumable.renderQueue.equipped = true;
        this.renderQueue.slots = true;
        this.manager.overview.renderQueue.buffs = true;
        
        this.invalidateAllHeroEffects();
        return true;
    }

    // =========================================
    // Effects
    // =========================================

    /**
     * Get all effects from equipped consumables with passive triggers.
     * @returns {StandardEffect[]} Array of standardized effects
     */
    getEffects() {
        const effects = [];
        
        for (const { consumable, tier } of this.equipped) {
            if (this.getCharges(consumable, tier) > 0) {
                const tierEffects = consumable.getTierEffects(tier);
                const passiveEffects = tierEffects.filter(e => e.trigger === 'passive');
                effects.push(...passiveEffects);
            }
        }
        
        return effects;
    }

    /**
     * Trigger consumable effects for a specific trigger type.
     * @param {string} triggerType - The trigger type (e.g., 'on_hit', 'after_damage_dealt')
     * @param {Object} context - Context object with character, target, party, manager
     * @returns {Array<{consumable, tier, effect, amount, chance}>}
     */
    trigger(triggerType, context = {}) {
        const results = [];
        
        for (const { consumable, tier } of this.equipped) {
            if (this.getCharges(consumable, tier) <= 0) continue;
            
            const tierEffects = consumable.getTierEffects(tier);
            for (const effect of tierEffects) {
                if (effect.trigger !== triggerType) continue;
                
                // Check condition if present
                if (effect.condition) {
                    if (!evaluateCondition(effect.condition, context)) continue;
                }
                
                results.push({
                    consumable: consumable,
                    tier: tier,
                    effect: effect,
                    amount: effect.amount || 0,
                    chance: effect.chance || 100
                });
            }
        }
        
        return results;
    }

    // =========================================
    // Dungeon Lifecycle
    // =========================================

    onDungeonStart() {
        this.usedThisRun.clear();
    }

    onDungeonEnd() {
        const preserveChance = this.manager.modifiers.getConsumablePreservationChance();

        // Consume charges from equipped consumables that have consume_at_run_end effects
        for (const { consumable, tier } of [...this.equipped]) {
            const tierEffects = consumable.getTierEffects(tier);
            const hasRunEndConsumption = tierEffects.some(e => e.consume_at_run_end);
            
            if (hasRunEndConsumption) {
                if (preserveChance > 0 && Math.random() < preserveChance) {
                    this.manager.log.add(`${consumable.getTierName(tier)} preserved!`);
                } else {
                    consumable.useCharge();
                }
            }
        }
        
        this.manager.tavern.consumeCharges();
        this.usedThisRun.clear();
    }

    onFloorStart() {
        for (const { consumable, tier } of this.equipped) {
            const tierEffects = consumable.getTierEffects(tier);
            for (const effect of tierEffects) {
                if (effect.trigger === 'floor_start') {
                    if (effect.only_if_injured) {
                        const anyoneInjured = this.manager.party.all.some(m => !m.dead && m.hitpoints < m.stats.maxHitpoints);
                        if (!anyoneInjured) continue;
                    }
                    this.applyEffect(consumable, tier, effect);
                }
            }
        }
    }

    onEncounterStart() {
        for (const { consumable, tier } of this.equipped) {
            const tierEffects = consumable.getTierEffects(tier);
            for (const effect of tierEffects) {
                if (effect.trigger === 'encounter_start') {
                    this.applyEffect(consumable, tier, effect);
                }
            }
        }
    }

    onCharacterDamaged(member) {
        if (member.dead) return false;
        
        const hpPercent = member.hitpoints / member.stats.maxHitpoints;
        
        for (const { consumable, tier } of this.equipped) {
            const tierEffects = consumable.getTierEffects(tier);
            for (const effect of tierEffects) {
                if (effect.trigger === 'on_damage' && effect.type === 'heal_on_low_hp') {
                    if (hpPercent < effect.threshold / 100) {
                        member.heal({ amount: effect.healAmount });
                        this.manager.log.add(`${consumable.getTierName(tier)} healed ${member.name} for ${effect.healAmount} HP!`);
                        consumable.useCharge();
                        return true;
                    }
                }
            }
        }
        return false;
    }

    onPartyWipe() {
        const allDead = this.manager.party.all.every(member => member.dead);
        if (!allDead) return false;
        
        for (const { consumable, tier } of this.equipped) {
            const tierEffects = consumable.getTierEffects(tier);
            for (const effect of tierEffects) {
                if (effect.trigger === 'party_wipe' && effect.type === 'revive_all') {
                    if (effect.once_per_run && this.usedThisRun.has(consumable.id)) {
                        continue;
                    }
                    
                    const amount = effect.amount;
                    this.manager.party.all.forEach(member => {
                        if (member.dead) {
                            member.revive({ amount });
                        }
                    });

                    this.usedThisRun.add(consumable.id);
                    this.manager.log.add(`${consumable.getTierName(tier)} revived the party!`);
                    return true;
                }
            }
        }
        return false;
    }

    applyEffect(consumable, tier, effect) {
        const tierName = consumable.getTierName(tier);
        
        switch (effect.type) {
            case 'heal_percent':
                this.manager.party.all.forEach(member => {
                    if (!member.dead) {
                        const healAmount = Math.floor(member.stats.maxHitpoints * effect.amount / 100);
                        member.heal({ amount: healAmount });
                    }
                });
                break;
            case 'buff_damage':
                this.manager.party.alive.forEach(member => {
                    member.buff('adventuring:consumable_damage', { amount: effect.amount }, member);
                });
                this.manager.log.add(`${tierName} grants +${effect.amount}% damage to the party!`);
                break;
            case 'buff_defense':
                this.manager.party.alive.forEach(member => {
                    member.buff('adventuring:fortify', { amount: effect.amount }, member);
                });
                this.manager.log.add(`${tierName} grants +${effect.amount}% damage reduction to the party!`);
                break;
            case 'buff_speed':
                this.manager.party.alive.forEach(member => {
                    member.buff('adventuring:haste', { amount: effect.amount }, member);
                });
                this.manager.log.add(`${tierName} grants +${effect.amount}% speed to the party!`);
                break;
        }
    }

    // =========================================
    // Rendering
    // =========================================

    render() {
        this.consumables.forEach(c => c.render());
        this.renderSlots();
        this.renderDetails();
    }

    renderSlots() {
        if (!this.renderQueue.slots) return;

        for (let i = 0; i < MAX_EQUIPPED_CONSUMABLES; i++) {
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
        
        // Basic info for selected tier
        this.component.detailIcon.src = consumable.getTierMedia(tier);
        this.component.detailName.textContent = consumable.getTierName(tier);
        this.component.detailDescription.textContent = consumable.getTierDescription(tier);
        
        // Effects
        this.component.detailEffects.innerHTML = '';
        const effectText = consumable.getTierEffectText(tier);
        if (effectText) {
            const effectDiv = document.createElement('div');
            effectDiv.className = 'text-success';
            effectDiv.textContent = effectText;
            this.component.detailEffects.appendChild(effectDiv);
        }
        
        // Charges for this tier
        this.component.detailCharges.textContent = `${this.getCharges(consumable, tier)}`;
        
        // Equip button
        const equippedTier = this.getEquippedTier(consumable);
        if (equippedTier === tier) {
            this.component.equipButton.textContent = 'Unequip';
            this.component.equipButton.className = 'btn btn-warning';
            this.component.equipButton.disabled = false;
        } else if (equippedTier > 0) {
            // Equipped at different tier
            this.component.equipButton.textContent = `Switch to Tier ${tier}`;
            this.component.equipButton.className = 'btn btn-info';
            this.component.equipButton.disabled = this.getCharges(consumable, tier) <= 0;
        } else if (this.getCharges(consumable, tier) <= 0) {
            this.component.equipButton.textContent = 'Equip';
            this.component.equipButton.className = 'btn btn-secondary';
            this.component.equipButton.disabled = true;
        } else if (this.equipped.length >= MAX_EQUIPPED_CONSUMABLES) {
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

    // =========================================
    // Save/Load
    // =========================================

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
        // Encode charges: Map<Consumable, Map<tier, count>>
        writer.writeUint16(this.charges.size);
        for (const [consumable, tierMap] of this.charges) {
            writer.writeNamespacedObject(consumable);
            writer.writeUint8(tierMap.size);
            for (const [tier, count] of tierMap) {
                writer.writeUint8(tier);
                writer.writeUint16(count);
            }
        }
        
        // Encode equipped: Array of { consumable, tier }
        writer.writeArray(this.equipped, (entry, writer) => {
            writer.writeNamespacedObject(entry.consumable);
            writer.writeUint8(entry.tier);
        });
        
        return writer;
    }

    decode(reader, version) {
        // Decode charges
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
                // Skip invalid consumable's tier data
                for (let j = 0; j < numTiers; j++) {
                    reader.getUint8();
                    reader.getUint16();
                }
            }
        }
        
        // Decode equipped
        this.equipped = reader.getArray((reader) => {
            const consumable = reader.getNamespacedObject(this.manager.consumableTypes);
            const tier = reader.getUint8();
            return { consumable, tier };
        }).filter(e => typeof e.consumable !== "string" && e.consumable && this.getCharges(e.consumable, e.tier) > 0);
    }
}

export { MAX_EQUIPPED_CONSUMABLES };
