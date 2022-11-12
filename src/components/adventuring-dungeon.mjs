const { loadModule } = mod.getContext(import.meta);

const { AdventuringPageUIComponent } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringDungeonUIComponent extends AdventuringPageUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-dungeon-component');
        
        this.dungeon = getElementFromFragment(this.$fragment, 'dungeon', 'div');
    }
}