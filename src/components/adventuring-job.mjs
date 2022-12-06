const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringJobUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-job-component');

        this.clickable = getElementFromFragment(this.$fragment, 'clickable', 'div');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');
        this.name = getElementFromFragment(this.$fragment, 'name', 'span');
        this.level = getElementFromFragment(this.$fragment, 'level', 'small');

        this.progressContainer = getElementFromFragment(this.$fragment, 'progress-container', 'div');

        this.masteryProgress = new ProgressBar(getElementFromFragment(this.$fragment, 'mastery-progress', 'div'));

        this.tooltip = tippy(this.clickable, {
            content: '',
            allowHTML: true,
            hideOnClick: false
        });
    }
}