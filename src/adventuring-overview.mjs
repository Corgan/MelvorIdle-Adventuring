const { loadModule } = mod.getContext(import.meta);

const { AdventuringCards } = await loadModule('src/adventuring-cards.mjs');

const { AdventuringOverviewUIComponent } = await loadModule('src/components/adventuring-overview.mjs');

class OverviewRenderQueue {
    constructor() {
        this.status = false;
        this.buttons = false;
        this.turnProgressBar = false;
        this.healProgressBar = false;
    }
}

export class AdventuringOverview {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;

        this.renderQueue = new OverviewRenderQueue();
        this.component = new AdventuringOverviewUIComponent(this.manager, this.game, this);

        this.component.trainerButton.onclick = () => this.manager.trainer.go();
        this.component.stashButton.onclick = () => this.manager.stash.go();
        this.component.crossroadsButton.onclick = () => this.manager.crossroads.go();
        this.component.abandonButton.onclick = () => this.manager.dungeon.abandon();

        this.cards = new AdventuringCards(this.manager, this.game);
        
        this.cards.component.mount(this.component.cards);
    }

    onLoad() { }

    render() {
        this.renderButtons();
        this.renderStatus();
        this.renderHealProgress();
        this.renderTurnProgress();
        this.cards.render();
    }

    renderButtons() {
        if(!this.renderQueue.buttons)
            return;
            
        this.component.trainerButton.classList.toggle('d-none', this.manager.isActive);
        this.component.trainerButton.classList.toggle('btn-info', this.manager.pages.active == this.manager.trainer || this.manager.pages.active == this.manager.jobdetails);

        this.component.stashButton.classList.toggle('d-none', this.manager.isActive);
        this.component.stashButton.classList.toggle('btn-info', this.manager.pages.active == this.manager.stash);

        this.component.crossroadsButton.classList.toggle('d-none', this.manager.isActive);
        this.component.crossroadsButton.classList.toggle('btn-info', this.manager.pages.active == this.manager.crossroads);

        this.component.abandonButton.classList.toggle('d-none', !this.manager.isActive);

        this.component.cards.classList.toggle('d-none', !this.manager.isActive);

        this.renderQueue.buttons = false;
    }

    renderStatus() {
        if(!this.renderQueue.status)
            return;

        let status = '';

        if(this.manager.isActive) {
            if(this.manager.dungeon.area !== undefined) {
                let floor = this.manager.dungeon.progress == this.manager.dungeon.numFloors ? "Boss Floor" : `Floor ${this.manager.dungeon.progress+1}`;
                status += `${this.manager.dungeon.area.name} - ${floor}`;
            }

            if(this.manager.encounter.isFighting)
                status += ` - Round ${this.manager.encounter.roundCounter}`;
        } else {
            status = `Town`;
        }

        this.component.statusText.textContent = status;

        this.renderQueue.status = false;
    }

    renderTurnProgress() {
        if(!this.renderQueue.turnProgressBar)
            return;

        this.component.turnProgress.classList.toggle('d-none', !this.manager.isActive);

        if(this.manager.encounter.hitTimer.isActive) {
            this.component.turnProgressBar.animateStriped();
        } else if(this.manager.encounter.turnTimer.isActive) {
            this.component.turnProgressBar.animateProgressFromTimer(this.manager.encounter.turnTimer);
        } else if(this.manager.dungeon.exploreTimer.isActive) {
            this.component.turnProgressBar.animateProgressFromTimer(this.manager.dungeon.exploreTimer);
        } else {
            this.component.turnProgressBar.stopAnimation();
        }

        this.renderQueue.turnProgressBar = false;
    }

    renderHealProgress() {
        if(!this.renderQueue.healProgressBar)
            return;
        
        this.component.healProgress.classList.toggle('d-none', this.manager.isActive);

        if(this.manager.healTimer.isActive) {
            this.component.healProgressBar.animateProgressFromTimer(this.manager.healTimer);
        } else {
            this.component.healProgressBar.stopAnimation();
        }

        this.renderQueue.healProgressBar = false;
    }
}