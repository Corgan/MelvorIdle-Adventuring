// =====================================================
// Run List Item Component
// =====================================================
export class AdventuringRunListItemElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-run-list-item-template'));
        
        this.item = getElementFromFragment(this._content, 'item', 'div');
        this.outcomeIcon = getElementFromFragment(this._content, 'outcomeIcon', 'span');
        this.areaName = getElementFromFragment(this._content, 'areaName', 'span');
        this.difficulty = getElementFromFragment(this._content, 'difficulty', 'small');
        this.turns = getElementFromFragment(this._content, 'turns', 'span');
        this.damage = getElementFromFragment(this._content, 'damage', 'span');
    }
    
    connectedCallback() {
        this.appendChild(this._content);
    }
    
    setRun(run, index, onClick) {
        // Outcome icon
        const outcomeConfig = {
            'completed': { icon: '<i class="fa fa-check"></i>', color: 'text-success' },
            'died': { icon: '<i class="fa fa-skull"></i>', color: 'text-danger' },
            'abandoned': { icon: '<i class="fa fa-sign-out-alt"></i>', color: 'text-warning' }
        };
        const oc = outcomeConfig[run.outcome] || outcomeConfig.abandoned;
        this.outcomeIcon.innerHTML = oc.icon;
        this.outcomeIcon.className = `mr-2 ${oc.color}`;
        
        // Area name
        this.areaName.textContent = run.area?.name || 'Unknown Area';
        
        // Difficulty badge
        this.difficulty.textContent = run.difficulty?.name || 'Normal';
        const diffColors = {
            'Easy': 'badge-success',
            'Normal': 'badge-info', 
            'Hard': 'badge-warning',
            'Endless': 'badge-danger'
        };
        this.difficulty.className = `badge ${diffColors[run.difficulty?.name] || 'badge-secondary'}`;
        
        // Stats
        this.turns.textContent = run.turnsElapsed || 0;
        const totalDamage = this._getTotalDamageDealt(run);
        this.damage.textContent = formatNumber(totalDamage);
        
        // Click handler
        this.item.onclick = () => onClick(run, index);
    }
    
    setSelected(selected) {
        if (selected) {
            this.item.classList.add('border', 'border-info');
        } else {
            this.item.classList.remove('border', 'border-info');
        }
    }
    
    _getTotalDamageDealt(run) {
        let total = 0;
        if (run.byHero) {
            for (const stats of run.byHero.values()) {
                total += stats.damageDealt || 0;
            }
        }
        return total;
    }
}
window.customElements.define('adventuring-run-list-item', AdventuringRunListItemElement);

