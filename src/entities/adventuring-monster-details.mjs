const { loadModule } = mod.getContext(import.meta);

const { AdventuringDetailsPage } = await loadModule('src/ui/adventuring-details-page.mjs');
const { ComponentPool } = await loadModule('src/core/component-pool.mjs');

// Side-effect import to register custom element
await loadModule('src/entities/components/adventuring-monster-details.mjs');
const { AdventuringLootRowElement } = await loadModule('src/entities/components/adventuring-loot-row.mjs');
const { AdventuringStatRowElement } = await loadModule('src/ui/components/adventuring-stat-row.mjs');
const { AdventuringBadgeElement } = await loadModule('src/ui/components/adventuring-badge.mjs');

// Component pools for frequently created elements
const statRowPool = new ComponentPool(() => new AdventuringStatRowElement(), 10, 50);
const lootRowPool = new ComponentPool(() => new AdventuringLootRowElement(), 10, 30);
const badgePool = new ComponentPool(() => new AdventuringBadgeElement(), 5, 20);

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

        this.component.icon.src = this.monster._media;

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
        this.component.masteryProgress.setFixedPosition(percent);

        this.renderQueue.mastery = false;
    }

    renderStats() {
        if(!this.renderQueue.stats) return;

        // Release pooled elements back to pool
        statRowPool.releaseAll(this.component.stats);
        this.component.stats.innerHTML = '';
        
        this.monster.stats.forEach(stat => {
            const statDef = this.manager.stats.getObjectByID(stat.id);
            const name = statDef ? statDef.name : stat.id;
            
            const row = statRowPool.acquire();
            row.setStat({ label: name, value: stat.amount.toString() });
            this.component.stats.appendChild(row);
        });

        this.renderQueue.stats = false;
    }

    renderAbilities() {
        if(!this.renderQueue.abilities) return;

        // Release pooled elements back to pool
        statRowPool.releaseAll(this.component.abilities);
        this.component.abilities.innerHTML = '';
        let hasAbilities = false;
        
        // Generator
        if(this.monster.generator) {
            const gen = this.manager.generators.getObjectByID(this.monster.generator);
            if(gen) {
                const row = statRowPool.acquire();
                row.setStat({ label: 'Generator', value: gen.name, valueClass: 'text-success' });
                this.component.abilities.appendChild(row);
                hasAbilities = true;
            }
        }
        
        // Spender
        if(this.monster.spender) {
            const spend = this.manager.spenders.getObjectByID(this.monster.spender);
            if(spend && spend.id !== 'adventuring:none') {
                const row = statRowPool.acquire();
                row.setStat({ label: 'Spender', value: spend.name, valueClass: 'text-warning' });
                this.component.abilities.appendChild(row);
                hasAbilities = true;
            }
        }
        
        // Passives
        if(this.monster.passives && this.monster.passives.length > 0) {
            this.monster.passives.forEach(passiveId => {
                const passive = this.manager.auras.getObjectByID(passiveId);
                if(passive) {
                    const row = statRowPool.acquire();
                    row.setStat({ label: 'Passive', value: passive.name, valueClass: 'text-info' });
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
                const row = this.createLootRow(entry);
                this.component.dropRows.appendChild(row);
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
    createLootRow(entry) {
        // Get item info
        let icon = '';
        let name = '???';
        let type = entry.type || 'unknown';
        let qty = this.formatQty(entry);
        let chance = this.formatChance(entry);

        switch(entry.type) {
            case 'currency':
            case 'salvage':
            case 'materials': {
                const material = this.manager.materials.getObjectByID(entry.id);
                if(material) {
                    icon = material.media;
                    name = material.name;
                }
                break;
            }
            case 'equipment': {
                const item = this.manager.baseItems.getObjectByID(entry.id);
                if(item) {
                    icon = item.media;
                    name = item.name;
                }
                break;
            }
            case 'equipment_pool': {
                const pool = this.manager.equipmentPools.getObjectByID(entry.pool);
                if(pool && pool.items[0]) {
                    icon = pool.items[0].media || '';
                    name = `Pool: ${pool.id.split(':')[1]}`;
                }
                break;
            }
        }

        const row = lootRowPool.acquire();
        row.setLoot({ icon, name, type, qty, chance });
        return row;
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
        
        // Release pooled badges back to pool
        badgePool.releaseAll(this.component.locations);
        this.component.locations.innerHTML = '';
        
        if(sources.length === 0) {
            const span = document.createElement('span');
            span.className = 'text-muted';
            span.textContent = 'Unknown';
            this.component.locations.appendChild(span);
        } else {
            sources.forEach(area => {
                const badge = badgePool.acquire();
                badge.setLocation(area.name);
                this.component.locations.appendChild(badge);
            });
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
