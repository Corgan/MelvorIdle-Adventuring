export class AdventuringJobSmallElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-job-small-template'));

        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        
        this.selectorPopup = null;
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
        
        // Create click-triggered popup for job selection
        this.selectorPopup = tippy(this.styling, {
            content: '',
            allowHTML: true,
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
                // Re-render character to update display
                if(this.selectorCharacter.renderQueue) {
                    this.selectorCharacter.renderQueue.jobs = true;
                }
            }
        });
    }

    buildSelectorContent() {
        const container = document.createElement('div');
        container.className = 'p-2';
        
        // Header
        const header = document.createElement('div');
        header.className = 'text-center mb-2 pb-2 border-bottom border-dark';
        header.innerHTML = `<strong class="text-white">${this.selectorType === 'combatJob' ? 'Select Combat Job' : 'Select Passive Job'}</strong>`;
        container.appendChild(header);
        
        // Job grid
        const grid = document.createElement('div');
        grid.className = 'd-flex flex-wrap justify-content-center';
        
        let jobs;
        if(this.selectorType === 'combatJob') {
            jobs = this.skill.jobs.allObjects.filter(job => job.unlocked && (job.id === "adventuring:none" || !job.isPassive));
            jobs = jobs.filter(job => this.selectorCharacter.combatJob === job || job.allowMultiple || !this.skill.party.all.map(member => member.combatJob).includes(job));
        }
        if(this.selectorType === 'passiveJob') {
            jobs = this.skill.jobs.allObjects.filter(job => job.unlocked && (job.id === "adventuring:none" || job.isPassive));
            jobs = jobs.filter(job => this.selectorCharacter.passiveJob === job || job.allowMultiple || !this.skill.party.all.map(member => member.passiveJob).includes(job));
        }
        
        jobs.forEach(job => {
            const jobBtn = this.createJobButton(job);
            grid.appendChild(jobBtn);
        });
        
        container.appendChild(grid);
        return container;
    }

    createJobButton(job) {
        const wrapper = document.createElement('div');
        wrapper.className = 'position-relative m-1';
        
        const isSelected = this.selectorCharacter[this.selectorType] === job;
        
        const btn = document.createElement('div');
        btn.className = `d-flex flex-column align-items-center p-2 rounded pointer-enabled ${isSelected ? 'adventuring-selected' : 'bg-combat-inner-dark'}`;
        btn.style.width = '60px';
        btn.style.cursor = 'pointer';
        
        const icon = document.createElement('img');
        icon.className = 'skill-icon-xs mb-1';
        icon.src = job.media;
        btn.appendChild(icon);
        
        const name = document.createElement('small');
        name.className = 'text-white text-center';
        name.style.fontSize = '10px';
        name.style.lineHeight = '1.1';
        name.textContent = job.name;
        btn.appendChild(name);
        
        const level = document.createElement('small');
        level.className = 'text-muted';
        level.style.fontSize = '9px';
        level.textContent = `Lv.${this.skill.getMasteryLevel(job)}`;
        btn.appendChild(level);
        
        // Click to select
        btn.onclick = (e) => {
            e.stopPropagation();
            this.selectJob(job);
        };
        
        // Hover tooltip with job details
        tippy(btn, {
            content: job.tooltip,
            allowHTML: true,
            placement: 'top',
            delay: [200, 0]
        });
        
        wrapper.appendChild(btn);
        return wrapper;
    }

    selectJob(job) {
        if(this.selectorType === 'combatJob') {
            this.selectorCharacter.setCombatJob(job);
        } else if(this.selectorType === 'passiveJob') {
            this.selectorCharacter.setPassiveJob(job);
        }
        // Close the popup
        if(this.selectorPopup) {
            this.selectorPopup.hide();
        }
    }

    showSelector() {
        // Legacy method - now handled by tippy popup
        if(this.selectorPopup && !this.selectorCharacter.locked) {
            this.selectorPopup.show();
        }
    }
}
window.customElements.define('adventuring-job-small', AdventuringJobSmallElement);