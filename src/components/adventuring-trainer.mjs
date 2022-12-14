const { loadModule } = mod.getContext(import.meta);

const { AdventuringPageUIComponent } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringTrainerUIComponent extends AdventuringPageUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-trainer-component');

        this.back = getElementFromFragment(this.$fragment, 'back', 'button');

        this.jobs = getElementFromFragment(this.$fragment, 'jobs', 'div');
    }
}