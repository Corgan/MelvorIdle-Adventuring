const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement, createTooltip } = await loadModule('src/core/components/adventuring-tooltip-element.mjs');
const { AdventuringJobSelectorBtnElement } = await loadModule('src/progression/components/adventuring-job-selector-btn.mjs');

export class AdventuringJobSmallElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-job-small-template'));

        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');

        this.selectorPopup = null;
        this._tooltipTarget = this.styling;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.selectorPopup !== undefined) {
            this.selectorPopup.destroy();
            this.selectorPopup = undefined;
        }
    }

    setSkill(skill) {
        this.skill = skill;
    }

    attachSelector(character, type) {
        this.selectorType = type;
        this.selectorCharacter = character;

        this.selectorPopup = createTooltip(this.styling, '', {
            interactive: true,
            trigger: 'click',
            placement: 'bottom',
            maxWidth: 400,
            theme: 'adventuring-selector',
            appendTo: document.body,
            onShow: (instance) => {
                if(this.selectorCharacter.locked) {
                    return false;
                }
                instance.setContent(this.buildSelectorContent());
            },
            onHide: () => {

                if(this.selectorCharacter.renderQueue) {
                    this.selectorCharacter.renderQueue.jobs = true;
                }
            }
        });
    }

    buildSelectorContent() {
        const container = document.createElement('div');
        container.className = 'p-2';

        const header = document.createElement('div');
        header.className = 'text-center mb-2 pb-2 border-bottom border-dark';
        const headerText = document.createElement('strong');
        headerText.className = 'text-white';
        headerText.textContent = this.selectorType === 'combatJob' ? 'Select Combat Job' : 'Select Passive Job';
        header.appendChild(headerText);
        container.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'd-flex flex-wrap justify-content-center';

        const isPassiveSelector = this.selectorType === 'passiveJob';
        const jobProp = isPassiveSelector ? 'passiveJob' : 'combatJob';

        let jobs = this.skill.jobs.allObjects.filter(job =>
            job.unlocked && (job.id === "adventuring:none" || job.isPassive === isPassiveSelector)
        );
        jobs = jobs.filter(job =>
            this.selectorCharacter[jobProp] === job ||
            job.allowMultiple ||
            !this.skill.party.all.map(member => member[jobProp]).includes(job)
        );

        jobs.forEach(job => {
            const jobBtn = this.createJobButton(job);
            grid.appendChild(jobBtn);
        });

        container.appendChild(grid);
        return container;
    }

    createJobButton(job) {
        const isSelected = this.selectorCharacter[this.selectorType] === job;
        const masteryLevel = this.skill.getMasteryLevel(job);

        const btn = new AdventuringJobSelectorBtnElement();
        btn.setJob({
            job,
            masteryLevel,
            isSelected,
            tooltipContent: job.tooltip,
            onSelect: (selectedJob) => this.selectJob(selectedJob)
        });

        return btn;
    }

    selectJob(job) {
        if(this.selectorType === 'combatJob') {
            this.selectorCharacter.setCombatJob(job);
        } else if(this.selectorType === 'passiveJob') {
            this.selectorCharacter.setPassiveJob(job);
        }

        if(this.selectorPopup) {
            this.selectorPopup.hide();
        }
    }

    showSelector() {

        if(this.selectorPopup && !this.selectorCharacter.locked) {
            this.selectorPopup.show();
        }
    }
}
window.customElements.define('adventuring-job-small', AdventuringJobSmallElement);