// =====================================================
// Run Summary Component
// =====================================================
export class AdventuringRunSummaryElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-run-summary-template'));
        
        this.summary = getElementFromFragment(this._content, 'summary', 'div');
        this.areaIcon = getElementFromFragment(this._content, 'areaIcon', 'img');
        this.areaName = getElementFromFragment(this._content, 'areaName', 'h5');
        this.difficulty = getElementFromFragment(this._content, 'difficulty', 'span');
        this.outcome = getElementFromFragment(this._content, 'outcome', 'span');
        this.totalTurns = getElementFromFragment(this._content, 'totalTurns', 'div');
        this.encounterCount = getElementFromFragment(this._content, 'encounterCount', 'div');
        this.partySize = getElementFromFragment(this._content, 'partySize', 'div');
        this.heroStats = getElementFromFragment(this._content, 'heroStats', 'div');
        this.abilityStats = getElementFromFragment(this._content, 'abilityStats', 'div');
        this.monsterStats = getElementFromFragment(this._content, 'monsterStats', 'div');
        this.viewTimeline = getElementFromFragment(this._content, 'viewTimeline', 'button');
    }
    
    connectedCallback() {
        this.appendChild(this._content);
    }
    
    setRun(run, onViewTimeline) {
        // Area info
        this.areaIcon.src = run.area?.media || 'assets/media/main/question.png';
        this.areaName.textContent = run.area?.name || 'Unknown Area';
        
        // Difficulty badge
        this.difficulty.textContent = run.difficulty?.name || 'Normal';
        const diffColors = {
            'Easy': 'badge-success',
            'Normal': 'badge-info',
            'Hard': 'badge-warning', 
            'Endless': 'badge-danger'
        };
        this.difficulty.className = `badge mr-2 ${diffColors[run.difficulty?.name] || 'badge-secondary'}`;
        
        // Outcome badge
        const outcomeConfig = {
            'completed': { text: 'Victory', color: 'badge-success' },
            'died': { text: 'Defeat', color: 'badge-danger' },
            'abandoned': { text: 'Abandoned', color: 'badge-warning' }
        };
        const oc = outcomeConfig[run.outcome] || outcomeConfig.abandoned;
        this.outcome.textContent = oc.text;
        this.outcome.className = `badge ${oc.color}`;
        
        // Summary stats
        this.totalTurns.textContent = run.turnsElapsed || 0;
        this.encounterCount.textContent = run.encounters?.length || 0;
        this.partySize.textContent = run.partySize || 0;
        
        // Hero breakdown
        this._renderHeroStats(run);
        
        // Ability breakdown
        this._renderAbilityStats(run);
        
        // Monster breakdown
        this._renderMonsterStats(run);
        
        // Timeline button
        this.viewTimeline.onclick = () => onViewTimeline(run);
    }
    
    _renderHeroStats(run) {
        this.heroStats.innerHTML = '';
        if (!run.byHero || run.byHero.size === 0) {
            this.heroStats.innerHTML = '<div class="text-muted text-center p-2">No hero data</div>';
            return;
        }
        
        for (const [hero, stats] of run.byHero) {
            const row = createElement('adventuring-hero-stat-row');
            row.setStats(hero, stats);
            this.heroStats.appendChild(row);
        }
    }
    
    _renderAbilityStats(run) {
        this.abilityStats.innerHTML = '';
        if (!run.byAbility || run.byAbility.size === 0) {
            this.abilityStats.innerHTML = '<div class="text-muted text-center p-2">No ability data</div>';
            return;
        }
        
        // Calculate total damage for percentages
        let totalDamage = 0;
        for (const stats of run.byAbility.values()) {
            totalDamage += stats.damage || 0;
        }
        
        // Sort by damage descending, take top 5
        const sorted = [...run.byAbility.entries()]
            .sort((a, b) => (b[1].damage || 0) - (a[1].damage || 0))
            .slice(0, 5);
        
        for (const [ability, stats] of sorted) {
            const row = createElement('adventuring-ability-stat-row');
            row.setStats(ability, stats, totalDamage);
            this.abilityStats.appendChild(row);
        }
    }
    
    _renderMonsterStats(run) {
        this.monsterStats.innerHTML = '';
        if (!run.byMonster || run.byMonster.size === 0) {
            this.monsterStats.innerHTML = '<div class="text-muted text-center p-2">No monster data</div>';
            return;
        }
        
        // Aggregate by monster type (base monster)
        const aggregated = new Map();
        for (const [monster, stats] of run.byMonster) {
            const base = monster.base || monster;
            if (!aggregated.has(base)) {
                aggregated.set(base, { damageTaken: 0, count: 0 });
            }
            const agg = aggregated.get(base);
            agg.damageTaken += stats.damageTaken || 0;
            agg.count++;
        }
        
        for (const [monster, stats] of aggregated) {
            const row = createElement('adventuring-monster-stat-row');
            row.setStats(monster, stats);
            this.monsterStats.appendChild(row);
        }
    }
}
window.customElements.define('adventuring-run-summary', AdventuringRunSummaryElement);

// =====================================================
// Hero Stat Row Component
// =====================================================
export class AdventuringHeroStatRowElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-hero-stat-row-template'));
        
        this.row = getElementFromFragment(this._content, 'row', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.name = getElementFromFragment(this._content, 'name', 'span');
        this.dealt = getElementFromFragment(this._content, 'dealt', 'div');
        this.taken = getElementFromFragment(this._content, 'taken', 'div');
        this.healed = getElementFromFragment(this._content, 'healed', 'div');
    }
    
    connectedCallback() {
        this.appendChild(this._content);
    }
    
    setStats(hero, stats) {
        this.icon.src = hero?.media || hero?.combatJob?.media || 'assets/media/main/question.png';
        this.name.textContent = hero?.name || 'Unknown';
        this.dealt.textContent = formatNumber(stats.damageDealt || 0);
        this.taken.textContent = formatNumber(stats.damageTaken || 0);
        this.healed.textContent = formatNumber(stats.healing || 0);
    }
}
window.customElements.define('adventuring-hero-stat-row', AdventuringHeroStatRowElement);

