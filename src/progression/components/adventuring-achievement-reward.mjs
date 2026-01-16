
export class AdventuringAchievementRewardElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-achievement-reward-template'));

        this.container = getElementFromFragment(this._content, 'container', 'span');
        this.text = getElementFromFragment(this._content, 'text', 'span');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    setTooltip(content) {
        if(content && this.container) {
            tippy(this.container, {
                content: content,
                placement: 'top',
                allowHTML: true
            });
        }
    }

    setCurrency(amount, iconSrc, tooltipContent) {
        this.text.textContent = amount + ' ';
        this.text.className = '';
        this.icon.src = iconSrc;
        this.icon.classList.remove('d-none');
        if(tooltipContent) this.setTooltip(tooltipContent);
    }

    setStat(value, statIcon, tooltipContent) {
        this.text.textContent = `+${value}`;
        this.text.className = 'text-success';
        if(statIcon) {
            this.icon.src = statIcon;
            this.icon.classList.remove('d-none');
        } else {
            this.icon.classList.add('d-none');
        }
        if(tooltipContent) this.setTooltip(tooltipContent);
    }

    setMaterial(quantity, iconSrc, tooltipContent) {
        this.text.textContent = quantity + ' ';
        this.text.className = '';
        this.icon.src = iconSrc;
        this.icon.classList.remove('d-none');
        if(tooltipContent) this.setTooltip(tooltipContent);
    }

    setAbility(name, iconSrc, tooltipContent) {
        this.text.textContent = name;
        this.text.className = 'text-info';
        this.icon.classList.add('d-none');
        if(tooltipContent) this.setTooltip(tooltipContent);
    }

    setEffect(description, tooltipContent) {
        this.text.textContent = description;
        this.text.className = 'text-warning';
        this.icon.classList.add('d-none');
        if(tooltipContent) this.setTooltip(tooltipContent);
    }

    setJob(jobName, iconSrc, tooltipContent) {
        this.text.textContent = jobName;
        this.text.className = 'text-info';
        if(iconSrc) {
            this.icon.src = iconSrc;
            this.icon.classList.remove('d-none');
        } else {
            this.icon.classList.add('d-none');
        }
        if(tooltipContent) this.setTooltip(tooltipContent);
    }
}
window.customElements.define('adventuring-achievement-reward', AdventuringAchievementRewardElement);
