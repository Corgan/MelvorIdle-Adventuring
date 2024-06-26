const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringMonsterUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-monster-component');

        this.clickable = getElementFromFragment(this.$fragment, 'clickable', 'div');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');
        this.name = getElementFromFragment(this.$fragment, 'name', 'span');
        this.level = getElementFromFragment(this.$fragment, 'level', 'small');
        
        this.progressContainer = getElementFromFragment(this.$fragment, 'progress-container', 'div');

        this.masteryProgress = getElementFromFragment(this.$fragment, 'mastery-progress', 'progress-bar');

        this.tooltip = tippy(this.clickable, {
            content: '',
            allowHTML: true,
            hideOnClick: false
        });
    }
}