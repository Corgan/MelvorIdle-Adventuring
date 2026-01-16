const { loadModule } = mod.getContext(import.meta);

const { AdventuringDetailsPage } = await loadModule('src/ui/adventuring-details-page.mjs');
const { ComponentPool } = await loadModule('src/core/component-pool.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { getEffectDescriptionsList } = await loadModule('src/core/adventuring-utils.mjs');

await loadModule('src/entities/components/adventuring-monster-details.mjs');
const { AdventuringLootRowElement } = await loadModule('src/entities/components/adventuring-loot-row.mjs');
const { AdventuringStatRowElement } = await loadModule('src/ui/components/adventuring-stat-row.mjs');
const { AdventuringStatBadgeElement } = await loadModule('src/progression/components/adventuring-stat-badge.mjs');
const { AdventuringMonsterAbilityRowElement } = await loadModule('src/entities/components/adventuring-monster-ability-row.mjs');

class MilestoneRowElement extends HTMLElement {
    constructor() {
        super();
        this.innerHTML = `
            <div class="d-flex align-items-center p-1 mb-1">
                <span class="badge mr-2" id="level" style="min-width: 40px;"></span>
                <small id="description"></small>
            </div>
        `;
        this.levelEl = this.querySelector('#level');
        this.descriptionEl = this.querySelector('#description');
    }

    setMilestone({ level, description, achieved }) {
        this.levelEl.textContent = `Lv ${level}`;
        this.levelEl.className = achieved ? 'badge badge-success mr-2' : 'badge badge-secondary mr-2';
        this.levelEl.style.minWidth = '40px';
        this.descriptionEl.textContent = description;
        this.descriptionEl.className = achieved ? 'small' : 'small text-muted';
    }

    reset() {}
}

if (!customElements.get('adventuring-monster-milestone-row')) {
    customElements.define('adventuring-monster-milestone-row', MilestoneRowElement);
}

const statBadgePool = new ComponentPool(() => new AdventuringStatBadgeElement(), 0, 50);
const abilityRowPool = new ComponentPool(() => new AdventuringMonsterAbilityRowElement(), 0, 20);
const lootRowPool = new ComponentPool(() => new AdventuringLootRowElement(), 0, 30);
const milestoneRowPool = new ComponentPool(() => new MilestoneRowElement(), 0, 20);

export class AdventuringMonsterDetails extends AdventuringDetailsPage {
    constructor(manager, game) {
        super(manager, game, 'adventuring-monster-details', () => this.manager.bestiary);
    }

    createRenderQueue() {
        return {
            name: false,
            icon: false,
            tags: false,
            mastery: false,
            milestones: false,
            stats: false,
            abilities: false,
            drops: false,
            locations: false,
            queueAll() {
                this.name = true;
                this.icon = true;
                this.tags = true;
                this.mastery = true;
                this.milestones = true;
                this.stats = true;
                this.abilities = true;
                this.drops = true;
                this.locations = true;
            }
        };
    }

    setMonster(monster) {
        this.setEntity(monster);
    }

    get monster() {
        return this.entity;
    }

    render() {
        if(!this.monster) return;

        this.renderName();
        this.renderIcon();
        this.renderTags();
        this.renderMastery();
        this.renderMilestones();
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

    renderMilestones() {
        if(!this.renderQueue.milestones) return;

        // Release old elements
        for (const child of [...this.component.milestones.children]) {
            if (child.reset) child.reset();
        }
        milestoneRowPool.releaseAll(this.component.milestones);
        this.component.milestones.innerHTML = '';
        
        const category = this.monster.masteryCategory;
        if(!category || !category.milestones) {
            this.renderQueue.milestones = false;
            return;
        }

        const currentLevel = this.monster.level;

        for (const milestone of category.milestones) {
            const achieved = currentLevel >= milestone.level;
            const descriptions = milestone.effects 
                ? getEffectDescriptionsList(milestone.effects, this.manager)
                : [];

            if (descriptions.length === 0) continue;

            // For scaling milestones, append "/level" to indicate per-level bonus
            const description = milestone.scaling 
                ? descriptions.map(d => `${d}/level`).join(', ')
                : descriptions.join(', ');

            const row = milestoneRowPool.acquire();
            row.setMilestone({
                level: milestone.level,
                description,
                achieved
            });
            this.component.milestones.appendChild(row);
        }

        this.renderQueue.milestones = false;
    }

    renderStats() {
        if(!this.renderQueue.stats) return;

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

        abilityRowPool.releaseAll(this.component.abilities);
        this.component.abilities.innerHTML = '';
        let hasAbilities = false;

        const monsterStats = this.getMonsterStats();

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

        const revealed = this.monster.hasUnlock('drop_table_reveal');

        if(!revealed) {
            const requiredLevel = this.getUnlockLevel('drop_table_reveal');
            this.component.dropLock.textContent = `(Reach mastery level ${requiredLevel} to reveal)`;
        }

        this.component.dropLock.classList.toggle('d-none', revealed);

        lootRowPool.releaseAll(this.component.dropRows);
        this.component.dropRows.innerHTML = '';

        if(!revealed) {

            const placeholder = document.createElement('div');
            placeholder.className = 'text-muted text-center p-3';
            placeholder.textContent = '???';
            this.component.dropRows.appendChild(placeholder);
        } else {

            const entries = this.expandLootEntries(this.monster.lootGenerator.table);

            entries.forEach(entry => {
                if(entry.type === 'equipment_pool') {

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

    expandLootEntries(entries) {
        const expanded = [];

        for(const entry of entries) {
            if(entry.type === 'table') {
                const table = this.manager.lootTables.getObjectByID(entry.table);
                if(table) {

                    expanded.push(...this.expandLootEntries(table.getEntries()));
                }
            } else {
                expanded.push(entry);
            }
        }

        return expanded;
    }

    createLootRow(entry, nested = false) {

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

    createPoolRows(entry) {
        const rows = [];
        const pool = this.manager.equipmentPools.getObjectByID(entry.pool);

        if(!pool) return rows;

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

        const totalWeight = pool.items.reduce((sum, e) => sum + e.weight, 0);


        pool.items.forEach(poolEntry => {
            const item = poolEntry.item;
            if(!item) return;

            const itemChance = totalWeight > 0 ? (poolEntry.weight / totalWeight) : 0;
            const chanceText = `${(itemChance * 100).toFixed(1)}%`;

            const isUnlocked = item.unlocked;

            const displayName = isUnlocked ? `✓ ${item.name}` : '???';
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
                collected: isUnlocked
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
            this.component.locationRow.onclick = null;
        } else {
            this.component.locationRow.classList.remove('d-none');

            const area = sources[0];
            this.component.locationIcon.src = area.media;
            this.component.locationName.textContent = area.name;
            
            // Make location clickable to navigate to area details
            this.component.locationRow.onclick = () => {
                if(this.manager.areadetails) {
                    this.manager.areadetails.setArea(area);
                    this.manager.areadetails.render();
                    this.manager.areadetails.go();
                }
            };
        }

        this.renderQueue.locations = false;
    }

    getUnlockLevel(unlockType) {
        return this.getUnlockLevelForCategory('adventuring:monsters', unlockType);
    }
}
