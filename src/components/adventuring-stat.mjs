const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringStatUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-stat-component');
        
        this.styling = getElementFromFragment(this.$fragment, 'styling', 'div');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');
        this.value = getElementFromFragment(this.$fragment, 'value', 'small');
        this.tooltip = tippy(this.styling, {
            content: '',
            allowHTML: true,
            hideOnClick: false
        });
    }
}