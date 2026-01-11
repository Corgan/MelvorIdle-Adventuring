
export class AdventuringJobIconElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-job-icon-template'));

        this.container = getElementFromFragment(this._content, 'container', 'span');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    setJob(job) {
        this.icon.src = job.media;
        this.nameText.textContent = job.name;
    }

    setJobWithLevel(job, level) {
        this.icon.src = job.media;
        this.nameText.textContent = `${job.name} Lv.${level}`;
    }

    set(iconSrc, name) {
        this.icon.src = iconSrc;
        this.nameText.textContent = name;
    }
}
window.customElements.define('adventuring-job-icon', AdventuringJobIconElement);
