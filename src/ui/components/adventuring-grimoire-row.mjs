const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

export class AdventuringGrimoireRowElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-grimoire-row-template'));

        this.row = getElementFromFragment(this._content, 'row', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
        this.badge = getElementFromFragment(this._content, 'badge', 'span');
        this.chevron = getElementFromFragment(this._content, 'chevron', 'i');

        this._tooltipTarget = this.row;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    setArea({ icon, name, count, onClick, showChevron = true }) {
        this.icon.src = icon;
        this.icon.style.display = '';
        this.nameText.textContent = name;
        this.nameText.className = 'font-size-sm font-w600';

        this.badge.textContent = count;
        this.badge.className = `ml-auto badge ${count > 0 ? 'badge-success' : 'badge-secondary'} font-size-xs`;

        this.chevron.classList.toggle('d-none', !showChevron);
        this.row.className = 'd-flex align-items-center p-2 bg-combat-inner-dark rounded mb-1 pointer-enabled';
        this.row.style.cursor = 'pointer';
        this.row.onclick = onClick || null;
    }

    setSlayerAbility({ icon, name, isLearned, isEquipped, isSeen, onClick, tooltipContent }) {
        if(!isSeen || !icon) {
            this.icon.style.display = 'none';
            let question = this.row.querySelector('.fa-question');
            if(!question) {
                question = document.createElement('i');
                question.className = 'fa fa-question text-muted';
                question.style.cssText = 'width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 16px; margin-right: 0.5rem;';
                this.row.insertBefore(question, this.nameText);
            }
        } else {
            this.icon.src = icon;
            this.icon.style.display = '';
        }
        this.nameText.textContent = isSeen ? name : '???';
        this.nameText.className = isSeen ? 'font-size-sm' : 'font-size-sm text-muted';
        if(isLearned) {
            this.badge.textContent = 'Learned';
            this.badge.className = 'ml-auto badge badge-success font-size-xs';
            this.badge.innerHTML = '';
        } else if(isSeen) {
            this.badge.textContent = '';
            this.badge.className = 'ml-auto';
            this.badge.innerHTML = '<i class="fa fa-lock text-muted"></i>';
        } else {
            this.badge.textContent = '';
            this.badge.className = 'ml-auto';
            this.badge.innerHTML = '';
        }
        this.chevron.classList.add('d-none');
        if(isLearned) {
            this.row.className = 'd-flex align-items-center p-2 bg-combat-inner-dark rounded mb-1 pointer-enabled';
            this.row.style.cursor = 'pointer';
            this.row.style.opacity = '';
            if(isEquipped) {
                this.row.classList.add('border', 'border-success');
            }
        } else {
            this.row.className = 'd-flex align-items-center p-2 bg-secondary rounded mb-1';
            this.row.style.opacity = '0.6';
            this.row.style.cursor = '';
        }
        this.row.onclick = (isLearned && onClick) ? onClick : null;
        if(tooltipContent && isSeen) {
            this.setTooltipContent(tooltipContent);
        }
    }

    setAbility({ icon, name, isLearned, isEquipped, isLocked, onClick, tooltipContent }) {
        if(isLocked || !icon) {
            this.icon.style.display = 'none';
            let question = this.row.querySelector('.fa-question');
            if(!question) {
                question = document.createElement('i');
                question.className = 'fas fa-question text-muted skill-icon-xs mr-2';
                this.row.insertBefore(question, this.nameText);
            }
        } else {
            this.icon.src = icon;
            this.icon.style.display = '';
        }
        this.nameText.textContent = name;
        this.nameText.className = isLocked ? 'font-size-sm text-muted' : 'font-size-sm font-w600';
        if(isEquipped) {
            this.badge.textContent = 'Equipped';
            this.badge.className = 'ml-auto badge badge-info font-size-xs';
        } else if(isLearned) {
            this.badge.textContent = 'Learned';
            this.badge.className = 'ml-auto badge badge-success font-size-xs';
        } else if(isLocked) {
            this.badge.className = 'ml-auto';
            this.badge.innerHTML = '<i class="fas fa-lock text-warning"></i>';
        } else {
            this.badge.textContent = '';
            this.badge.className = 'ml-auto';
        }
        this.chevron.classList.add('d-none');
        this.row.onclick = onClick || null;
        this.row.classList.toggle('pointer-enabled', !!onClick && !isLocked);
        if(tooltipContent) {
            this.setTooltipContent(tooltipContent);
        }
    }
}
window.customElements.define('adventuring-grimoire-row', AdventuringGrimoireRowElement);
