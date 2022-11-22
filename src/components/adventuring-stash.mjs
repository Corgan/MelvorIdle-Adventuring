const { loadModule } = mod.getContext(import.meta);

const { AdventuringPageUIComponent } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringStashUIComponent extends AdventuringPageUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-stash-component');
        this.slots = getElementFromFragment(this.$fragment, 'slots', 'div');

        this.trash = getElementFromFragment(this.$fragment, 'trash', 'div');
        this.trashTT = tippy(this.trash, {
            content: 'Trash',
            allowHTML: true,
            hideOnClick: false
        });
    }
}