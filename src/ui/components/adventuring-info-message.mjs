/**
 * Info message element - large guidance message with icon, title, and description
 * Used for empty states with guidance, locked content messages, tutorials
 */
export class AdventuringInfoMessageElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-info-message-template'));
        
        this.container = getElementFromFragment(this._content, 'container', 'div');
        this.iconWrap = getElementFromFragment(this._content, 'iconWrap', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'i');
        this.title = getElementFromFragment(this._content, 'title', 'p');
        this.description = getElementFromFragment(this._content, 'description', 'p');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    /**
     * Set the info message content
     * @param {Object} options - Configuration options
     * @param {string} options.icon - Font Awesome icon class (e.g., 'fa-map-signs')
     * @param {string} options.title - Title text
     * @param {string} [options.titleClass='text-warning'] - CSS class for title
     * @param {string} [options.description] - Description text (can contain HTML)
     */
    setMessage({ icon, title, titleClass = 'text-warning', description = '' }) {
        this.icon.className = `fa ${icon} fa-2x mb-2`;
        this.title.textContent = title;
        this.title.className = `${titleClass} mb-2`;
        
        if (description) {
            this.description.innerHTML = description;
            this.description.classList.remove('d-none');
        } else {
            this.description.classList.add('d-none');
        }
    }

    /**
     * Hide the icon section
     */
    hideIcon() {
        this.iconWrap.classList.add('d-none');
    }
}
window.customElements.define('adventuring-info-message', AdventuringInfoMessageElement);
