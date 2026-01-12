const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringSlayerTask, SlayerTaskGenerator } = await loadModule('src/progression/adventuring-slayer-task.mjs');

await loadModule('src/progression/components/adventuring-slayers.mjs');
const { AdventuringTaskRewardElement } = await loadModule('src/progression/components/adventuring-task-reward.mjs');
const { AdventuringStatBadgeElement } = await loadModule('src/progression/components/adventuring-stat-badge.mjs');
const { AdventuringAchievementRewardElement } = await loadModule('src/progression/components/adventuring-achievement-reward.mjs');
const { AdventuringInfoMessageElement } = await loadModule('src/ui/components/adventuring-info-message.mjs');
const { AdventuringEmptyStateElement } = await loadModule('src/ui/components/adventuring-empty-state.mjs');

class SlayersRenderQueue {
    constructor() {
        this.availableTasks = false;
        this.activeTasks = false;
        this.achievements = false;
        this.all = false;
    }
    queueAll() {
        this.availableTasks = true;
        this.activeTasks = true;
        this.achievements = true;
        this.all = true;
    }
}

export class AdventuringSlayers extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-slayers');
        this.renderQueue = new SlayersRenderQueue();

        this.activeTasks = [];           // Currently accepted tasks
        this.availableTasks = [];        // Tasks available to accept
        this.maxActiveTasks = 3;         // Max concurrent tasks
        this.maxAvailableTasks = 6;      // Number of available tasks shown
        this.totalTasksCompleted = 0;    // Lifetime completed tasks count

        this.abandonCost = 100;          // Cost to abandon a task
        this.refreshCost = 250;          // Cost to refresh available tasks

        this.currentTab = 'tasks';
        this.selectedCategory = 'all';

        this.taskGenerator = new SlayerTaskGenerator(manager, game);

        this.component.back.onclick = () => this.back();
        this.component.refreshButton.onclick = () => this.tryRefreshTasks();

        this.component.tabTasks.onclick = () => this.switchTab('tasks');
        this.component.tabAchievements.onclick = () => this.switchTab('achievements');
    }

    switchTab(tab) {
        this.currentTab = tab;

        this.component.tabTasks.classList.toggle('active', tab === 'tasks');
        this.component.tabAchievements.classList.toggle('active', tab === 'achievements');

        this.component.tasksContent.classList.toggle('d-none', tab !== 'tasks');
        this.component.achievementsContent.classList.toggle('d-none', tab !== 'achievements');

        if(tab === 'achievements') {
            this.renderQueue.achievements = true;
            this.render();
        }
    }

    back() {
        if(this.active) {
            this.manager.town.setBuilding(undefined);
        }
    }

    destroyTippyIn(container) {
        const elements = container.querySelectorAll('*');
        elements.forEach(el => {
            if(el._tippy) el._tippy.destroy();
        });
    }

    onLoad() {
        super.onLoad();

        this.fillAvailableTasks();
    }

    onShow() {
        this.manager.party.setAllLocked(false);

        this.fillAvailableTasks();

        this.renderQueue.all = true;
    }

    onHide() {
        this.manager.party.setAllLocked(true);
    }

    postDataRegistration() {

    }

    getTaskKey(task) {
        const typeId = task.taskType ? task.taskType.id : 'unknown';
        const targetId = task.targetId || 'unknown';
        const tier = task.tier || 1;
        return `${typeId}:${targetId}:${tier}`;
    }

    fillAvailableTasks() {

        const existingKeys = new Set();
        this.availableTasks.forEach(task => existingKeys.add(this.getTaskKey(task)));
        this.activeTasks.forEach(task => existingKeys.add(this.getTaskKey(task)));

        let attempts = 0;
        const maxAttempts = 50; // Prevent infinite loop

        while(this.availableTasks.length < this.maxAvailableTasks && attempts < maxAttempts) {
            attempts++;
            const newTasks = this.taskGenerator.generateAvailableTasks(1);
            if(newTasks.length === 0) {
                break; // No more tasks can be generated
            }

            const newTask = newTasks[0];
            const taskKey = this.getTaskKey(newTask);

            if(!existingKeys.has(taskKey)) {
                this.availableTasks.push(newTask);
                existingKeys.add(taskKey);
            }
        }
        this.renderQueue.availableTasks = true;
    }

    tryRefreshTasks() {
        const slayerCoins = this.manager.cached.slayerCoins;
        const currentCoins = this.manager.stash.materialCounts.get(slayerCoins) || 0;

        if(currentCoins < this.refreshCost) {
            this.manager.log.add(`Not enough Slayer Coins to refresh tasks! Need ${this.refreshCost}.`);
            return false;
        }

        this.manager.stash.remove(slayerCoins, this.refreshCost);
        this.manager.log.add(`Spent ${this.refreshCost} Slayer Coins to refresh tasks.`);

        this.availableTasks = [];
        this.fillAvailableTasks();

        return true;
    }

    acceptTask(task) {
        if(this.activeTasks.length >= this.maxActiveTasks) {
            this.manager.log.add("You have too many active tasks!");
            return false;
        }

        const index = this.availableTasks.indexOf(task);
        if(index === -1) return false;

        this.availableTasks.splice(index, 1);
        this.activeTasks.push(task);

        this.manager.log.add(`Accepted task: ${task.description}`);

        this.fillAvailableTasks();

        this.renderQueue.availableTasks = true;
        this.renderQueue.activeTasks = true;
        return true;
    }

    abandonTask(task) {
        const index = this.activeTasks.indexOf(task);
        if(index === -1) return false;

        const slayerCoins = this.manager.cached.slayerCoins;
        const currentCoins = this.manager.stash.materialCounts.get(slayerCoins) || 0;

        if(currentCoins < this.abandonCost) {
            this.manager.log.add(`Not enough Slayer Coins to abandon task! Need ${this.abandonCost}.`);
            return false;
        }

        this.manager.stash.remove(slayerCoins, this.abandonCost);

        this.activeTasks.splice(index, 1);
        this.manager.log.add(`Abandoned task: ${task.description} (-${this.abandonCost} Slayer Coins)`);

        this.renderQueue.activeTasks = true;
        return true;
    }

    claimTask(task) {
        if(!task.completed) return false;

        const index = this.activeTasks.indexOf(task);
        if(index === -1) return false;

        if(task.claim()) {
            this.activeTasks.splice(index, 1);
            this.totalTasksCompleted++;

            this.manager.achievementManager.recordSlayerTask();

            const rewardStrings = task.rewards.map(r => {
                if(r.type === 'currency') return `${r.qty} Slayer Coins`;
                if(r.type === 'xp') return `${r.qty} XP`;
                if(r.type === 'material') {
                    const mat = this.manager.materials.getObjectByID(r.id);
                    return `${r.qty} ${mat ? mat.name : r.id}`;
                }
                return '';
            }).filter(s => s);

            this.manager.log.add(`Claimed rewards: ${rewardStrings.join(', ')}`);
            this.renderQueue.activeTasks = true;
            return true;
        }
        return false;
    }

    onMonsterKilled(monster) {
        this.activeTasks.forEach(task => {

            if(task.taskType && task.taskType.id === 'adventuring:kill' && task.targetId === monster.id) {
                task.addProgress(1);
                this.renderQueue.activeTasks = true;
            }

            if(task.taskType && task.taskType.targetType === 'monster_tag') {
                const tag = task.taskType.targetTag;
                if(monster.tags && monster.tags.includes(tag)) {
                    task.addProgress(1);
                    this.renderQueue.activeTasks = true;
                }
            }
        });
    }

    onMaterialCollected(material, amount) {
        this.activeTasks.forEach(task => {
            if(task.taskType && task.taskType.id === 'adventuring:collect' && task.targetId === material.id) {
                task.addProgress(amount);
                this.renderQueue.activeTasks = true;
            }
        });
    }

    onDungeonCleared(area) {
        this.activeTasks.forEach(task => {
            if(task.taskType && task.taskType.id === 'adventuring:clear' && task.targetId === area.id) {
                task.addProgress(1);
                this.renderQueue.activeTasks = true;
            }
        });
    }

    render() {
        this.renderAvailableTasks();
        this.renderActiveTasks();
        this.renderAchievements();
        this.updateAchievementBadge();
    }

    updateAchievementBadge() {
        const claimable = this.getClaimableAchievementCount();
        if(claimable > 0) {
            this.component.achievementsBadge.textContent = claimable;
            this.component.achievementsBadge.classList.remove('d-none');
        } else {
            this.component.achievementsBadge.classList.add('d-none');
        }
    }

    getClaimableAchievementCount() {
        let count = 0;
        for(const achievement of this.manager.achievements.allObjects) {
            if(!achievement.isComplete() && achievement.isMet()) {
                count++;
            }
        }
        return count;
    }

    renderAchievements() {
        if(!this.renderQueue.achievements && !this.renderQueue.all)
            return;

        this.manager.achievementManager.checkIfDirty();

        this.renderAchievementSummary();
        this.renderAchievementCategoryFilter();
        this.renderAchievementList();

        this.renderQueue.achievements = false;
    }

    renderAchievementSummary() {
        const total = this.manager.achievements.allObjects.length;
        const completed = this.manager.achievementManager.completedAchievements.size;
        const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;

        this.component.achievementSummary.textContent = `${completed} / ${total} Complete`;
        this.component.achievementProgressBar.style.width = `${percent}%`;

        const stats = this.getAchievementStatTotals();
        this.component.achievementStats.replaceChildren();

        for(const stat of this.manager.stats.allObjects) {
            const value = stats[stat.localID] || 0;
            if(value > 0) {
                const badge = new AdventuringStatBadgeElement();
                badge.setStatDataFromStat(stat, value);
                this.component.achievementStats.appendChild(badge);
            }
        }
    }

    getAchievementStatTotals() {
        const totals = { currency: 0 };

        for(const achievement of this.manager.achievements.allObjects) {
            if(achievement.isComplete()) {
                for(const reward of achievement.rewards) {
                    if(reward.type === 'stat') {
                        const statId = reward.stat.replace('adventuring:', '');
                        totals[statId] = (totals[statId] || 0) + reward.value;
                    }
                }
            }
        }

        return totals;
    }

    renderAchievementCategoryFilter() {
        this.component.achievementCategoryFilter.replaceChildren();

        const allBtn = document.createElement('button');
        allBtn.className = `btn btn-sm btn-outline-info ${this.selectedCategory === 'all' ? 'active' : ''}`;
        allBtn.textContent = 'All';
        allBtn.onclick = () => {
            this.selectedCategory = 'all';
            this.renderQueue.achievements = true;
            this.render();
        };
        this.component.achievementCategoryFilter.appendChild(allBtn);

        for(const category of this.manager.achievementCategories.allObjects) {
            const btn = document.createElement('button');
            btn.className = `btn btn-sm btn-outline-info ${this.selectedCategory === category.id ? 'active' : ''}`;
            btn.textContent = category.name;
            btn.onclick = () => {
                this.selectedCategory = category.id;
                this.renderQueue.achievements = true;
                this.render();
            };
            this.component.achievementCategoryFilter.appendChild(btn);
        }
    }

    renderAchievementList() {
        this.component.achievementList.replaceChildren();

        let achievements = [...this.manager.achievements.allObjects];

        if(this.selectedCategory !== 'all') {
            achievements = achievements.filter(a => a.category && a.category.id === this.selectedCategory);
        }

        achievements.sort((a, b) => {
            const aClaimable = !a.isComplete() && a.isMet();
            const bClaimable = !b.isComplete() && b.isMet();
            const aComplete = a.isComplete();
            const bComplete = b.isComplete();

            if(aClaimable && !bClaimable) return -1;
            if(!aClaimable && bClaimable) return 1;
            if(!aComplete && bComplete) return -1;
            if(aComplete && !bComplete) return 1;
            return a.getProgressPercent() > b.getProgressPercent() ? -1 : 1;
        });

        for(const achievement of achievements) {
            const card = this.createAchievementCard(achievement);
            this.component.achievementList.appendChild(card);
        }
    }

    createAchievementCard(achievement) {
        const template = document.getElementById('adventuring-achievement-card-template');
        const frag = template.content.cloneNode(true);

        const card = frag.querySelector('#card');
        const icon = frag.querySelector('#icon');
        const name = frag.querySelector('#name');
        const categoryBadge = frag.querySelector('#category-badge');
        const description = frag.querySelector('#description');
        const progressBar = frag.querySelector('#progress-bar');
        const progressText = frag.querySelector('#progress-text');
        const rewards = frag.querySelector('#rewards');
        const claimBtn = frag.querySelector('#claim-btn');

        const isComplete = achievement.isComplete();
        const isMet = achievement.isMet();
        const progress = achievement.getProgress();
        const target = achievement.getTarget();
        const percent = achievement.getProgressPercent();

        icon.src = achievement.media;
        name.textContent = achievement.name;
        description.textContent = achievement.description;

        if(achievement.category) {
            categoryBadge.textContent = achievement.category.name;
            categoryBadge.className = `badge badge-${this.getCategoryColor(achievement.category.id)}`;
        }

        progressBar.style.width = `${percent}%`;
        progressBar.className = `progress-bar ${isComplete ? 'bg-success' : isMet ? 'bg-warning' : 'bg-info'}`;
        progressText.textContent = `${progress} / ${target}`;

        if(isComplete) {
            card.classList.add('border', 'border-success');
            card.style.opacity = '0.7';
        } else if(isMet) {
            card.classList.add('border', 'border-warning');
        }

        for(const reward of achievement.rewards) {
            const rewardEl = new AdventuringAchievementRewardElement();

            if(reward.type === 'currency') {
                rewardEl.setCurrency(reward.qty, this.manager.stash.currencyMedia, 'Adventuring Coins');
            } else if(reward.type === 'stat') {
                const stat = this.manager.stats.getObjectByID(reward.stat);
                const statName = stat ? stat.name : reward.stat.replace('adventuring:', '');
                const shortName = statName.toUpperCase().slice(0, 3);
                rewardEl.setStat(reward.value, shortName, statName);
            } else if(reward.type === 'material') {
                const mat = this.manager.materials.getObjectByID(reward.id);
                if(mat) {
                    rewardEl.setMaterial(reward.qty, mat.media, mat.name);
                }
            }

            rewards.appendChild(rewardEl);
        }

        const col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-lg-4 p-2';
        col.appendChild(card);

        return col;
    }

    claimAchievement(achievement) {
        if(achievement.isComplete() || !achievement.isMet()) return;

        this.manager.achievementManager.completeAchievement(achievement);

        this.manager.log.add(`Achievement unlocked: ${achievement.name}!`);
        this.renderQueue.achievements = true;
        this.render();
    }

    getCategoryColor(categoryId) {
        const colors = {
            'adventuring:combat': 'danger',
            'adventuring:dungeons': 'info',
            'adventuring:collection': 'warning',
            'adventuring:mastery': 'success',
            'adventuring:challenges': 'primary'
        };
        return colors[categoryId] || 'secondary';
    }

    hasSeenMonsters() {
        return this.manager.bestiary.seen.size > 0;
    }

    renderAvailableTasks() {
        if(!this.renderQueue.availableTasks && !this.renderQueue.all)
            return;

        this.destroyTippyIn(this.component.availableTasks);
        this.component.availableTasks.replaceChildren();

        if(!this.hasSeenMonsters()) {
            const message = new AdventuringInfoMessageElement();
            message.setMessage({
                icon: 'fa-map-signs',
                title: 'No tasks available yet!',
                titleClass: 'text-warning',
                description: 'Visit the <strong>Chicken Coop</strong> and defeat some monsters first.<br>Then return here to pick up slayer tasks.'
            });
            this.component.availableTasks.appendChild(message);
            this.component.refreshButton.classList.add('d-none');
        } else {
            this.component.refreshButton.classList.remove('d-none');

            this.availableTasks.forEach(task => {
                const card = this.createTaskCard(task, 'available');
                this.component.availableTasks.appendChild(card);
            });

            this.component.refreshCost.textContent = `${this.refreshCost}`;
        }

        this.renderQueue.availableTasks = false;
    }

    renderActiveTasks() {
        if(!this.renderQueue.activeTasks && !this.renderQueue.all)
            return;

        this.destroyTippyIn(this.component.activeTasks);
        this.component.activeTasks.replaceChildren();

        if(this.activeTasks.length === 0) {
            const empty = new AdventuringEmptyStateElement();
            empty.setFullWidthMessage('No active tasks. Accept a task from the board!');
            this.component.activeTasks.appendChild(empty);
        } else {
            this.activeTasks.forEach(task => {
                const card = this.createTaskCard(task, 'active');
                this.component.activeTasks.appendChild(card);
            });
        }

        this.renderQueue.activeTasks = false;
        this.renderQueue.all = false;
    }

    createTaskCard(task, mode) {
        const frag = getTemplateNode('adventuring-slayer-task-template');

        const col = getElementFromFragment(frag, 'col', 'div');
        const card = getElementFromFragment(frag, 'card', 'div');
        const tierBadge = getElementFromFragment(frag, 'tierBadge', 'span');
        const typeName = getElementFromFragment(frag, 'typeName', 'small');
        const targetIcon = getElementFromFragment(frag, 'targetIcon', 'img');
        const description = getElementFromFragment(frag, 'description', 'span');
        const progressContainer = getElementFromFragment(frag, 'progressContainer', 'div');
        const progressBar = getElementFromFragment(frag, 'progressBar', 'div');
        const rewards = getElementFromFragment(frag, 'rewards', 'span');
        const actionBtn = getElementFromFragment(frag, 'actionBtn', 'button');

        if(task.completed) {
            card.classList.add('border', 'border-success');
        }

        tierBadge.className = `badge badge-${this.getTierColor(task.tier)}`;
        tierBadge.textContent = `Tier ${task.tier}`;

        typeName.textContent = task.taskType ? task.taskType.name : 'Task';

        targetIcon.src = task.targetMedia;
        description.textContent = task.description;

        if(mode === 'active') {
            progressContainer.classList.remove('d-none');
            progressBar.className = `progress-bar ${task.completed ? 'bg-success' : 'bg-info'}`;
            progressBar.style.width = `${task.progressPercent}%`;
            progressBar.textContent = task.progressText;
        }

        this.renderTaskRewards(rewards, task);

        if(mode === 'available') {
            actionBtn.className = 'btn btn-sm btn-block btn-primary';
            actionBtn.textContent = 'Accept';
            actionBtn.onclick = () => this.acceptTask(task);
            if(this.activeTasks.length >= this.maxActiveTasks) {
                actionBtn.disabled = true;
                actionBtn.textContent = 'Task Limit Reached';
            }
        } else if(mode === 'active') {
            if(task.completed) {
                actionBtn.className = 'btn btn-sm btn-block btn-success';
                actionBtn.textContent = 'Claim Rewards';
                actionBtn.onclick = () => this.claimTask(task);
            } else {
                actionBtn.className = 'btn btn-sm btn-block btn-danger';
                actionBtn.textContent = `Abandon (${this.abandonCost} Slayer Coins)`;
                actionBtn.onclick = () => this.abandonTask(task);
            }
        }

        return col;
    }

    renderTaskRewards(container, task) {
        task.rewards.forEach((r, i) => {
            if(i > 0) {
                const comma = document.createElement('span');
                comma.textContent = ', ';
                comma.className = 'mr-1';
                container.appendChild(comma);
            }

            const reward = new AdventuringTaskRewardElement();
            container.appendChild(reward);

            const rewardLocalID = (r.rewardType && r.rewardType.localID) ? r.rewardType.localID : null;

            if(rewardLocalID === 'material' && r.item) {

                reward.setReward({
                    quantity: r.qty + ' ',
                    iconSrc: r.item.media,
                    tooltipContent: r.item.name
                });
            } else if(rewardLocalID === 'job_xp' && r.item) {

                reward.setReward({
                    quantity: r.qty + ' ',
                    iconSrc: r.item.media,
                    tooltipContent: `${r.item.name} XP`,
                    colorClass: 'text-success'
                });
            } else if(rewardLocalID === 'consumable' && r.item) {

                reward.setReward({
                    quantity: r.qty + ' ',
                    iconSrc: r.item.media,
                    tooltipContent: r.item.name
                });
            } else {

                reward.setReward({
                    quantity: `${r.qty}`
                });
            }
        });
    }

    getTierColor(tier) {
        const colors = ['secondary', 'info', 'primary', 'warning', 'danger'];
        return colors[tier - 1] || 'secondary';
    }

    resetTasks() {
        this.totalTasksCompleted = 0;
        this.activeTasks = [];
        this.availableTasks = [];
        this.fillAvailableTasks();
        this.renderQueue.queueAll();
    }

    encode(writer) {

        writer.writeUint32(this.totalTasksCompleted);

        writer.writeUint8(this.activeTasks.length);
        this.activeTasks.forEach(task => task.encode(writer));

        writer.writeUint8(this.availableTasks.length);
        this.availableTasks.forEach(task => task.encode(writer));
    }

    decode(reader, version) {

        this.totalTasksCompleted = reader.getUint32();

        const numActive = reader.getUint8();
        this.activeTasks = [];
        for(let i = 0; i < numActive; i++) {
            const task = new AdventuringSlayerTask(this.manager, this.game);
            task.decode(reader, version);
            this.activeTasks.push(task);
        }

        const numAvailable = reader.getUint8();
        this.availableTasks = [];
        for(let i = 0; i < numAvailable; i++) {
            const task = new AdventuringSlayerTask(this.manager, this.game);
            task.decode(reader, version);
            this.availableTasks.push(task);
        }
    }
}