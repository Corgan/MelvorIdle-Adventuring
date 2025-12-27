const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringSlayerTask, SlayerTaskGenerator } = await loadModule('src/progression/adventuring-slayer-task.mjs');
const { AdventuringSlayersElement } = await loadModule('src/progression/components/adventuring-slayers.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

class SlayersRenderQueue {
    constructor() {
        this.availableTasks = false;
        this.activeTasks = false;
        this.achievements = false;
        this.all = false;
    }
}

export class AdventuringSlayers extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-slayers');
        this.renderQueue = new SlayersRenderQueue();

        // Task management
        this.activeTasks = [];           // Currently accepted tasks
        this.availableTasks = [];        // Tasks available to accept
        this.maxActiveTasks = 3;         // Max concurrent tasks
        this.maxAvailableTasks = 6;      // Number of available tasks shown
        this.totalTasksCompleted = 0;    // Lifetime completed tasks count

        // Costs
        this.abandonCost = 100;          // Cost to abandon a task
        this.refreshCost = 250;          // Cost to refresh available tasks

        // Tab state
        this.currentTab = 'tasks';
        this.selectedCategory = 'all';

        this.taskGenerator = new SlayerTaskGenerator(manager, game);

        this.component.back.onclick = () => this.back();
        this.component.refreshButton.onclick = () => this.tryRefreshTasks();
        
        // Tab switching
        this.component.tabTasks.onclick = () => this.switchTab('tasks');
        this.component.tabAchievements.onclick = () => this.switchTab('achievements');
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // Update tab button styles
        this.component.tabTasks.classList.toggle('active', tab === 'tasks');
        this.component.tabAchievements.classList.toggle('active', tab === 'achievements');
        
        // Show/hide content
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

    onLoad() {
        super.onLoad();
        
        // Ensure we always have 5 available tasks
        this.fillAvailableTasks();
    }

    onShow() {
        this.manager.party.all.forEach(member => member.setLocked(false));
        
        // Ensure we always have 5 available tasks
        this.fillAvailableTasks();
        
        this.renderQueue.all = true;
    }

    onHide() {
        this.manager.party.all.forEach(member => member.setLocked(true));
    }

    postDataRegistration() {
        // Nothing special needed here
    }

    /**
     * Get a key for a task's type/target/tier combination
     * Including tier allows same type+target with different difficulties
     */
    getTaskKey(task) {
        const typeId = task.taskType ? task.taskType.id : 'unknown';
        const targetId = task.targetId || 'unknown';
        const tier = task.tier || 1;
        return `${typeId}:${targetId}:${tier}`;
    }

    /**
     * Fill available tasks up to the max (5), ensuring unique type/target/tier combinations
     */
    fillAvailableTasks() {
        // Build set of existing task keys (both available and active)
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
            
            // Only add if this type/target combination doesn't already exist
            if(!existingKeys.has(taskKey)) {
                this.availableTasks.push(newTask);
                existingKeys.add(taskKey);
            }
        }
        this.renderQueue.availableTasks = true;
    }

    /**
     * Try to refresh all available tasks (costs coins)
     */
    tryRefreshTasks() {
        const currency = this.manager.materials.getObjectByID('adventuring:currency');
        const currentGold = this.manager.stash.materialCounts.get(currency) || 0;
        
        if(currentGold < this.refreshCost) {
            this.manager.log.add(`Not enough gold to refresh tasks! Need ${this.refreshCost} gold.`);
            return false;
        }
        
        // Deduct cost
        this.manager.stash.remove(currency, this.refreshCost);
        this.manager.log.add(`Spent ${this.refreshCost} gold to refresh tasks.`);
        
        // Clear and regenerate available tasks
        this.availableTasks = [];
        this.fillAvailableTasks();
        
        return true;
    }

    /**
     * Accept a task from available tasks
     */
    acceptTask(task) {
        if(this.activeTasks.length >= this.maxActiveTasks) {
            this.manager.log.add("You have too many active tasks!");
            return false;
        }

        const index = this.availableTasks.indexOf(task);
        if(index === -1) return false;

        // Move from available to active
        this.availableTasks.splice(index, 1);
        this.activeTasks.push(task);

        this.manager.log.add(`Accepted task: ${task.description}`);

        // Fill available tasks back up to 5
        this.fillAvailableTasks();

        this.renderQueue.availableTasks = true;
        this.renderQueue.activeTasks = true;
        return true;
    }

    /**
     * Abandon an active task (costs coins)
     */
    abandonTask(task) {
        const index = this.activeTasks.indexOf(task);
        if(index === -1) return false;

        const currency = this.manager.materials.getObjectByID('adventuring:currency');
        const currentGold = this.manager.stash.materialCounts.get(currency) || 0;
        
        if(currentGold < this.abandonCost) {
            this.manager.log.add(`Not enough gold to abandon task! Need ${this.abandonCost} gold.`);
            return false;
        }
        
        // Deduct cost
        this.manager.stash.remove(currency, this.abandonCost);

        this.activeTasks.splice(index, 1);
        this.manager.log.add(`Abandoned task: ${task.description} (-${this.abandonCost} gold)`);

        this.renderQueue.activeTasks = true;
        return true;
    }

    /**
     * Claim rewards for a completed task
     */
    claimTask(task) {
        if(!task.completed) return false;

        const index = this.activeTasks.indexOf(task);
        if(index === -1) return false;

        if(task.claim()) {
            this.activeTasks.splice(index, 1);
            this.totalTasksCompleted++;

            // Track for achievements
            if(this.manager.achievementManager) {
                this.manager.achievementManager.recordSlayerTask();
            }
            
            // Build reward message
            const rewardStrings = task.rewards.map(r => {
                if(r.type === 'currency') return `${r.qty} gold`;
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

    /**
     * Update task progress when a monster is killed
     * Called from encounter completion
     */
    onMonsterKilled(monster) {
        this.activeTasks.forEach(task => {
            if(task.taskType && task.taskType.id === 'adventuring:kill' && task.targetId === monster.id) {
                task.addProgress(1);
                this.renderQueue.activeTasks = true;
            }
        });
    }

    /**
     * Update task progress when materials are collected
     * Called from loot distribution
     */
    onMaterialCollected(material, amount) {
        this.activeTasks.forEach(task => {
            if(task.taskType && task.taskType.id === 'adventuring:collect' && task.targetId === material.id) {
                task.addProgress(amount);
                this.renderQueue.activeTasks = true;
            }
        });
    }

    /**
     * Update task progress when a dungeon is cleared
     * Called from dungeon floor completion
     */
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

    /**
     * Update the achievements tab badge showing claimable count
     */
    updateAchievementBadge() {
        const claimable = this.getClaimableAchievementCount();
        if(claimable > 0) {
            this.component.achievementsBadge.textContent = claimable;
            this.component.achievementsBadge.classList.remove('d-none');
        } else {
            this.component.achievementsBadge.classList.add('d-none');
        }
    }

    /**
     * Get count of achievements that can be claimed
     */
    getClaimableAchievementCount() {
        let count = 0;
        for(const achievement of this.manager.achievements.allObjects) {
            if(!achievement.isComplete() && achievement.isMet()) {
                count++;
            }
        }
        return count;
    }

    /**
     * Render the achievements tab
     */
    renderAchievements() {
        if(!this.renderQueue.achievements && !this.renderQueue.all)
            return;

        this.renderAchievementSummary();
        this.renderAchievementCategoryFilter();
        this.renderAchievementList();

        this.renderQueue.achievements = false;
    }

    /**
     * Render achievement progress summary
     */
    renderAchievementSummary() {
        const total = this.manager.achievements.allObjects.length;
        const completed = this.manager.completedAchievements.size;
        const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;

        this.component.achievementSummary.textContent = `${completed} / ${total} Complete`;
        this.component.achievementProgressBar.style.width = `${percent}%`;

        // Render stat totals from completed achievements
        const stats = this.getAchievementStatTotals();
        this.component.achievementStats.replaceChildren();

        const statOrder = [
            { id: 'hitpoints', name: 'HP', icon: 'fa-heart', color: 'text-danger' },
            { id: 'strength', name: 'STR', icon: 'fa-fist-raised', color: 'text-warning' },
            { id: 'defence', name: 'DEF', icon: 'fa-shield-alt', color: 'text-info' },
            { id: 'agility', name: 'AGI', icon: 'fa-running', color: 'text-success' },
            { id: 'magic', name: 'MAG', icon: 'fa-magic', color: 'text-primary' },
            { id: 'ranged', name: 'RNG', icon: 'fa-bullseye', color: 'text-warning' },
            { id: 'prayer', name: 'PRA', icon: 'fa-pray', color: 'text-light' }
        ];

        for(const stat of statOrder) {
            const value = stats[stat.id] || 0;
            if(value > 0) {
                const col = document.createElement('div');
                col.className = 'col-auto p-2';
                col.innerHTML = `
                    <div class="${stat.color}">
                        <i class="fa ${stat.icon} mr-1"></i>
                        <span class="font-w600">+${value}</span>
                        <small class="text-muted ml-1">${stat.name}</small>
                    </div>
                `;
                this.component.achievementStats.appendChild(col);
            }
        }

        // Show currency earned
        if(stats.currency > 0) {
            const col = document.createElement('div');
            col.className = 'col-auto p-2';
            col.innerHTML = `
                <div class="text-warning">
                    <i class="fa fa-coins mr-1"></i>
                    <span class="font-w600">+${stats.currency}</span>
                    <small class="text-muted ml-1">Gold</small>
                </div>
            `;
            this.component.achievementStats.appendChild(col);
        }
    }

    /**
     * Get total stat bonuses from completed achievements
     */
    getAchievementStatTotals() {
        const totals = { currency: 0 };

        for(const achievement of this.manager.achievements.allObjects) {
            if(achievement.isComplete()) {
                for(const reward of achievement.rewards) {
                    if(reward.type === 'stat') {
                        const statId = reward.stat.replace('adventuring:', '');
                        totals[statId] = (totals[statId] || 0) + reward.value;
                    } else if(reward.type === 'currency') {
                        totals.currency += reward.qty;
                    }
                }
            }
        }

        return totals;
    }

    /**
     * Render category filter buttons
     */
    renderAchievementCategoryFilter() {
        this.component.achievementCategoryFilter.replaceChildren();

        // All button
        const allBtn = document.createElement('button');
        allBtn.className = `btn btn-outline-info ${this.selectedCategory === 'all' ? 'active' : ''}`;
        allBtn.textContent = 'All';
        allBtn.onclick = () => {
            this.selectedCategory = 'all';
            this.renderQueue.achievements = true;
            this.render();
        };
        this.component.achievementCategoryFilter.appendChild(allBtn);

        // Category buttons
        for(const category of this.manager.achievementCategories.allObjects) {
            const btn = document.createElement('button');
            btn.className = `btn btn-outline-info ${this.selectedCategory === category.id ? 'active' : ''}`;
            btn.textContent = category.name;
            btn.onclick = () => {
                this.selectedCategory = category.id;
                this.renderQueue.achievements = true;
                this.render();
            };
            this.component.achievementCategoryFilter.appendChild(btn);
        }
    }

    /**
     * Render the achievement list
     */
    renderAchievementList() {
        this.component.achievementList.replaceChildren();

        let achievements = [...this.manager.achievements.allObjects];

        // Filter by category
        if(this.selectedCategory !== 'all') {
            achievements = achievements.filter(a => a.category && a.category.id === this.selectedCategory);
        }

        // Sort: claimable first, then in-progress, then completed
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

    /**
     * Create an achievement card element
     */
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

        // Set content
        icon.src = achievement.media;
        name.textContent = achievement.name;
        description.textContent = achievement.description;

        // Category badge
        if(achievement.category) {
            categoryBadge.textContent = achievement.category.name;
            categoryBadge.className = `badge badge-${this.getCategoryColor(achievement.category.id)}`;
        }

        // Progress bar
        progressBar.style.width = `${percent}%`;
        progressBar.className = `progress-bar ${isComplete ? 'bg-success' : isMet ? 'bg-warning' : 'bg-info'}`;
        progressText.textContent = `${progress} / ${target}`;

        // Card styling
        if(isComplete) {
            card.classList.add('border', 'border-success');
            card.style.opacity = '0.7';
        } else if(isMet) {
            card.classList.add('border', 'border-warning');
        }

        // Rewards
        for(const reward of achievement.rewards) {
            const span = document.createElement('span');
            span.className = 'd-inline-flex align-items-center mr-2';

            if(reward.type === 'currency') {
                span.innerHTML = `${reward.qty} <img class="skill-icon-xxs ml-1" src="${this.manager.stash.currencyMedia}">`;
            } else if(reward.type === 'stat') {
                const statName = reward.stat.replace('adventuring:', '').toUpperCase().slice(0, 3);
                span.innerHTML = `<span class="text-success">+${reward.value} ${statName}</span>`;
            } else if(reward.type === 'material') {
                const mat = this.manager.materials.getObjectByID(reward.id);
                if(mat) {
                    span.innerHTML = `${reward.qty} <img class="skill-icon-xxs ml-1" src="${mat.media}">`;
                }
            }

            rewards.appendChild(span);
        }

        // Claim button
        if(isMet && !isComplete) {
            claimBtn.classList.remove('d-none');
            claimBtn.onclick = () => this.claimAchievement(achievement);
        }

        const col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-lg-4 p-2';
        col.appendChild(card);

        return col;
    }

    /**
     * Claim an achievement's rewards
     */
    claimAchievement(achievement) {
        if(achievement.isComplete() || !achievement.isMet()) return;

        // Mark as complete
        this.manager.completedAchievements.add(achievement.id);

        // Grant rewards
        for(const reward of achievement.rewards) {
            if(reward.type === 'currency') {
                const currency = this.manager.materials.getObjectByID('adventuring:currency');
                this.manager.stash.add(currency, reward.qty);
            } else if(reward.type === 'stat') {
                // Permanent stat bonuses are applied via the achievement system
                // They're calculated in getAchievementStatTotals and applied to party
            } else if(reward.type === 'material') {
                const mat = this.manager.materials.getObjectByID(reward.id);
                if(mat) {
                    this.manager.stash.add(mat, reward.qty);
                }
            }
        }

        this.manager.log.add(`Achievement unlocked: ${achievement.name}!`);
        this.renderQueue.achievements = true;
        this.render();
    }

    /**
     * Get color for achievement category
     */
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

    /**
     * Check if the player has seen any monsters yet
     */
    hasSeenMonsters() {
        return this.manager.bestiary.seen.size > 0;
    }

    renderAvailableTasks() {
        if(!this.renderQueue.availableTasks && !this.renderQueue.all)
            return;

        // Clear existing
        this.component.availableTasks.replaceChildren();

        // If no monsters have been seen, show a message
        if(!this.hasSeenMonsters()) {
            const message = document.createElement('div');
            message.className = 'col-12 text-center p-4';
            message.innerHTML = `
                <div class="text-muted mb-2">
                    <i class="fa fa-map-signs fa-2x mb-2"></i>
                </div>
                <p class="text-warning mb-2">No tasks available yet!</p>
                <p class="text-muted small">Visit the <strong>Chicken Coop</strong> and defeat some monsters first.<br>Then return here to pick up slayer tasks.</p>
            `;
            this.component.availableTasks.appendChild(message);
            this.component.refreshButton.classList.add('d-none');
        } else {
            this.component.refreshButton.classList.remove('d-none');
            
            this.availableTasks.forEach(task => {
                const card = this.createTaskCard(task, 'available');
                this.component.availableTasks.appendChild(card);
            });

            // Update refresh button with cost
            this.component.refreshCost.textContent = `${this.refreshCost}`;
        }

        this.renderQueue.availableTasks = false;
    }

    renderActiveTasks() {
        if(!this.renderQueue.activeTasks && !this.renderQueue.all)
            return;

        // Clear existing
        this.component.activeTasks.replaceChildren();

        if(this.activeTasks.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'col-12 text-center text-muted p-3';
            empty.textContent = 'No active tasks. Accept a task from the board!';
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

    /**
     * Create a task card element
     */
    createTaskCard(task, mode) {
        const col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-lg-4 p-2';

        const card = document.createElement('div');
        card.className = 'block block-rounded-double bg-combat-inner-dark p-3';
        if(task.completed) {
            card.classList.add('border', 'border-success');
        }

        // Header with tier indicator
        const header = document.createElement('div');
        header.className = 'd-flex justify-content-between align-items-center mb-2';
        
        const tierBadge = document.createElement('span');
        tierBadge.className = `badge badge-${this.getTierColor(task.tier)}`;
        tierBadge.textContent = `Tier ${task.tier}`;
        header.appendChild(tierBadge);

        const typeIcon = document.createElement('small');
        typeIcon.className = 'text-muted';
        const typeName = task.taskType ? task.taskType.name : 'Task';
        typeIcon.textContent = typeName;
        header.appendChild(typeIcon);

        card.appendChild(header);

        // Target with icon
        const target = document.createElement('div');
        target.className = 'd-flex align-items-center mb-2';
        
        const icon = document.createElement('img');
        icon.className = 'skill-icon-xs mr-2';
        icon.src = task.targetMedia;
        target.appendChild(icon);

        const desc = document.createElement('span');
        desc.className = 'text-white';
        desc.textContent = task.description;
        target.appendChild(desc);

        card.appendChild(target);

        // Progress bar (for active tasks)
        if(mode === 'active') {
            const progressContainer = document.createElement('div');
            progressContainer.className = 'mb-2';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress active-progress';
            progressBar.style.height = '20px';
            
            const progressFill = document.createElement('div');
            progressFill.className = `progress-bar ${task.completed ? 'bg-success' : 'bg-info'}`;
            progressFill.style.width = `${task.progressPercent}%`;
            progressFill.textContent = task.progressText;
            
            progressBar.appendChild(progressFill);
            progressContainer.appendChild(progressBar);
            card.appendChild(progressContainer);
        }

        // Rewards
        const rewards = document.createElement('div');
        rewards.className = 'small text-muted mb-2 d-flex align-items-center flex-wrap';
        
        const rewardsLabel = document.createElement('strong');
        rewardsLabel.textContent = 'Rewards: ';
        rewardsLabel.className = 'mr-1';
        rewards.appendChild(rewardsLabel);
        
        task.rewards.forEach((r, i) => {
            if(i > 0) {
                const comma = document.createElement('span');
                comma.textContent = ', ';
                comma.className = 'mr-1';
                rewards.appendChild(comma);
            }
            
            const rewardSpan = document.createElement('span');
            rewardSpan.className = 'd-inline-flex align-items-center';
            
            if(r.type === 'currency') {
                rewardSpan.innerHTML = `${r.qty} <img class="skill-icon-xxs ml-1" src="${this.manager.stash.currencyMedia}">`;
            } else if(r.type === 'xp') {
                rewardSpan.textContent = `${r.qty} XP`;
            } else if(r.type === 'material') {
                const mat = this.manager.materials.getObjectByID(r.id);
                if(mat) {
                    const img = document.createElement('img');
                    img.className = 'skill-icon-xxs ml-1';
                    img.src = mat.media;
                    rewardSpan.textContent = r.qty + ' ';
                    rewardSpan.appendChild(img);
                    
                    const tooltip = TooltipBuilder.forMaterial(mat);
                    tippy(rewardSpan, {
                        content: tooltip.build(),
                        allowHTML: true
                    });
                }
            }
            
            rewards.appendChild(rewardSpan);
        });
        card.appendChild(rewards);

        // Action button
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-block';
        
        if(mode === 'available') {
            btn.className += ' btn-primary';
            btn.textContent = 'Accept';
            btn.onclick = () => this.acceptTask(task);
            if(this.activeTasks.length >= this.maxActiveTasks) {
                btn.disabled = true;
                btn.textContent = 'Task Limit Reached';
            }
        } else if(mode === 'active') {
            if(task.completed) {
                btn.className += ' btn-success';
                btn.textContent = 'Claim Rewards';
                btn.onclick = () => this.claimTask(task);
            } else {
                btn.className += ' btn-danger';
                btn.textContent = `Abandon (${this.abandonCost} gold)`;
                btn.onclick = () => this.abandonTask(task);
            }
        }
        card.appendChild(btn);

        col.appendChild(card);
        return col;
    }

    getTierColor(tier) {
        const colors = ['secondary', 'info', 'primary', 'warning', 'danger'];
        return colors[tier - 1] || 'secondary';
    }

    encode(writer) {
        // Encode total completed count
        writer.writeUint32(this.totalTasksCompleted);

        // Encode active tasks
        writer.writeUint8(this.activeTasks.length);
        this.activeTasks.forEach(task => task.encode(writer));

        // Encode available tasks
        writer.writeUint8(this.availableTasks.length);
        this.availableTasks.forEach(task => task.encode(writer));
    }

    decode(reader, version) {
        // Decode total completed count
        this.totalTasksCompleted = reader.getUint32();

        // Decode active tasks
        const numActive = reader.getUint8();
        this.activeTasks = [];
        for(let i = 0; i < numActive; i++) {
            const task = new AdventuringSlayerTask(this.manager, this.game);
            task.decode(reader, version);
            this.activeTasks.push(task);
        }

        // Decode available tasks
        const numAvailable = reader.getUint8();
        this.availableTasks = [];
        for(let i = 0; i < numAvailable; i++) {
            const task = new AdventuringSlayerTask(this.manager, this.game);
            task.decode(reader, version);
            this.availableTasks.push(task);
        }
    }
}