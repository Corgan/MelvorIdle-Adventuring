const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringDungeonCellUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-dungeon-cell-component');

        this.styling = getElementFromFragment(this.$fragment, 'styling', 'div');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');
    }
}