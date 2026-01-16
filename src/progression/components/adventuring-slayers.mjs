const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');

export class AdventuringSlayersElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-slayers-template');

        this.back = getElementFromFragment(this._content, 'back', 'button');

        this.tabTasks = getElementFromFragment(this._content, 'tab-tasks', 'button');
        this.tabAchievements = getElementFromFragment(this._content, 'tab-achievements', 'button');
        this.tabRuns = getElementFromFragment(this._content, 'tab-runs', 'button');
        this.achievementsBadge = getElementFromFragment(this._content, 'achievements-badge', 'span');

        this.tasksContent = getElementFromFragment(this._content, 'tasks-content', 'div');
        this.activeTasks = getElementFromFragment(this._content, 'active-tasks', 'div');
        this.availableTasks = getElementFromFragment(this._content, 'available-tasks', 'div');
        this.refreshButton = getElementFromFragment(this._content, 'refresh-button', 'button');
        this.refreshCost = getElementFromFragment(this._content, 'refresh-cost', 'span');

        this.achievementsContent = getElementFromFragment(this._content, 'achievements-content', 'div');
        this.achievementSummary = getElementFromFragment(this._content, 'achievement-summary', 'span');
        this.achievementProgressBar = getElementFromFragment(this._content, 'achievement-progress-bar', 'div');
        this.achievementStats = getElementFromFragment(this._content, 'achievement-stats', 'div');
        this.achievementCategoryFilter = getElementFromFragment(this._content, 'achievement-category-filter', 'div');
        this.achievementList = getElementFromFragment(this._content, 'achievement-list', 'div');

        // Run History Tab
        this.runsContent = getElementFromFragment(this._content, 'runs-content', 'div');
        this.runsListView = getElementFromFragment(this._content, 'runs-list-view', 'div');
        this.runsList = getElementFromFragment(this._content, 'runs-list', 'div');
        this.runsDetailsView = getElementFromFragment(this._content, 'runs-details-view', 'div');
        this.runsBackBtn = getElementFromFragment(this._content, 'runs-back-btn', 'button');
        this.runDetailTitle = getElementFromFragment(this._content, 'run-detail-title', 'h5');
        this.runDetailSubtitle = getElementFromFragment(this._content, 'run-detail-subtitle', 'small');
        this.runDetailBadges = getElementFromFragment(this._content, 'run-detail-badges', 'div');
        this.runStatDamageDealt = getElementFromFragment(this._content, 'run-stat-damage-dealt', 'div');
        this.runStatDamageTaken = getElementFromFragment(this._content, 'run-stat-damage-taken', 'div');
        this.runStatHealing = getElementFromFragment(this._content, 'run-stat-healing', 'div');
        this.runStatTurns = getElementFromFragment(this._content, 'run-stat-turns', 'div');
        this.runDetailAbilities = getElementFromFragment(this._content, 'run-detail-abilities', 'div');
        this.runDetailMonsters = getElementFromFragment(this._content, 'run-detail-monsters', 'div');
        this.runDetailEncounters = getElementFromFragment(this._content, 'run-detail-encounters', 'div');
    }
}
window.customElements.define('adventuring-slayers', AdventuringSlayersElement);