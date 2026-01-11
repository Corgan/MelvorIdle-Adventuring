
export class AdventuringActiveBuffBadgeElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-active-buff-badge-template'));

        this.badge = getElementFromFragment(this._content, 'badge', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.text = getElementFromFragment(this._content, 'text', 'span');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    setBuff({ iconSrc, name, remaining }) {
        this.icon.src = iconSrc;
        this.text.textContent = `${name} (${remaining} runs)`;
    }
}
window.customElements.define('adventuring-active-buff-badge', AdventuringActiveBuffBadgeElement);
