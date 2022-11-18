const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringEquipmentUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-equipment-component');
        this.equipment = getElementFromFragment(this.$fragment, 'equipment', 'div');
    }
}