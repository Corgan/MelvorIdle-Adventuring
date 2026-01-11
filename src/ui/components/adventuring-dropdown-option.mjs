
export class AdventuringDropdownOptionElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-dropdown-option-template'));

        this.container = getElementFromFragment(this._content, 'container', 'a');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');

        this._onClick = null;
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    disconnectedCallback() {
        this._onClick = null;
    }

    setOption({ iconSrc, name, onClick }) {
        this.icon.src = iconSrc;
        this.nameText.textContent = name;

        if (onClick) {
            this._onClick = onClick;
            this.container.onclick = onClick;
        }
    }

    setFromItem(item, onClick) {
        this.setOption({
            iconSrc: item.media,
            name: item.name,
            onClick
        });
    }
}
window.customElements.define('adventuring-dropdown-option', AdventuringDropdownOptionElement);
