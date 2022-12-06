const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringMaterialUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-material-component');

        this.clickable = getElementFromFragment(this.$fragment, 'clickable', 'div');
        this.border = getElementFromFragment(this.$fragment, 'border', 'div');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');
        this.count = getElementFromFragment(this.$fragment, 'count', 'small');

        this.tooltip = tippy(this.clickable, {
            content: '',
            allowHTML: true,
            hideOnClick: false
        });
    }
}