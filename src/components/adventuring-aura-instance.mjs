const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringAuraInstanceUIComponent extends AdventuringUIComponent {
    constructor(manager, game,) {
        super(manager, game, 'adventuring-aura-instance-component');

        this.styling = getElementFromFragment(this.$fragment, 'styling', 'div');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');
        this.stacks = getElementFromFragment(this.$fragment, 'stacks', 'small');
        this.border = getElementFromFragment(this.$fragment, 'border', 'div');

        this.tooltip = tippy(this.styling, {
            content: '',
            allowHTML: true,
            hideOnClick: false
        });
    }
}