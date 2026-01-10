const { loadModule } = mod.getContext(import.meta);

const { AdventuringDetailsPage } = await loadModule('src/ui/adventuring-details-page.mjs');
const { ComponentPool } = await loadModule('src/core/component-pool.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

// Side-effect import to register custom element
await loadModule('src/entities/components/adventuring-monster-details.mjs');
const { AdventuringLootRowElement } = await loadModule('src/entities/components/adventuring-loot-row.mjs');
const { AdventuringStatRowElement } = await loadModule('src/ui/components/adventuring-stat-row.mjs');
const { AdventuringStatBadgeElement } = await loadModule('src/progression/components/adventuring-stat-badge.mjs');
const { AdventuringMonsterAbilityRowElement } = await loadModule('src/entities/components/adventuring-monster-ability-row.mjs');

// Component pools for frequently created elements (lazy init with 0 initial size)
const statBadgePool = new ComponentPool(() => new AdventuringStatBadgeElement(), 0, 50);
const abilityRowPool = new ComponentPool(() => new AdventuringMonsterAbilityRowElement(), 0, 20);
const lootRowPool = new ComponentPool(() => new AdventuringLootRowElement(), 0, 30);

export class AdventuringMonsterDetails extends AdventuringDetailsPage {
    constructor(manager, game) {
        super(manager, game, 'adventuring-monster-details', () => this.manager.bestiary);
    }

    /**
     * Create extended render queue for monster details
     */
    createRenderQueue() {
        return {
            name: false,
            icon: false,
            tags: false,
            mastery: false,
            stats: false,
            abilities: false,
            drops: false,
            locations: false,
            queueAll() {
                this.name = true;
                this.icon = true;
                this.tags = true;
                this.mastery = true;
                this.stats = true;
                this.abilities = true;
                this.drops = true;
                this.locations = true;
            }
        };
    }

    /**
     * Alias for setEntity for semantic clarity
     */
    setMonster(monster) {
        this.setEntity(monster);
    }

    /**
     * Get the current monster (alias for entity)
     */
    get monster() {
        return this.entity;
    }

    render() {
        if(!this.monster) return;
        
        this.renderName();
        this.renderIcon();
        this.renderTags();
        this.renderMastery();
        this.renderStats();
        this.renderAbilities();
        this.renderDrops();
        this.renderLocations();
    }

    renderName() {
        if(!this.renderQueue.name) return;

        this.component.nameText.textContent = this.monster.name;

        this.renderQueue.name = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon) return;

        this.component.icon.src = this.monster.media;

        this.renderQueue.icon = false;
    }

    renderTags() {
        if(!this.renderQueue.tags) return;

        const tags = this.monster.tags || [];
        this.component.tags.textContent = tags.length > 0 
            ? tags.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')
            : '';

        this.renderQueue.tags = false;
    }

    renderMastery() {
        if(!this.renderQueue.mastery) return;

        const killCount = this.manager.bestiary.getKillCount(this.monster);
        const { xp, level, percent } = this.manager.getMasteryProgress(this.monster);

        this.component.killCount.textContent = killCount.toLocaleString();
        this.component.masteryLevel.textContent = level;
        if(this.component.masteryProgress && this.component.masteryProgress.setFixedPosition) {
            this.component.masteryProgress.setFixedPosition(percent);
        }

        this.renderQueue.mastery = false;
    }

    renderStats() {
        if(!this.renderQueue.stats) return;

        // Release pooled elements back to pool
        statBadgePool.releaseAll(this.component.stats);
        this.component.stats.innerHTML = '';
        
        this.monster.stats.forEach(stat => {
            const statDef = this.manager.stats.getObjectByID(stat.id);
            if(statDef) {
                const badge = statBadgePool.acquire();
                badge.setStatCompact(statDef, stat.amount);
                this.component.stats.appendChild(badge);
            }
        });

        this.renderQueue.stats = false;
    }

    /**
     * Build a stats-like object from the monster's raw stats array
     * Used for ability tooltip descriptions to show proper damage values
     */
    getMonsterStats() {
        const statsMap = new Map();
        this.monster.stats.forEach(({ id, amount }) => {
            const stat = this.manager.stats.getObjectByID(id);
            if(stat) statsMap.set(stat, amount);
        });
        return {
            get: (statId) => {
                let stat = statId;
                if(typeof stat === 'string')
                    stat = this.manager.stats.getObjectByID(statId);
                return statsMap.get(stat) || 0;
            }
        };
    }

    renderAbilities() {
        if(!this.renderQueue.abilities) return;

        // Release pooled elements back to pool
        abilityRowPool.releaseAll(this.component.abilities);
        this.component.abilities.innerHTML = '';
        let hasAbilities = false;

        // Build stats object for ability descriptions
        const monsterStats = this.getMonsterStats();
        
        // Generator
        if(this.monster.generator) {
            const gen = this.manager.generators.getObjectByID(this.monster.generator);
            if(gen) {
                const row = abilityRowPool.acquire();
                const tooltip = TooltipBuilder.forAbility(gen, { 
                    manager: this.manager, 
                    type: 'generator',
                    character: monsterStats,
                    displayMode: 'total',
                    skipUsableBy: true,
                    forceShowDescription: true
                });
                row.setAbility({ type: 'generator', name: gen.name, tooltipContent: tooltip.build() });
                this.component.abilities.appendChild(row);
                hasAbilities = true;
            }
        }
        
        // Spender
        if(this.monster.spender) {
            const spend = this.manager.spenders.getObjectByID(this.monster.spender);
            if(spend && spend.id !== 'adventuring:none') {
                const row = abilityRowPool.acquire();
                const tooltip = TooltipBuilder.forAbility(spend, { 
                    manager: this.manager, 
                    type: 'spender',
                    character: monsterStats,
                    displayMode: 'total',
                    skipUsableBy: true,
                    forceShowDescription: true
                });
                row.setAbility({ type: 'spender', name: spend.name, tooltipContent: tooltip.build() });
                this.component.abilities.appendChild(row);
                hasAbilities = true;
            }
        }
        
        // Passives
        if(this.monster.passives && this.monster.passives.length > 0) {
            this.monster.passives.forEach(passiveId => {
                const passive = this.manager.auras.getObjectByID(passiveId);
                if(passive) {
                    const row = abilityRowPool.acquire();
                    const tooltip = TooltipBuilder.forAbility(passive, { 
                        manager: this.manager, 
                        type: 'passive',
                        character: monsterStats,
                        displayMode: 'total',
                        skipUsableBy: true,
                        forceShowDescription: true
                    });
                    row.setAbility({ type: 'passive', name: passive.name, tooltipContent: tooltip.build() });
                    this.component.abilities.appendChild(row);
                    hasAbilities = true;
                }
            });
        }

        if(!hasAbilities) {
            this.component.abilities.innerHTML = '<span class="text-muted">None</span>';
        }

        this.renderQueue.abilities = false;
    }

    renderDrops() {
        if(!this.renderQueue.drops) return;

        // Check if drop table reveal is unlocked via mastery milestone
        const revealed = this.monster.hasUnlock('drop_table_reveal');

        // Update lock message with actual required level from milestone
        if(!revealed) {
            const requiredLevel = this.getUnlockLevel('drop_table_reveal');
            this.component.dropLock.textContent = `(Reach mastery level ${requiredLevel} to reveal)`;
        }

        // Show/hide lock message
        this.component.dropLock.classList.toggle('d-none', revealed);

        // Release pooled elements back to pool before clearing
        lootRowPool.releaseAll(this.component.dropRows);
        this.component.dropRows.innerHTML = '';

        if(!revealed) {
            // Show placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'text-muted text-center p-3';
            placeholder.textContent = '???';
            this.component.dropRows.appendChild(placeholder);
        } else {
            // Expand and render all loot entries
            const entries = this.expandLootEntries(this.monster.lootGenerator.table);
            
            entries.forEach(entry => {
                if(entry.type === 'equipment_pool') {
                    // Create header and nested items for pool
                    const rows = this.createPoolRows(entry);
                    rows.forEach(row => this.component.dropRows.appendChild(row));
                } else {
                    const row = this.createLootRow(entry);
                    this.component.dropRows.appendChild(row);
                }
            });
        }

        this.renderQueue.drops = false;
    }

    /**
     * Expand loot entries, inlining table references
     */
    expandLootEntries(entries) {
        const expanded = [];
        
        for(const entry of entries) {
            if(entry.type === 'table') {
                const table = this.manager.lootTables.getObjectByID(entry.table);
                if(table) {
                    // Recursively expand table entries
                    expanded.push(...this.expandLootEntries(table.getEntries()));
                }
            } else {
                expanded.push(entry);
            }
        }
        
        return expanded;
    }

    /**
     * Create a loot row element for a loot entry (uses pool)
     */
    createLootRow(entry, nested = false) {
        // Get item info
        let icon = '';
        let name = '???';
        let type = entry.type || 'unknown';
        let qty = this.formatQty(entry);
        let chance = this.formatChance(entry);
        let tooltipContent = '';

        switch(entry.type) {
            case 'currency':
            case 'salvage':
            case 'materials': {
                const material = this.manager.materials.getObjectByID(entry.id);
                if(material) {
                    icon = material.media;
                    name = material.name;
                    tooltipContent = TooltipBuilder.forMaterial(material, this.manager).build();
                }
                break;
            }
            case 'equipment': {
                const item = this.manager.baseItems.getObjectByID(entry.id);
                if(item) {
                    icon = item.media;
                    name = item.name;
                    tooltipContent = TooltipBuilder.forEquipment(item, this.manager).build();
                }
                break;
            }
        }

        const row = lootRowPool.acquire();
        row.setLoot({ icon, name, type, qty, chance, nested, tooltipContent });
        return row;
    }

    /**
     * Create header row and nested item rows for an equipment pool
     */
    createPoolRows(entry) {
        const rows = [];
        const pool = this.manager.equipmentPools.getObjectByID(entry.pool);
        
        if(!pool) return rows;

        // Create header row for the pool
        const headerRow = lootRowPool.acquire();
        headerRow.setLoot({ 
            icon: '', 
            name: 'Equipment Drops', 
            type: 'equipment', 
            qty: this.formatQty(entry), 
            chance: this.formatChance(entry),
            isHeader: true 
        });
        rows.push(headerRow);

        // Calculate total weight for percentage calculation
        const totalWeight = pool.items.reduce((sum, e) => sum + e.weight, 0);

        // Create nested rows for each item in the pool
        // pool.items is array of { item, weight } objects
        pool.items.forEach(poolEntry => {
            const item = poolEntry.item;
            if(!item) return;
            
            // Calculate this item's chance within the pool
            const itemChance = totalWeight > 0 ? (poolEntry.weight / totalWeight) : 0;
            const chanceText = `${(itemChance * 100).toFixed(1)}%`;
            
            // Check if item has already dropped
            const isDropped = item.dropped;
            
            // Show ??? for undropped items
            const displayName = isDropped ? `✓ ${item.name}` : '???';
            const tooltipContent = TooltipBuilder.forEquipment(item, this.manager).build();
            const itemRow = lootRowPool.acquire();
            itemRow.setLoot({ 
                icon: item.media, 
                name: displayName, 
                type: 'equipment', 
                qty: '-', 
                chance: chanceText,
                nested: true,
                tooltipContent,
                collected: isDropped
            });
            rows.push(itemRow);
        });

        return rows;
    }

    formatQty(entry) {
        if(entry.minQty !== undefined && entry.maxQty !== undefined) {
            return `${entry.minQty}-${entry.maxQty}`;
        }
        return entry.qty !== undefined ? entry.qty.toString() : '-';
    }

    formatChance(entry) {
        if(entry.chance === undefined || entry.chance === 1) return '100%';
        return `${(entry.chance * 100).toFixed(1)}%`;
    }

    renderLocations() {
        if(!this.renderQueue.locations) return;

        const monsterSources = this.manager.monsterSources;
        const sources = (monsterSources && monsterSources.get(this.monster)) || [];
        
        if(sources.length === 0) {
            this.component.locationRow.classList.add('d-none');
        } else {
            this.component.locationRow.classList.remove('d-none');
            // Show first area (monsters typically only appear in one area)
            const area = sources[0];
            this.component.locationIcon.src = area.media;
            this.component.locationName.textContent = area.name;
        }

        this.renderQueue.locations = false;
    }

    /**
     * Get the mastery level required for a specific unlock type
     * @param {string} unlockType - The unlock type to find
     * @returns {number} The level required, or 0 if not found
     */
    getUnlockLevel(unlockType) {
        return this.getUnlockLevelForCategory('adventuring:monsters', unlockType);
    }
}