// =====================================================
// Ability Stat Row Component
// =====================================================
export class AdventuringAbilityStatRowElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-ability-stat-row-template'));
        
        this.row = getElementFromFragment(this._content, 'row', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.name = getElementFromFragment(this._content, 'name', 'span');
        this.uses = getElementFromFragment(this._content, 'uses', 'div');
        this.damage = getElementFromFragment(this._content, 'damage', 'div');
        this.percent = getElementFromFragment(this._content, 'percent', 'div');
    }
    
    connectedCallback() {
        this.appendChild(this._content);
    }
    
    setStats(ability, stats, totalDamage) {
        this.icon.src = ability?.media || 'assets/media/main/question.png';
        this.name.textContent = ability?.name || 'Unknown';
        this.uses.textContent = stats.uses || 0;
        this.damage.textContent = formatNumber(stats.damage || 0);
        const pct = totalDamage > 0 ? Math.round((stats.damage || 0) / totalDamage * 100) : 0;
        this.percent.textContent = `${pct}%`;
    }
}
window.customElements.define('adventuring-ability-stat-row', AdventuringAbilityStatRowElement);

// =====================================================
// Monster Stat Row Component
// =====================================================
export class AdventuringMonsterStatRowElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-monster-stat-row-template'));
        
        this.row = getElementFromFragment(this._content, 'row', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.name = getElementFromFragment(this._content, 'name', 'span');
        this.dealt = getElementFromFragment(this._content, 'dealt', 'div');
    }
    
    connectedCallback() {
        this.appendChild(this._content);
    }
    
    setStats(monster, stats) {
        this.icon.src = monster?.media || 'assets/media/main/question.png';
        const countText = stats.count > 1 ? ` x${stats.count}` : '';
        this.name.textContent = (monster?.name || 'Unknown') + countText;
        this.dealt.textContent = formatNumber(stats.damageTaken || 0);
    }
}
window.customElements.define('adventuring-monster-stat-row', AdventuringMonsterStatRowElement);

