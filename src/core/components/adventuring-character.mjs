const { loadModule } = mod.getContext(import.meta);

const { AdventuringAbilitiesElement } = await loadModule('src/combat/components/adventuring-abilities.mjs');
const { AdventuringAbilitySmallElement } = await loadModule('src/combat/components/adventuring-ability-small.mjs');

const { AdventuringJobsElement } = await loadModule('src/progression/components/adventuring-jobs.mjs');
const { AdventuringJobSmallElement } = await loadModule('src/progression/components/adventuring-job-small.mjs');

export class AdventuringCharacterElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-character-template'));

        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.nameText = getElementFromFragment(this._content, 'name', 'h5');
        this.icon = getElementFromFragment(this._content, 'icon', 'div');

        this.hitpointsSplash = getElementFromFragment(this._content, 'hitpoints-splash', 'div');
        
        this.hitpoints = getElementFromFragment(this._content, 'hitpoints', 'span');
        this.maxHitpoints = getElementFromFragment(this._content, 'max-hitpoints', 'span');
        this.hitpointsProgress = getElementFromFragment(this._content, 'hitpoints-progress', 'progress-bar');

        this.energy = getElementFromFragment(this._content, 'energy', 'span');
        this.maxEnergy = getElementFromFragment(this._content, 'max-energy', 'span');
        this.energyProgress = getElementFromFragment(this._content, 'energy-progress', 'progress-bar');

        this.auras = getElementFromFragment(this._content, 'auras', 'div');
        this.stats = getElementFromFragment(this._content, 'stats', 'div');

        // Passive abilities section
        this.passiveAbilitiesContainer = getElementFromFragment(this._content, 'passive-abilities', 'div');
        this.passiveAbilitiesList = getElementFromFragment(this._content, 'passive-abilities-list', 'div');

        this.abilitiesContainer = getElementFromFragment(this._content, 'abilities', 'div');
        this.abilities = createElement('adventuring-abilities');

        this.generator = createElement('adventuring-ability-small');
        this.spender = createElement('adventuring-ability-small');

        this.jobsContainer = getElementFromFragment(this._content, 'jobs', 'div');
        this.jobs = createElement('adventuring-jobs');

        this.combatJob = createElement('adventuring-job-small');
        this.passiveJob = createElement('adventuring-job-small');
        
        this.equipment = getElementFromFragment(this._content, 'equipment', 'div');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
        this.splash = new SplashManager(this.hitpointsSplash);
        
        this.abilitiesContainer.appendChild(this.abilities);
        this.abilities.container.appendChild(this.generator);
        this.abilities.container.appendChild(this.spender);
        // Move passive abilities to after the abilities element
        this.abilitiesContainer.appendChild(this.passiveAbilitiesContainer);

        this.jobsContainer.appendChild(this.jobs);
        this.jobs.container.appendChild(this.combatJob);
        this.jobs.container.appendChild(this.passiveJob);
        this.jobs.hide();
    }

    /**
     * Set callback for when name is clicked (enables clickable name styling)
     */
    setNameClickHandler(callback) {
        this._onNameClick = callback;
        if(callback) {
            this.nameText.classList.add('pointer-enabled');
            this.nameText.style.cursor = 'pointer';
            this.nameText.onclick = () => callback();
        } else {
            this.nameText.classList.remove('pointer-enabled');
            this.nameText.style.cursor = '';
            this.nameText.onclick = null;
        }
    }

    setSkill(skill) {
        this.skill = skill;
        this.generator.setSkill(skill);
        this.spender.setSkill(skill);
        this.combatJob.setSkill(skill);
        this.passiveJob.setSkill(skill);
    }

    setCharacter(character) {
        this.generator.setCharacter(character);
        this.spender.setCharacter(character);
    }
}
window.customElements.define('adventuring-character', AdventuringCharacterElement);