const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringEquipmentSlotUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-equipment-slot-component');

        this.clickable = getElementFromFragment(this.$fragment, 'clickable', 'div');
        this.border = getElementFromFragment(this.$fragment, 'border', 'div');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');
        this.upgrade = getElementFromFragment(this.$fragment, 'upgrade', 'small');

        this.tooltip = tippy(this.clickable, {
            content: '',
            allowHTML: true,
            hideOnClick: false
        });
    }
}