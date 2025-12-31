/**
 * Dropdown option element - icon + name for dropdown menus
 * Used in workshop product selector, item pickers
 */
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

    /**
     * Set the option display
     * @param {Object} options - Configuration options
     * @param {string} options.iconSrc - Icon URL
     * @param {string} options.name - Display name
     * @param {Function} [options.onClick] - Click handler
     */
    setOption({ iconSrc, name, onClick }) {
        this.icon.src = iconSrc;
        this.nameText.textContent = name;
        
        if (onClick) {
            this._onClick = onClick;
            this.container.onclick = onClick;
        }
    }

    /**
     * Set option from an item-like object
     * @param {Object} item - Object with media and name properties
     * @param {Function} [onClick] - Click handler
     */
    setFromItem(item, onClick) {
        this.setOption({
            iconSrc: item.media,
            name: item.name,
            onClick
        });
    }
}
window.customElements.define('adventuring-dropdown-option', AdventuringDropdownOptionElement);
