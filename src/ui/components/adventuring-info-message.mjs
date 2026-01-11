
export class AdventuringInfoMessageElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-info-message-template'));

        this.container = getElementFromFragment(this._content, 'container', 'div');
        this.iconWrap = getElementFromFragment(this._content, 'iconWrap', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'i');
        this.titleText = getElementFromFragment(this._content, 'title', 'p');
        this.description = getElementFromFragment(this._content, 'description', 'p');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    setMessage({ icon, title, titleClass = 'text-warning', description = '' }) {
        this.icon.className = `fa ${icon} fa-2x mb-2`;
        this.titleText.textContent = title;
        this.titleText.className = `${titleClass} mb-2`;

        if (description) {
            this.description.innerHTML = description;
            this.description.classList.remove('d-none');
        } else {
            this.description.classList.add('d-none');
        }
    }

    hideIcon() {
        this.iconWrap.classList.add('d-none');
    }
}
window.customElements.define('adventuring-info-message', AdventuringInfoMessageElement);
