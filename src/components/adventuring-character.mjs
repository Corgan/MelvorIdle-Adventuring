const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

const { AdventuringAbilitiesUIComponent } = await loadModule('src/components/adventuring-abilities.mjs');
const { AdventuringAbilitySmallUIComponent } = await loadModule('src/components/adventuring-ability-small.mjs');

const { AdventuringJobsUIComponent } = await loadModule('src/components/adventuring-jobs.mjs');
const { AdventuringJobSmallUIComponent } = await loadModule('src/components/adventuring-job-small.mjs');

export class AdventuringCharacterUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-character-component');

        this.styling = getElementFromFragment(this.$fragment, 'styling', 'div');
        this.name = getElementFromFragment(this.$fragment, 'name', 'h5');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'div');

        this.splash = new SplashManager(getElementFromFragment(this.$fragment, 'hitpoints-splash', 'div'));
        
        this.hitpoints = getElementFromFragment(this.$fragment, 'hitpoints', 'span');
        this.maxHitpoints = getElementFromFragment(this.$fragment, 'max-hitpoints', 'span');
        this.hitpointsProgress = new ProgressBar(getElementFromFragment(this.$fragment, 'hitpoints-progress', 'div'));

        this.energy = getElementFromFragment(this.$fragment, 'energy', 'span');
        this.maxEnergy = getElementFromFragment(this.$fragment, 'max-energy', 'span');
        this.energyProgress = new ProgressBar(getElementFromFragment(this.$fragment, 'energy-progress', 'div'));

        this.auras = getElementFromFragment(this.$fragment, 'auras', 'div');

        this.stats = getElementFromFragment(this.$fragment, 'stats', 'div');

        this.abilities = new AdventuringAbilitiesUIComponent(this.manager, this.game, this);
        this.abilities.mount(getElementFromFragment(this.$fragment, 'abilities', 'div'));

        this.generator = new AdventuringAbilitySmallUIComponent(this.manager, this.game, this);
        this.generator.mount(this.abilities.container);

        this.spender = new AdventuringAbilitySmallUIComponent(this.manager, this.game, this);
        this.spender.mount(this.abilities.container);

        this.jobs = new AdventuringJobsUIComponent(this.manager, this.game, this);
        this.jobs.mount(getElementFromFragment(this.$fragment, 'jobs', 'div'));
        this.jobs.hide();

        this.combatJob = new AdventuringJobSmallUIComponent(this.manager, this.game, this);
        this.combatJob.mount(this.jobs.container);

        this.passiveJob = new AdventuringJobSmallUIComponent(this.manager, this.game, this);
        this.passiveJob.mount(this.jobs.container);
        
        this.equipment = getElementFromFragment(this.$fragment, 'equipment', 'div');
    }
}