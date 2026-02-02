const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');

export class AdventuringSlayersElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-slayers-template');

        this.back = getElementFromFragment(this._content, 'back', 'button');

        this.tabTasks = getElementFromFragment(this._content, 'tab-tasks', 'button');
        this.tabAchievements = getElementFromFragment(this._content, 'tab-achievements', 'button');
        this.tabRuns = getElementFromFragment(this._content, 'tab-runs', 'button');
        this.tabStats = getElementFromFragment(this._content, 'tab-stats', 'button');

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
        this.runsContainer = getElementFromFragment(this._content, 'runs-container', 'div');

        // Stats Tab
        this.statsContent = getElementFromFragment(this._content, 'stats-content', 'div');
        this.globalStatsList = getElementFromFragment(this._content, 'global-stats-list', 'div');
    }
}
window.customElements.define('adventuring-slayers', AdventuringSlayersElement);