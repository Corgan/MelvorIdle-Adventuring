const { loadModule } = mod.getContext(import.meta);

const { AdventuringDetailsPage } = await loadModule('src/ui/adventuring-details-page.mjs');
const { ComponentPool } = await loadModule('src/core/component-pool.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { getEffectDescriptionsList } = await loadModule('src/core/adventuring-utils.mjs');
const { AdventuringIconButtonElement } = await loadModule('src/ui/components/adventuring-icon-button.mjs');

await loadModule('src/dungeon/components/adventuring-area-details.mjs');

class FloorMonsterRowElement extends HTMLElement {
    constructor() {
        super();
        this.innerHTML = `
            <div class="d-flex align-items-center p-2 mb-1 border-bottom border-dark">
                <img class="skill-icon-xs mr-2" id="icon" style="width: 32px; height: 32px;">
                <span class="font-w600" id="name"></span>
                <small class="text-muted ml-auto" id="floors"></small>
            </div>
        `;
        this.iconEl = this.querySelector('#icon');
        this.nameEl = this.querySelector('#name');
        this.floorsEl = this.querySelector('#floors');
        this._tippy = null;
    }

    setMonster({ icon, name, floors, tooltipContent, seen }) {
        this.iconEl.src = icon;
        this.nameEl.textContent = seen ? name : '???';
        this.nameEl.className = seen ? 'font-w600' : 'font-w600 text-muted';
        this.floorsEl.textContent = floors;

        // Destroy existing tooltip before creating new one
        if (this._tippy) {
            this._tippy.destroy();
            this._tippy = null;
        }

        if (tooltipContent && seen) {
            this._tippy = tippy(this, {
                content: tooltipContent,
                allowHTML: true,
                placement: 'top',
                interactive: false
            });
        }
    }

    reset() {
        if (this._tippy) {
            this._tippy.destroy();
            this._tippy = null;
        }
        this.onclick = null;
    }
}

if (!customElements.get('adventuring-floor-monster-row')) {
    customElements.define('adventuring-floor-monster-row', FloorMonsterRowElement);
}

const monsterRowPool = new ComponentPool(() => new FloorMonsterRowElement(), 0, 50);

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
}

if (!customElements.get('adventuring-milestone-row')) {
    customElements.define('adventuring-milestone-row', MilestoneRowElement);
}

const milestoneRowPool = new ComponentPool(() => new MilestoneRowElement(), 0, 20);
const dropIconPool = new ComponentPool(() => new AdventuringIconButtonElement(), 0, 50);

export class AdventuringAreaDetails extends AdventuringDetailsPage {
    constructor(manager, game) {
        super(manager, game, 'adventuring-area-details', () => this.manager.crossroads);
    }

    createRenderQueue() {
        return {
            name: false,
            icon: false,
            description: false,
            dimensions: false,
            mastery: false,
            clearCounts: false,
            milestones: false,
            monsters: false,
            drops: false,
            queueAll() {
                this.name = true;
                this.icon = true;
                this.description = true;
                this.dimensions = true;
                this.mastery = true;
                this.clearCounts = true;
                this.milestones = true;
                this.monsters = true;
                this.drops = true;
            }
        };
    }

    setArea(area) {
        this.setEntity(area);
    }

    get area() {
        return this.entity;
    }

    render() {
        if (!this.area) return;

        this.renderName();
        this.renderIcon();
        this.renderDescription();
        this.renderDimensions();
        this.renderMastery();
        this.renderClearCounts();
        this.renderMilestones();
        this.renderMonsters();
        this.renderDrops();
    }

    renderName() {
        if (!this.renderQueue.name) return;

        this.component.nameText.textContent = this.area.name;

        this.renderQueue.name = false;
    }

    renderIcon() {
        if (!this.renderQueue.icon) return;

        this.component.icon.src = this.area.media;

        this.renderQueue.icon = false;
    }

    renderDescription() {
        if (!this.renderQueue.description) return;

        this.component.description.textContent = this.area.description || '';

        this.renderQueue.description = false;
    }

    renderDimensions() {
        if (!this.renderQueue.dimensions) return;

        const floorCount = this.area.floors ? this.area.floors.length : 0;
        this.component.floorCount.textContent = floorCount;

        const width = this.area.width || 0;
        const height = this.area.height || 0;
        this.component.areaSize.textContent = `${width} × ${height}`;

        this.renderQueue.dimensions = false;
    }

    renderMastery() {
        if (!this.renderQueue.mastery) return;

        const { xp, level, percent } = this.manager.getMasteryProgress(this.area);
        this.component.masteryLevel.textContent = level;

        if (this.component.masteryProgress && this.component.masteryProgress.setFixedPosition) {
            this.component.masteryProgress.setFixedPosition(percent);
        }

        this.component.bestEndless.textContent = this.area.bestEndlessStreak || 0;

        this.renderQueue.mastery = false;
    }

