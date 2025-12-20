const { loadModule } = mod.getContext(import.meta);

export class AdventuringJobSmallElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-job-small-template'));

        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
        this.tooltip = tippy(this.styling, {
            content: '',
            allowHTML: true,
            hideOnClick: false
        });
    }

    disconnectedCallback() {
        if (this.tooltip !== undefined) {
            this.tooltip.destroy();
            this.tooltip = undefined;
        }
    }

    setSkill(skill) {
        this.skill = skill;
    }

    attachSelector(character, type) {
        this.selectorType = type;
        this.selectorCharacter = character;
        this.styling.onclick = () => this.selectorCharacter.locked ? false : this.showSelector();
    }

    showSelector() {
        Swal.fire({
            html: `<div class="row no-gutters"></div>`,
            width: '60%',
            showConfirmButton: false,
            willOpen: ($el) => {
                let jobs;
                if(this.selectorType == 'combatJob') {
                    jobs = this.skill.jobs.allObjects.filter(job => job.unlocked && (job.id == "adventuring:none" || !job.isPassive));
                    jobs = jobs.filter(job => this.selectorCharacter.combatJob === job || job.allowMultiple || !this.skill.party.all.map(member => member.combatJob).includes(job));
                }

                if(this.selectorType == 'passiveJob') {
                    jobs = this.skill.jobs.allObjects.filter(job => job.unlocked && (job.id == "adventuring:none" || job.isPassive));
                    jobs = jobs.filter(job => this.selectorCharacter.passiveJob === job || job.allowMultiple || !this.skill.party.all.map(member => member.passiveJob).includes(job));
                }

                
                let $root = Swal.getHtmlContainer().firstElementChild;
                jobs.forEach(job => {
                    job.summary.mount($root);

                    job.summary.setSelector(this.selectorCharacter, this.selectorType);
                    job.summary.setHighlight(this.selectorCharacter[this.selectorType] === job);

                    job.render();
                });
            }
        });
    }
}
window.customElements.define('adventuring-job-small', AdventuringJobSmallElement);