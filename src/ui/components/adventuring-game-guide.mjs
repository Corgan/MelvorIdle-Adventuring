export class AdventuringGameGuideElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-game-guide-template'));
    }

    connectedCallback() {
        // Move the id and class onto this element
        this.id = 'tutorial-page-Adventuring';
        this.className = 'py-2 text-center';
        
        this.appendChild(this._content);
    }
}

window.customElements.define('adventuring-game-guide', AdventuringGameGuideElement);
