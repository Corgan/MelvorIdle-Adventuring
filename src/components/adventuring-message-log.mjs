const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringMessageLogUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-message-log-component');
        
        this.messages = getElementFromFragment(this.$fragment, 'messages', 'div');
    }
}