// =====================================================
// Encounter Timeline Component (Snake View)
// =====================================================
export class AdventuringEncounterTimelineElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-encounter-timeline-template'));
        
        this.timeline = getElementFromFragment(this._content, 'timeline', 'div');
        this.backToSummary = getElementFromFragment(this._content, 'backToSummary', 'button');
        this.totalTurns = getElementFromFragment(this._content, 'totalTurns', 'div');
        this.totalDealt = getElementFromFragment(this._content, 'totalDealt', 'div');
        this.totalTaken = getElementFromFragment(this._content, 'totalTaken', 'div');
        this.snakeContainer = getElementFromFragment(this._content, 'snakeContainer', 'div');
    }
    
    connectedCallback() {
        this.appendChild(this._content);
    }
    
    setRun(run, onBack, onEncounterClick) {
        this.backToSummary.onclick = onBack;
        
        // Summary stats
        this.totalTurns.textContent = run.turnsElapsed || 0;
        
        let totalDealt = 0, totalTaken = 0;
        if (run.byHero) {
            for (const stats of run.byHero.values()) {
                totalDealt += stats.damageDealt || 0;
                totalTaken += stats.damageTaken || 0;
            }
        }
        this.totalDealt.textContent = formatNumber(totalDealt);
        this.totalTaken.textContent = formatNumber(totalTaken);
        
        // Build snake layout
        this._buildSnake(run, onEncounterClick);
    }
    
    _buildSnake(run, onEncounterClick) {
        this.snakeContainer.innerHTML = '';
        
        const encounters = run.encounters || [];
        if (encounters.length === 0) {
            this.snakeContainer.innerHTML = '<div class="text-muted text-center p-4">No encounter data</div>';
            return;
        }
        
        const tilesPerRow = 4;
        let rowIndex = 0;
        let encounterIndex = 0;
        
        while (encounterIndex < encounters.length) {
            const row = document.createElement('div');
            row.className = 'd-flex align-items-stretch mb-2';
            row.style.gap = '8px';
            row.style.width = '100%';
            
            // Alternate direction for snake effect
            const isReverse = rowIndex % 2 === 1;
            if (isReverse) {
                row.style.flexDirection = 'row-reverse';
            }
            
            // Add tiles for this row
            const rowTiles = [];
            for (let i = 0; i < tilesPerRow && encounterIndex < encounters.length; i++) {
                const enc = encounters[encounterIndex];
                const currentIndex = encounterIndex; // Capture by value for closure
                const tile = createElement('adventuring-encounter-tile');
                tile.setEncounter(enc, currentIndex, () => onEncounterClick(enc, currentIndex));
                rowTiles.push(tile);
                encounterIndex++;
            }
            
            // Add connection lines between tiles
            rowTiles.forEach((tile, i) => {
                row.appendChild(tile);
                if (i < rowTiles.length - 1) {
                    const connector = document.createElement('div');
                    connector.className = 'd-flex align-items-center flex-shrink-0';
                    connector.innerHTML = '<i class="fa fa-arrow-right text-muted"></i>';
                    if (isReverse) {
                        connector.innerHTML = '<i class="fa fa-arrow-left text-muted"></i>';
                    }
                    row.appendChild(connector);
                }
            });
            
            this.snakeContainer.appendChild(row);
            
            // Add vertical connector if more rows coming
            if (encounterIndex < encounters.length) {
                const vertConnector = document.createElement('div');
                vertConnector.className = 'd-flex mb-2';
                // Position arrow at the end where the last tile is
                // For normal rows (0, 2, 4...) last tile is on right
                // For reversed rows (1, 3, 5...) last tile is on left (but visually on right due to reverse)
                vertConnector.style.justifyContent = isReverse ? 'flex-start' : 'flex-end';
                vertConnector.style.paddingRight = isReverse ? '0' : '56px';
                vertConnector.style.paddingLeft = isReverse ? '56px' : '0';
                vertConnector.innerHTML = '<i class="fa fa-arrow-down text-muted"></i>';
                this.snakeContainer.appendChild(vertConnector);
            }
            
            rowIndex++;
        }
    }
}
window.customElements.define('adventuring-encounter-timeline', AdventuringEncounterTimelineElement);

// =====================================================
// Encounter Tile Component
// =====================================================
export class AdventuringEncounterTileElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-encounter-tile-template'));
        
        this.tile = getElementFromFragment(this._content, 'tile', 'div');
        this.tileType = getElementFromFragment(this._content, 'tileType', 'div');
        this.monsters = getElementFromFragment(this._content, 'monsters', 'div');
        this.turns = getElementFromFragment(this._content, 'turns', 'span');
        this.dealt = getElementFromFragment(this._content, 'dealt', 'span');
        this.taken = getElementFromFragment(this._content, 'taken', 'span');
    }
    
    connectedCallback() {
        this.appendChild(this._content);
    }
    
    setEncounter(enc, index, onClick) {
        // Tile styling based on type
        const tileType = enc.tileType || 'encounter';
        const typeConfig = {
            'start': { label: 'Start', bg: 'bg-combat-inner-dark', border: '' },
            'encounter': { label: `#${index + 1}`, bg: 'bg-combat-inner-dark', border: '' },
            'boss': { label: '<i class="fa fa-crown text-warning"></i> Boss', bg: 'bg-combat-inner-dark', border: 'border border-warning' },
            'exit': { label: '<i class="fa fa-sign-out-alt text-info"></i> Exit', bg: 'bg-combat-inner-dark', border: 'border border-info' },
            'special': { label: '<i class="fa fa-gem text-success"></i> Special', bg: 'bg-combat-inner-dark', border: 'border border-success' }
        };
        const config = typeConfig[tileType] || typeConfig.encounter;
        this.tile.className = `block block-rounded text-center p-2 pointer-enabled ${config.bg} ${config.border}`;
        // Fixed width calc: (100% - 3 arrows*16px - 6 gaps*8px) / 4 tiles
        this.tile.style.cssText = 'flex: 0 0 calc((100% - 96px) / 4); min-height: 100px; cursor: pointer;';
        this.tileType.innerHTML = config.label;
        
        // Monster icons
        this.monsters.innerHTML = '';
        if (enc.byMonster && enc.byMonster.size > 0) {
            for (const [monster] of enc.byMonster) {
                const img = document.createElement('img');
                img.src = monster.base?.media || monster.media || 'assets/media/main/question.png';
                img.className = 'skill-icon-xxs';
                img.style.cssText = 'width: 24px; height: 24px;';
                this.monsters.appendChild(img);
            }
        }
        
        // Stats
        this.turns.textContent = enc.turnsElapsed || 0;
        
        let dealt = 0, taken = 0;
        if (enc.byHero) {
            for (const stats of enc.byHero.values()) {
                dealt += stats.damageDealt || 0;
                taken += stats.damageTaken || 0;
            }
        }
        this.dealt.textContent = formatNumber(dealt);
        this.taken.textContent = formatNumber(taken);
        
        // Click handler
        this.tile.onclick = onClick;
    }
}
window.customElements.define('adventuring-encounter-tile', AdventuringEncounterTileElement);

