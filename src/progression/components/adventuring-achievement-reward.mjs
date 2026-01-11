
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

    setCurrency(amount, iconSrc) {
        this.text.textContent = amount + ' ';
        this.text.className = '';
        this.icon.src = iconSrc;
        this.icon.classList.remove('d-none');
    }

    setStat(value, statName) {
        this.text.textContent = `+${value} ${statName}`;
        this.text.className = 'text-success';
        this.icon.classList.add('d-none');
    }

    setMaterial(quantity, iconSrc) {
        this.text.textContent = quantity + ' ';
        this.text.className = '';
        this.icon.src = iconSrc;
        this.icon.classList.remove('d-none');
    }
}
window.customElements.define('adventuring-achievement-reward', AdventuringAchievementRewardElement);