    renderClearCounts() {
        if (!this.renderQueue.clearCounts) return;

        this.component.clearCounts.innerHTML = '';

        // Get clear counts for this area by difficulty from the nested map stat
        const areaId = this.area.id;
        const stats = this.manager.achievementManager.stats;

        // Get difficulty colors and names
        const difficulties = [
            { id: 'adventuring:normal', name: 'Normal', color: 'secondary' },
            { id: 'adventuring:heroic', name: 'Heroic', color: 'warning' },
            { id: 'adventuring:mythic', name: 'Mythic', color: 'danger' }
        ];

        for (const diff of difficulties) {
            const count = stats.getNested('adventuring:clears_by_area_difficulty', areaId, diff.id) || 0;

            const col = document.createElement('div');
            col.className = 'col-4 text-center';

            const countEl = document.createElement('div');
            countEl.className = `font-w700 text-${diff.color}`;
            countEl.textContent = count.toLocaleString();

            const label = document.createElement('small');
            label.className = 'text-muted d-block';
            label.textContent = diff.name;

            col.appendChild(countEl);
            col.appendChild(label);
            this.component.clearCounts.appendChild(col);
        }

        this.renderQueue.clearCounts = false;
    }

    renderMilestones() {
        if (!this.renderQueue.milestones) return;

        // Release old elements
        for (const child of [...this.component.milestones.children]) {
            if (child.reset) child.reset();
        }
        milestoneRowPool.releaseAll(this.component.milestones);
        this.component.milestones.innerHTML = '';

        const category = this.area.masteryCategory;
        if (!category || !category.milestones) {
            this.renderQueue.milestones = false;
            return;
        }

        const currentLevel = this.area.level;

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

    renderMonsters() {
        if (!this.renderQueue.monsters) return;

        // Release old elements and destroy tooltips
        for (const child of [...this.component.monsters.children]) {
            if (child.reset) child.reset();
        }
        monsterRowPool.releaseAll(this.component.monsters);
        this.component.monsters.innerHTML = '';

        if (!this.area.floors) {
            this.renderQueue.monsters = false;
            return;
        }

        const monsterData = new Map();

        for (let floorIdx = 0; floorIdx < this.area.floors.length; floorIdx++) {
            const floor = this.area.floors[floorIdx];
            
            // Regular floor monsters
            if (floor.monsters) {
                for (const entry of floor.monsters) {
                    const monster = this.manager.monsters.getObjectByID(entry.id);
                    if (!monster) continue;

                    if (!monsterData.has(monster)) {
                        monsterData.set(monster, { floors: [], isBoss: false });
                    }

                    const data = monsterData.get(monster);
                    if (!data.floors.includes(floorIdx + 1)) {
                        data.floors.push(floorIdx + 1);
                    }
                }
            }
            
            // Exit monsters (bosses)
            if (floor.exit) {
                for (const monsterId of floor.exit) {
                    const monster = this.manager.monsters.getObjectByID(monsterId);
                    if (!monster) continue;

                    if (!monsterData.has(monster)) {
                        monsterData.set(monster, { floors: [], isBoss: true });
                    }

                    const data = monsterData.get(monster);
                    data.isBoss = true; // Mark as boss
                    if (!data.floors.includes(floorIdx + 1)) {
                        data.floors.push(floorIdx + 1);
                    }
                }
            }
        }

        // Sort: bosses last, then by first floor appearance
        const sortedMonsters = [...monsterData.entries()].sort((a, b) => {
            if (a[1].isBoss !== b[1].isBoss) return a[1].isBoss ? 1 : -1;
            return Math.min(...a[1].floors) - Math.min(...b[1].floors);
        });

        for (const [monster, data] of sortedMonsters) {
            const seen = this.manager.bestiary.seen.get(monster) || false;

            const floorsText = data.isBoss 
                ? `Boss (Floor ${Math.max(...data.floors)})`
                : this.formatFloors(data.floors);

            const row = monsterRowPool.acquire();
            row.setMonster({
                icon: seen ? monster.media : this.manager.getMediaURL('melvor:assets/media/main/question.png'),
                name: monster.name,
                floors: floorsText,
                tooltipContent: TooltipBuilder.forMonster(monster, this.manager).build(),
                seen
            });

            row.style.cursor = seen ? 'pointer' : 'default';
            row.onclick = seen ? () => monster.viewDetails() : null;

            this.component.monsters.appendChild(row);
        }

        this.renderQueue.monsters = false;
    }

    formatFloors(floors) {
        if (floors.length === 0) return '';
        if (floors.length === 1) return `Floor ${floors[0]}`;

        floors.sort((a, b) => a - b);

        const ranges = [];
        let start = floors[0];
        let end = floors[0];

        for (let i = 1; i < floors.length; i++) {
            if (floors[i] === end + 1) {
                end = floors[i];
            } else {
                ranges.push(start === end ? `${start}` : `${start}-${end}`);
                start = floors[i];
                end = floors[i];
            }
        }
        ranges.push(start === end ? `${start}` : `${start}-${end}`);

        return `Floors ${ranges.join(', ')}`;
    }

    renderDrops() {
        if (!this.renderQueue.drops) return;

        // Release old icons back to pool
        dropIconPool.releaseAll(this.component.drops);
        this.component.drops.innerHTML = '';

        const revealed = this.area.hasUnlock('area_drops_reveal');

        if (!revealed) {
            const requiredLevel = this.getUnlockLevel('area_drops_reveal');
            this.component.dropsLock.textContent = `(Reach mastery level ${requiredLevel} to reveal)`;
            this.component.dropsLock.classList.remove('d-none');

            const placeholder = document.createElement('div');
            placeholder.className = 'text-muted text-center p-3 w-100';
            placeholder.textContent = '???';
            this.component.drops.appendChild(placeholder);
        } else {
            this.component.dropsLock.classList.add('d-none');

            // Aggregate all drops from all monsters in the area
            const allDrops = this.aggregateAreaDrops();

            if (allDrops.size === 0) {
                const placeholder = document.createElement('div');
                placeholder.className = 'text-muted text-center p-3 w-100';
                placeholder.textContent = 'No drops';
                this.component.drops.appendChild(placeholder);
            } else {
                for (const [item, data] of allDrops) {
                    const iconBtn = dropIconPool.acquire();
                    
                    const tooltip = data.type === 'equipment'
                        ? TooltipBuilder.forEquipment(item, this.manager).build()
                        : TooltipBuilder.forMaterial(item, this.manager).build();

                    iconBtn.setIcon({
                        icon: item.media,
                        tooltipContent: tooltip
                    });

                    this.component.drops.appendChild(iconBtn);
                }
            }
        }

        this.renderQueue.drops = false;
    }

    aggregateAreaDrops() {
        const allDrops = new Map();

        if (!this.area.floors) return allDrops;

        // Collect all unique monsters in the area (including bosses)
        const monsters = new Set();
        for (const floor of this.area.floors) {
            // Regular monsters
            if (floor.monsters) {
                for (const entry of floor.monsters) {
                    const monster = this.manager.monsters.getObjectByID(entry.id);
                    if (monster) monsters.add(monster);
                }
            }
            // Exit monsters (bosses)
            if (floor.exit) {
                for (const monsterId of floor.exit) {
                    const monster = this.manager.monsters.getObjectByID(monsterId);
                    if (monster) monsters.add(monster);
                }
            }
        }

        // Aggregate drops from all monsters
        for (const monster of monsters) {
            if (!monster.lootGenerator || !monster.lootGenerator.table) continue;

            const entries = this.expandLootEntries(monster.lootGenerator.table);
            for (const entry of entries) {
                let item = null;
                let type = entry.type;

                switch (entry.type) {
                    case 'currency':
                    case 'salvage':
                    case 'materials':
                        item = this.manager.materials.getObjectByID(entry.id);
                        type = 'material';
                        break;
                    case 'equipment':
                        item = this.manager.baseItems.getObjectByID(entry.id);
                        type = 'equipment';
                        break;
                    case 'equipment_pool':
                        // Handle equipment pools - get all items from the pool
                        const pool = this.manager.equipmentPools.getObjectByID(entry.pool);
                        if (pool && pool.items) {
                            for (const poolEntry of pool.items) {
                                if (poolEntry.item && !allDrops.has(poolEntry.item)) {
                                    allDrops.set(poolEntry.item, { type: 'equipment' });
                                }
                            }
                        }
                        continue;
                }

                if (item && !allDrops.has(item)) {
                    allDrops.set(item, { type });
                }
            }
        }

        return allDrops;
    }

    expandLootEntries(entries) {
        const expanded = [];

        for (const entry of entries) {
            if (entry.type === 'table') {
                const table = this.manager.lootTables.getObjectByID(entry.table);
                if (table) {
                    expanded.push(...this.expandLootEntries(table.getEntries()));
                }
            } else {
                expanded.push(entry);
            }
        }

        return expanded;
    }

    getUnlockLevel(unlockType) {
        return this.getUnlockLevelForCategory('adventuring:areas', unlockType);
    }
}
