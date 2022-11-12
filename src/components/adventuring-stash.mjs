const { loadModule } = mod.getContext(import.meta);

const { AdventuringPageUIComponent } = await loadModule('src/components/adventuring-page.mjs');
const { AdventuringLevelsUIComponent } = await loadModule('src/components/adventuring-levels.mjs');

export class AdventuringStashUIComponent extends AdventuringPageUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-stash-component');
        this.slots = getElementFromFragment(this.$fragment, 'slots', 'div');
        this.details = getElementFromFragment(this.$fragment, 'details', 'div');

        this.trash = getElementFromFragment(this.$fragment, 'trash', 'div');
        this.trashTT = tippy(this.trash, {
            content: 'Trash',
            allowHTML: true,
            hideOnClick: false
        });

        this.name = getElementFromFragment(this.$fragment, 'name', 'h5');

        this.levels = new AdventuringLevelsUIComponent(this.manager, this.game);
        this.levels.mount(getElementFromFragment(this.$fragment, 'levels', 'div'));
    }
}