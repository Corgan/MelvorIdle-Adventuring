const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');
const { AdventuringLevelsUIComponent } = await loadModule('src/components/adventuring-levels.mjs');
const { AdventuringAbilitySmallUIComponent } = await loadModule('src/components/adventuring-ability-small.mjs');
const { AdventuringAbilitiesUIComponent } = await loadModule('src/components/adventuring-abilities.mjs');

export class AdventuringCharacterUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-character-component');

        this.styling = getElementFromFragment(this.$fragment, 'styling', 'div');
        this.name = getElementFromFragment(this.$fragment, 'name', 'h5');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');

        this.splash = new SplashManager(getElementFromFragment(this.$fragment, 'hitpoints-splash', 'div'));
        
        this.hitpoints = getElementFromFragment(this.$fragment, 'hitpoints', 'span');
        this.maxHitpoints = getElementFromFragment(this.$fragment, 'max-hitpoints', 'span');
        this.hitpointsProgress = new ProgressBar(getElementFromFragment(this.$fragment, 'hitpoints-progress', 'div'));

        this.energy = getElementFromFragment(this.$fragment, 'energy', 'span');
        this.maxEnergy = getElementFromFragment(this.$fragment, 'max-energy', 'span');
        this.energyProgress = new ProgressBar(getElementFromFragment(this.$fragment, 'energy-progress', 'div'));

        this.levels = new AdventuringLevelsUIComponent(this.manager, this.game);
        this.levels.mount(getElementFromFragment(this.$fragment, 'levels', 'div'));

        this.abilities = new AdventuringAbilitiesUIComponent(this.manager, this.game);
        this.abilities.mount(getElementFromFragment(this.$fragment, 'abilities', 'div'));

        this.generator = new AdventuringAbilitySmallUIComponent(this.manager, this.game);
        this.generator.mount(this.abilities.container);

        this.spender = new AdventuringAbilitySmallUIComponent(this.manager, this.game);
        this.spender.mount(this.abilities.container);

        this.jobDropdown = getElementFromFragment(this.$fragment, 'job-dropdown', 'div');
        this.job = new DropDown(this.jobDropdown, undefined, ['btn-sm', 'btn-primary'], ['font-size-sm'], true, 60);
        
        this.equipment = getElementFromFragment(this.$fragment, 'equipment', 'div');
    }
}