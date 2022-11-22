const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringJobSmallUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-job-small-component');

        this.styling = getElementFromFragment(this.$fragment, 'styling', 'div');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');
        this.tooltip = tippy(this.styling, {
            content: '',
            allowHTML: true,
            hideOnClick: false
        });
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
                    jobs = this.manager.jobs.allObjects.filter(job => job.unlocked && (job.id == "adventuring:none" || !job.isPassive));
                    jobs = jobs.filter(job => this.selectorCharacter.combatJob === job || job.allowMultiple || !this.manager.party.all.map(member => member.combatJob).includes(job));
                }

                if(this.selectorType == 'passiveJob') {
                    jobs = this.manager.jobs.allObjects.filter(job => job.unlocked && (job.id == "adventuring:none" || job.isPassive));
                    jobs = jobs.filter(job => this.selectorCharacter.passiveJob === job || job.allowMultiple || !this.manager.party.all.map(member => member.passiveJob).includes(job));
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