// =====================================================
// Encounter Detail Component
// =====================================================
export class AdventuringEncounterDetailElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-encounter-detail-template'));
        
        this.detail = getElementFromFragment(this._content, 'detail', 'div');
        this.backToTimeline = getElementFromFragment(this._content, 'backToTimeline', 'button');
        this.encounterNum = getElementFromFragment(this._content, 'encounterNum', 'span');
        this.tileType = getElementFromFragment(this._content, 'tileType', 'span');
        this.turns = getElementFromFragment(this._content, 'turns', 'div');
        this.dealt = getElementFromFragment(this._content, 'dealt', 'div');
        this.taken = getElementFromFragment(this._content, 'taken', 'div');
        this.healed = getElementFromFragment(this._content, 'healed', 'div');
        this.heroBreakdown = getElementFromFragment(this._content, 'heroBreakdown', 'div');
        this.enemyBreakdown = getElementFromFragment(this._content, 'enemyBreakdown', 'div');
        this.abilityBreakdown = getElementFromFragment(this._content, 'abilityBreakdown', 'div');
    }
    
    connectedCallback() {
        this.appendChild(this._content);
    }
    
    setEncounter(enc, index, onBack) {
        this.backToTimeline.onclick = onBack;
        this.encounterNum.textContent = `#${index + 1}`;
        
        // Tile type badge
        const tileType = enc.tileType || 'encounter';
        const typeConfig = {
            'encounter': { text: 'Combat', color: 'badge-secondary' },
            'boss': { text: 'Boss', color: 'badge-warning' },
            'exit': { text: 'Exit', color: 'badge-info' },
            'special': { text: 'Special', color: 'badge-success' }
        };
        const config = typeConfig[tileType] || typeConfig.encounter;
        this.tileType.textContent = config.text;
        this.tileType.className = `badge ml-2 ${config.color}`;
        
        // Summary stats
        this.turns.textContent = enc.turnsElapsed || 0;
        
        let dealt = 0, taken = 0, healed = 0;
        if (enc.byHero) {
            for (const stats of enc.byHero.values()) {
                dealt += stats.damageDealt || 0;
                taken += stats.damageTaken || 0;
                healed += stats.healing || 0;
            }
        }
        this.dealt.textContent = formatNumber(dealt);
        this.taken.textContent = formatNumber(taken);
        this.healed.textContent = formatNumber(healed);
        
        // Hero breakdown
        this._renderHeroes(enc);
        
        // Enemy breakdown
        this._renderEnemies(enc);
        
        // Ability breakdown
        this._renderAbilities(enc);
    }
    
    _renderHeroes(enc) {
        this.heroBreakdown.innerHTML = '';
        if (!enc.byHero || enc.byHero.size === 0) {
            this.heroBreakdown.innerHTML = '<div class="text-muted text-center p-2">No hero data</div>';
            return;
        }
        
        for (const [hero, stats] of enc.byHero) {
            const row = createElement('adventuring-hero-stat-row');
            row.setStats(hero, stats);
            this.heroBreakdown.appendChild(row);
        }
    }
    
    _renderEnemies(enc) {
        this.enemyBreakdown.innerHTML = '';
        if (!enc.byMonster || enc.byMonster.size === 0) {
            this.enemyBreakdown.innerHTML = '<div class="text-muted text-center p-2">No enemy data</div>';
            return;
        }
        
        for (const [monster, stats] of enc.byMonster) {
            const row = createElement('adventuring-monster-stat-row');
            row.setStats(monster.base || monster, stats);
            this.enemyBreakdown.appendChild(row);
        }
    }
    
    _renderAbilities(enc) {
        this.abilityBreakdown.innerHTML = '';
        if (!enc.byAbility || enc.byAbility.size === 0) {
            this.abilityBreakdown.innerHTML = '<div class="text-muted text-center p-2">No ability data</div>';
            return;
        }
        
        // Calculate total damage for percentages
        let totalDamage = 0;
        for (const stats of enc.byAbility.values()) {
            totalDamage += stats.damage || 0;
        }
        
        // Sort by damage descending
        const sorted = [...enc.byAbility.entries()]
            .sort((a, b) => (b[1].damage || 0) - (a[1].damage || 0));
        
        for (const [ability, stats] of sorted) {
            const row = createElement('adventuring-ability-stat-row');
            row.setStats(ability, stats, totalDamage);
            this.abilityBreakdown.appendChild(row);
        }
    }
}
window.customElements.define('adventuring-encounter-detail', AdventuringEncounterDetailElement);

