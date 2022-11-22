const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringMessageUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-message-component');

        this.body = getElementFromFragment(this.$fragment, 'body', 'small');
        this.ts = getElementFromFragment(this.$fragment, 'ts', 'small');
    }
}