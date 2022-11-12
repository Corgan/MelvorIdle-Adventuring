const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringDungeonFloorUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-dungeon-floor-component');
        this.floor = getElementFromFragment(this.$fragment, 'floor', 'div');
    }
}