const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringBuildingUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-building-component');

        this.clickable = getElementFromFragment(this.$fragment, 'clickable', 'div');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');

        this.tooltip = tippy(this.clickable, {
            content: '',
            allowHTML: true,
            hideOnClick: false
        });
    }
}