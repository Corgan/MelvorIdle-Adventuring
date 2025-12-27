const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');
const { AdventuringConsumablesElement } = await loadModule('src/components/adventuring-consumables.mjs');
const { TooltipBuilder } = await loadModule('src/adventuring-tooltip.mjs');

const MAX_EQUIPPED_CONSUMABLES = 3;

class ConsumablesRenderQueue {
    constructor() {
        this.slots = false;
        this.details = false;
    }
    updateAll() {
        this.slots = true;
        this.details = true;
    }
}

export class AdventuringConsumables extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;

        this.component = createElement('adventuring-consumables');
        this.renderQueue = new ConsumablesRenderQueue();

        this.charges = new Map();           // Map<Consumable, number> - charge counts
        this.equipped = [];                 // Array of equipped consumables (max 3)
        this.usedThisRun = new Set();       // Track once-per-run consumables

        this.consumables = [];
        this.selectedConsumable = undefined;
        this.materialComponents = [];       // Reusable material components for cost display

        this.component.back.onclick = () => this.back();
        this.component.craftButton.onclick = () => this.craftSelected();
        this.component.equipButton.onclick = () => this.toggleEquipSelected();
    }

    back() {
        if(this.active) {
            this.manager.town.setBuilding(undefined);
        }
    }

    get active() {
        return super.active;
    }

    onLoad() {
        super.onLoad();
        this.renderQueue.slots = true;
    }

    onShow() {
        // Allow interaction while viewing consumables
    }

    onHide() {
        super.onHide();
    }

    postDataRegistration() {
        this.consumables = this.manager.consumableTypes.allObjects.filter(c => !c.isTavernDrink);

        // Mount consumables to the UI and set up click handlers for selection
        this.consumables.forEach(consumable => {
            consumable.component.mount(this.component.items);
            consumable.component.clickable.onclick = () => this.selectConsumable(consumable);
        });

        // Setup slot click handlers for unequipping
        for(let i = 0; i < MAX_EQUIPPED_CONSUMABLES; i++) {
            const slot = this.component.slots[i];
            if(slot) {
                slot.onclick = () => {
                    if(this.equipped[i]) {
                        this.unequip(this.equipped[i]);
                    }
                };
            }
        }
    }

    /**
     * Select a consumable to view in the details panel
     */
    selectConsumable(consumable) {
        this.selectedConsumable = consumable;
        this.renderQueue.details = true;
        this.render();
    }

    /**
     * Craft one charge of the selected consumable
     */
    craftSelected() {
        if(!this.selectedConsumable) return;
        if(this.selectedConsumable.craft()) {
            this.renderQueue.details = true;
            this.render();
        }
    }

    /**
     * Toggle equip/unequip for the selected consumable
     */
    toggleEquipSelected() {
        if(!this.selectedConsumable) return;
        if(this.isEquipped(this.selectedConsumable)) {
            this.unequip(this.selectedConsumable);
        } else {
            this.equip(this.selectedConsumable);
        }
        this.renderQueue.details = true;
        this.render();
    }

    /**
     * Get charge count for a consumable
     */
    getCharges(consumable) {
        return this.charges.get(consumable) || 0;
    }

    /**
     * Add charges to a consumable
     */
    addCharges(consumable, amount) {
        const current = this.getCharges(consumable);
        const newCharges = Math.min(current + amount, consumable.maxCharges);
        this.charges.set(consumable, newCharges);
        consumable.renderQueue.updateAll();
        
        // Invalidate effect cache if this consumable is equipped
        if(this.isEquipped(consumable)) {
            this.invalidateAllHeroEffects();
        }
    }

    /**
     * Remove charges from a consumable
     */
    removeCharges(consumable, amount) {
        const current = this.getCharges(consumable);
        const newCharges = Math.max(current - amount, 0);
        this.charges.set(consumable, newCharges);
        consumable.renderQueue.updateAll();

        // Auto-unequip if no charges left (only for non-tavern consumables)
        // Note: unequip() already invalidates the cache
        if(newCharges <= 0 && !consumable.isTavernDrink && this.isEquipped(consumable)) {
            this.unequip(consumable);
        }
        // Invalidate effect cache if tavern drink or equipped consumable charges changed
        else if(consumable.isTavernDrink || this.isEquipped(consumable)) {
            this.invalidateAllHeroEffects();
        }
    }

    // =========================================
    // Tavern drink methods (use charges system)
    // =========================================

    /**
     * Add charges to a tavern drink (called when purchasing)
     */
    addTavernDrinkCharges(consumable, amount) {
        const current = this.getCharges(consumable);
        this.charges.set(consumable, current + amount);
        consumable.renderQueue.updateAll();
        this.manager.overview.renderQueue.buffs = true;
        
        // Invalidate effect cache for all heroes
        this.invalidateAllHeroEffects();
    }
    
    /**
     * Invalidate effect cache for all heroes.
     * Called when tavern drinks change.
     */
    invalidateAllHeroEffects() {
        if(this.manager.party) {
            this.manager.party.all.forEach(hero => {
                if(hero.effectCache) {
                    hero.invalidateEffects('consumables');
                }
            });
        }
    }

    /**
     * Consume one charge from all active tavern drinks (called at dungeon end)
     */
    consumeTavernDrinkCharges() {
        for(const consumable of this.manager.consumableTypes.allObjects) {
            if(consumable.isTavernDrink && this.getCharges(consumable) > 0) {
                this.removeCharges(consumable, 1);
            }
        }
    }

    /**
     * Get all active tavern drinks with their remaining charges
     */
    getActiveTavernDrinks() {
        const active = [];
        for(const consumable of this.manager.consumableTypes.allObjects) {
            if(consumable.isTavernDrink) {
                const charges = this.getCharges(consumable);
                if(charges > 0) {
                    active.push({ consumable, runsRemaining: charges });
                }
            }
        }
        return active;
    }

    /**
     * Get all effects from active tavern drinks.
     * Effects are pre-built in standardized format during consumable registration.
     * These effects apply to the party (all heroes).
     * @returns {StandardEffect[]} Array of standardized effects
     */
    getEffects() {
        const effects = [];
        
        for(const consumable of this.manager.consumableTypes.allObjects) {
            if(consumable.isTavernDrink && this.getCharges(consumable) > 0) {
                effects.push(...consumable.effects);
            }
        }
        
        return effects;
    }

    /**
     * Check if a consumable is equipped
     */
    isEquipped(consumable) {
        return this.equipped.includes(consumable);
    }

    /**
     * Equip a consumable to a slot
     */
    equip(consumable) {
        if(this.equipped.length >= MAX_EQUIPPED_CONSUMABLES) {
            this.manager.log.add(`Cannot equip more than ${MAX_EQUIPPED_CONSUMABLES} consumables.`);
            return false;
        }
        if(this.isEquipped(consumable)) {
            return false;
        }
        if(this.getCharges(consumable) <= 0) {
            this.manager.log.add(`${consumable.name} has no charges.`);
            return false;
        }

        this.equipped.push(consumable);
        consumable.renderQueue.equipped = true;
        this.renderQueue.slots = true;
        this.manager.overview.renderQueue.buffs = true;
        this.manager.log.add(`Equipped ${consumable.name}`);
        
        // Invalidate effect cache for all heroes
        this.invalidateAllHeroEffects();
        return true;
    }

    /**
     * Unequip a consumable
     */
    unequip(consumable) {
        const index = this.equipped.indexOf(consumable);
        if(index === -1) return false;

        this.equipped.splice(index, 1);
        consumable.renderQueue.equipped = true;
        this.renderQueue.slots = true;
        this.manager.overview.renderQueue.buffs = true;
        
        // Invalidate effect cache for all heroes
        this.invalidateAllHeroEffects();
        return true;
    }

    /**
     * Called when starting a new dungeon run
     */
    onDungeonStart() {
        this.usedThisRun.clear();
        
        // Note: dungeon_start effects removed - strength elixirs now apply at encounter_start
    }

    /**
     * Called when a dungeon run ends
     */
    onDungeonEnd() {
        // Get preservation chance from mastery pool
        const preserveChance = this.manager.modifiers.getConsumablePreservationChance();

        // Consume charges from equipped consumables that have consume_at_run_end effects
        this.equipped.forEach(consumable => {
            const hasRunEndConsumption = consumable.effects.some(e => e.consume_at_run_end);
            if(hasRunEndConsumption) {
                if(preserveChance > 0 && Math.random() < preserveChance) {
                    // Preserved! Charge not consumed
                    this.manager.log.add(`${consumable.name} preserved!`);
                } else {
                    consumable.useCharge();
                }
            }
        });
        
        // Consume one charge from active tavern drinks
        this.consumeTavernDrinkCharges();
        
        this.usedThisRun.clear();
    }

    /**
     * Called at the start of each floor
     */
    onFloorStart() {
        this.equipped.forEach(consumable => {
            consumable.effects.forEach(effect => {
                if(effect.trigger === 'floor_start') {
                    // Check if this effect only triggers when someone is injured
                    if(effect.only_if_injured) {
                        const anyoneInjured = this.manager.party.all.some(m => !m.dead && m.hitpoints < m.stats.maxHitpoints);
                        if(!anyoneInjured) return;
                    }
                    this.applyEffect(consumable, effect);
                }
            });
        });
    }

    /**
     * Called at the start of each encounter
     */
    onEncounterStart() {
        // Apply consumable effects as auras to party members
        this.equipped.forEach(consumable => {
            consumable.effects.forEach(effect => {
                if(effect.trigger === 'encounter_start') {
                    this.applyEffect(consumable, effect);
                }
            });
        });
    }

    /**
     * Called when a party member takes damage
     * Returns true if a heal was triggered
     */
    onCharacterDamaged(member) {
        if(member.dead) return false;
        
        const hpPercent = member.hitpoints / member.stats.maxHitpoints;
        
        for(const consumable of this.equipped) {
            for(const effect of consumable.effects) {
                if(effect.trigger === 'on_damage' && effect.type === 'heal_on_low_hp') {
                    // Check if below threshold
                    if(hpPercent < effect.threshold) {
                        // Heal the member
                        member.heal({ amount: effect.healAmount });
                        this.manager.log.add(`${consumable.name} healed ${member.name} for ${effect.healAmount} HP!`);
                        
                        // Use a charge
                        consumable.useCharge();
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Called when all party members die (before game over)
     * Returns true if party was revived
     */
    onPartyWipe() {
        // Check if all party members are dead
        const allDead = this.manager.party.all.every(member => member.dead);
        if(!allDead) return false;
        
        for(const consumable of this.equipped) {
            for(const effect of consumable.effects) {
                if(effect.trigger === 'party_wipe' && effect.type === 'revive_all') {
                    // Check once_per_run
                    if(effect.once_per_run && this.usedThisRun.has(consumable.id)) {
                        continue;
                    }
                    
                    // require_all_dead is now always enforced (checked above)
                    
                    // Revive all party members
                    const amount = effect.amount;
                    this.manager.party.all.forEach(member => {
                        if(member.dead) {
                            member.revive({ amount });
                        }
                    });

                    this.usedThisRun.add(consumable.id);
                    this.manager.log.add(`${consumable.name} revived the party!`);
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Apply a consumable effect
     */
    applyEffect(consumable, effect) {
        switch(effect.type) {
            case 'heal_percent':
                this.manager.party.all.forEach(member => {
                    if(!member.dead) {
                        const healAmount = Math.floor(member.stats.maxHitpoints * effect.amount);
                        member.heal({ amount: healAmount });
                    }
                });
                break;
            case 'buff_damage':
                // Apply damage buff as aura to all party members
                const damagePercent = Math.floor(effect.amount * 100);
                this.manager.party.alive.forEach(member => {
                    member.buff('adventuring:consumable_damage', { amount: damagePercent }, member);
                });
                this.manager.log.add(`${consumable.name} grants +${damagePercent}% damage to the party!`);
                break;
            case 'buff_defense':
                // Apply defense buff as fortify aura
                const defensePercent = Math.floor(effect.amount * 100);
                this.manager.party.alive.forEach(member => {
                    member.buff('adventuring:fortify', { amount: defensePercent }, member);
                });
                this.manager.log.add(`${consumable.name} grants +${defensePercent}% damage reduction to the party!`);
                break;
            case 'buff_speed':
                // Apply speed buff as haste aura
                const speedPercent = Math.floor(effect.amount * 100);
                this.manager.party.alive.forEach(member => {
                    member.buff('adventuring:haste', { amount: speedPercent }, member);
                });
                this.manager.log.add(`${consumable.name} grants +${speedPercent}% speed to the party!`);
                break;
        }
    }

    render() {
        this.consumables.forEach(c => c.render());
        this.renderSlots();
        this.renderDetails();
    }

    renderSlots() {
        if(!this.renderQueue.slots) return;

        for(let i = 0; i < MAX_EQUIPPED_CONSUMABLES; i++) {
            const slot = this.component.slots[i];
            const consumable = this.equipped[i];
            
            if(slot) {
                if(consumable) {
                    slot.querySelector('img').src = consumable.media;
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
        if(!this.renderQueue.details) return;
        
        const consumable = this.selectedConsumable;
        if(!consumable) {
            this.component.hideDetails();
            this.renderQueue.details = false;
            return;
        }
        
        this.component.showDetails();
        
        // Basic info
        this.component.detailIcon.src = consumable.media;
        this.component.detailName.textContent = consumable.name;
        this.component.detailDescription.textContent = consumable.description || '';
        
        // Effects
        this.component.detailEffects.innerHTML = '';
        const effectText = consumable.effectText;
        if(effectText) {
            const effectDiv = document.createElement('div');
            effectDiv.className = 'text-success';
            effectDiv.textContent = effectText;
            this.component.detailEffects.appendChild(effectDiv);
        }
        
        // Charges
        this.component.detailCharges.textContent = `${consumable.charges} / ${consumable.maxCharges}`;
        
        // Crafting materials
        this.materialComponents.forEach(comp => comp.remove());
        
        let componentCount = 0;
        if(consumable.materials && consumable.materials.size > 0) {
            for(const [material, qty] of consumable.materials) {
                let comp = this.materialComponents[componentCount];
                if(comp === undefined) {
                    comp = createElement('adventuring-material');
                    this.materialComponents[componentCount] = comp;
                }
                
                comp.mount(this.component.detailMaterials);
                
                // Color based on affordability
                const owned = this.manager.stash.materialCounts.get(material) || 0;
                comp.setTooltipContent(TooltipBuilder.forMaterial({ name: material.name, media: material.media, count: owned }).build());
                comp.icon.src = material.media;
                comp.count.textContent = qty;
                
                if(owned >= qty) {
                    comp.border.classList.remove('border-danger');
                    comp.border.classList.add('border-success');
                } else {
                    comp.border.classList.remove('border-success');
                    comp.border.classList.add('border-danger');
                }
                
                componentCount++;
            }
        }
        
        // Craft button
        const canCraft = consumable.charges < consumable.maxCharges && 
                         consumable.materials && 
                         consumable.materials.size > 0 &&
                         [...consumable.materials].every(([mat, qty]) => 
                             (this.manager.stash.materialCounts.get(mat) || 0) >= qty);
        
        this.component.craftButton.disabled = !canCraft;
        this.component.craftButton.className = canCraft ? 'btn btn-primary mr-2' : 'btn btn-secondary mr-2';
        
        // Equip button
        if(this.isEquipped(consumable)) {
            this.component.equipButton.textContent = 'Unequip';
            this.component.equipButton.className = 'btn btn-warning';
            this.component.equipButton.disabled = false;
        } else if(consumable.charges <= 0) {
            this.component.equipButton.textContent = 'Equip';
            this.component.equipButton.className = 'btn btn-secondary';
            this.component.equipButton.disabled = true;
        } else if(this.equipped.length >= MAX_EQUIPPED_CONSUMABLES) {
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
        this.consumables.forEach(c => c.renderQueue.updateAll());
        this.renderQueue.updateAll();
    }

    encode(writer) {
        // Encode all consumable charges (includes tavern drinks)
        writer.writeComplexMap(this.charges, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeUint16(value);
        });
        // Encode equipped consumables
        writer.writeArray(this.equipped, (consumable, writer) => {
            writer.writeNamespacedObject(consumable);
        });
        return writer;
    }

    decode(reader, version) {
        // Decode charges (includes tavern drinks)
        reader.getComplexMap((reader) => {
            const key = reader.getNamespacedObject(this.manager.consumableTypes);
            const value = reader.getUint16();
            if(typeof key !== "string")
                this.charges.set(key, value);
        });
        // Decode equipped - use getArray to match writeArray
        this.equipped = reader.getArray((reader) => {
            return reader.getNamespacedObject(this.manager.consumableTypes);
        }).filter(c => typeof c !== "string" && this.getCharges(c) > 0);
    }
}

export { MAX_EQUIPPED_CONSUMABLES };
