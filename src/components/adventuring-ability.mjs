const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringAbilityUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-ability-component');

        this.styling = getElementFromFragment(this.$fragment, 'styling', 'div');
        this.name = getElementFromFragment(this.$fragment, 'name', 'small');
        this.description = getElementFromFragment(this.$fragment, 'description', 'small');
    }

    setSelector(character, type) {
        this.selectorCharacter = character;
        this.selectorType = type;
    }
}