// =====================================================
// Main Run History Page Component
// =====================================================
class RunHistoryRenderQueue {
    constructor() {
        this.list = false;
        this.detail = false;
        this.all = false;
    }
    queueAll() {
        this.list = true;
        this.detail = true;
        this.all = true;
    }
    clear() {
        this.list = false;
        this.detail = false;
        this.all = false;
    }
}

export class AdventuringRunHistoryElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-run-history-template'));
        
        this.page = getElementFromFragment(this._content, 'page', 'div');
        this.header = getElementFromFragment(this._content, 'header', 'div');
        this.back = getElementFromFragment(this._content, 'back', 'button');
        this.runCount = getElementFromFragment(this._content, 'runCount', 'small');
        this.clearAll = getElementFromFragment(this._content, 'clearAll', 'button');
        this.leftColumn = getElementFromFragment(this._content, 'leftColumn', 'div');
        this.rightColumn = getElementFromFragment(this._content, 'rightColumn', 'div');
        this.runList = getElementFromFragment(this._content, 'runList', 'div');
        this.emptyState = getElementFromFragment(this._content, 'emptyState', 'div');
        this.detailPanel = getElementFromFragment(this._content, 'detailPanel', 'div');
        
        this._selectedIndex = -1;
        this._currentView = 'summary'; // 'summary' | 'timeline' | 'detail'
        this._currentRun = null;
        this._currentEncounter = null;
        this._currentEncounterIndex = -1;
        this._embedded = false;
        this._lastHistoryLength = -1;
        
        this.renderQueue = new RunHistoryRenderQueue();
    }
    
    connectedCallback() {
        this.appendChild(this._content);
    }
    
    setEmbedded(embedded) {
        this._embedded = embedded;
        if (embedded) {
            this.header.classList.add('d-none');
            this.page.classList.remove('d-none');
        }
    }
    
    mount(parent) {
        parent.append(this);
    }
    
    init(manager) {
        this.manager = manager;
        
        this.back.onclick = () => {
            this.manager.overview.go();
        };
        
        this.clearAll.onclick = () => {
            if (confirm('Clear all run history?')) {
                this.manager.combatTracker.clearHistory();
                this.renderQueue.queueAll();
                this.render();
            }
        };
    }
    
    show() {
        this.page.classList.remove('d-none');
        this.renderQueue.queueAll();
        this.render();
    }
    
    hide() {
        this.page.classList.add('d-none');
    }
    
    render() {
        const history = this.manager.combatTracker.history || [];
        
        // Check if history changed - auto-queue list render if so
        if (history.length !== this._lastHistoryLength) {
            this.renderQueue.list = true;
            this._lastHistoryLength = history.length;
        }
        
        // Update count (always cheap)
        this.runCount.textContent = `${history.length} runs`;
        
        // Handle empty state
        if (history.length === 0) {
            this.emptyState.classList.remove('d-none');
            this.runList.classList.add('d-none');
            this.detailPanel.innerHTML = '';
            this.renderQueue.clear();
            return;
        }
        
        this.emptyState.classList.add('d-none');
        this.runList.classList.remove('d-none');
        
        // Render list if queued
        if (this.renderQueue.list || this.renderQueue.all) {
            this._renderList(history);
            this.renderQueue.list = false;
        }
        
        // Render detail panel if queued
        if (this.renderQueue.detail || this.renderQueue.all) {
            // Auto-select first if nothing selected
            if (this._selectedIndex < 0 && history.length > 0) {
                this._selectRun(history[history.length - 1], history.length - 1);
            } else if (this._currentRun) {
                this._renderDetailPanel();
            }
            this.renderQueue.detail = false;
        }
        
        this.renderQueue.all = false;
    }
    
    _renderList(history) {
        this.runList.innerHTML = '';
        const reversed = [...history].reverse();
        reversed.forEach((run, i) => {
            const realIndex = history.length - 1 - i;
            const item = createElement('adventuring-run-list-item');
            item.setRun(run, realIndex, (r, idx) => this._selectRun(r, idx));
            item.setSelected(realIndex === this._selectedIndex);
            this.runList.appendChild(item);
        });
    }
    
    _selectRun(run, index) {
        this._selectedIndex = index;
        this._currentRun = run;
        this._currentView = 'summary';
        
        // Update selection highlighting
        const items = this.runList.querySelectorAll('adventuring-run-list-item');
        const history = this.manager.combatTracker.history || [];
        items.forEach((item, i) => {
            const realIndex = history.length - 1 - i;
            item.setSelected(realIndex === index);
        });
        
        this._renderDetailPanel();
    }
    
    _renderDetailPanel() {
        this.detailPanel.innerHTML = '';
        
        if (!this._currentRun) return;
        
        // Hide left column on timeline/detail views, expand right column
        const showSidebar = this._currentView === 'summary';
        this.leftColumn.classList.toggle('d-none', !showSidebar);
        this.rightColumn.classList.toggle('col-md-8', showSidebar);
        this.rightColumn.classList.toggle('col-md-12', !showSidebar);
        
        switch (this._currentView) {
            case 'summary':
                this._renderSummary();
                break;
            case 'timeline':
                this._renderTimeline();
                break;
            case 'detail':
                this._renderEncounterDetail();
                break;
        }
    }
    
    _renderSummary() {
        const summary = createElement('adventuring-run-summary');
        summary.setRun(this._currentRun, () => {
            this._currentView = 'timeline';
            this._renderDetailPanel();
        });
        this.detailPanel.appendChild(summary);
    }
    
    _renderTimeline() {
        const timeline = createElement('adventuring-encounter-timeline');
        timeline.setRun(
            this._currentRun,
            () => {
                this._currentView = 'summary';
                this._renderDetailPanel();
            },
            (enc, idx) => {
                this._currentEncounter = enc;
                this._currentEncounterIndex = idx;
                this._currentView = 'detail';
                this._renderDetailPanel();
            }
        );
        this.detailPanel.appendChild(timeline);
    }
    
    _renderEncounterDetail() {
        const detail = createElement('adventuring-encounter-detail');
        detail.setEncounter(
            this._currentEncounter,
            this._currentEncounterIndex,
            () => {
                this._currentView = 'timeline';
                this._renderDetailPanel();
            }
        );
        this.detailPanel.appendChild(detail);
    }
}
window.customElements.define('adventuring-run-history', AdventuringRunHistoryElement);
