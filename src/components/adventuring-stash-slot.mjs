const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringStashSlotUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-stash-slot-component');
        
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');
        this.tooltip = tippy(this.icon, {
            content: '',
            allowHTML: true,
            hideOnClick: false
        });
    }
}