const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringLevelsUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-levels-component');

        this.skills = {
            Hitpoints: getElementFromFragment(this.$fragment, 'hitpoints', 'small'),
            Attack: getElementFromFragment(this.$fragment, 'attack', 'small'),
            Strength: getElementFromFragment(this.$fragment, 'strength', 'small'),
            Defence: getElementFromFragment(this.$fragment, 'defence', 'small'),
            Ranged: getElementFromFragment(this.$fragment, 'ranged', 'small'),
            Magic: getElementFromFragment(this.$fragment, 'magic', 'small'),
            Prayer: getElementFromFragment(this.$fragment, 'prayer', 'small'),
            Agility: getElementFromFragment(this.$fragment, 'agility', 'small'),
        };
    }
}