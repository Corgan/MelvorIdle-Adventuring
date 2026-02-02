const { loadModule } = mod.getContext(import.meta);

/**
 * Stat breakdown tooltip using game-native styling
 * Builds HTML content for tippy tooltips matching base game appearance
 */
export class AdventuringStatBreakdownTooltipElement extends HTMLElement {
    constructor() {
        super();
        this._container = document.createElement('div');
        this._container.className = 'text-left';
        this.appendChild(this._container);
        this._collapseIdCounter = 0;
    }

    /**
     * Set the breakdown data to display
     * @param {StatBreakdown} breakdown
     */
    setBreakdown(breakdown) {
        if (!breakdown || !breakdown.stat) return;
        this._collapseIdCounter = 0;
        this._container.innerHTML = this._buildContent(breakdown);
        this._attachCollapseHandlers();
    }

    /**
     * Attach click handlers for collapsible sections and auto-collapse deep items
     */
    _attachCollapseHandlers() {
        const toggles = this._container.querySelectorAll('[data-collapse-toggle]');
        toggles.forEach(toggle => {
            const targetId = toggle.getAttribute('data-collapse-toggle');
            const target = this._container.querySelector(`[data-collapse-id="${targetId}"]`);
            const icon = toggle.querySelector('i.fa');
            const depth = parseInt(toggle.getAttribute('data-depth') || '0', 10);
            
            // Auto-collapse items at depth >= 1 (second level and below)
            if (depth >= 1 && target) {
                target.style.display = 'none';
                if (icon) {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-right');
                }
            }
            
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                
                if (target) {
                    const isHidden = target.style.display === 'none';
                    target.style.display = isHidden ? 'block' : 'none';
                    if (icon) {
                        icon.classList.toggle('fa-chevron-right', !isHidden);
                        icon.classList.toggle('fa-chevron-down', isHidden);
                    }
                }
            });
        });
    }

    /**
     * Build the tooltip HTML content using game-native styles
     */
    _buildContent(breakdown) {
        const sections = [];

        // Header with icon and stat name
        sections.push(`
            <div class="text-center mb-3">
                <img class="skill-icon-xs mr-1" src="${breakdown.stat.media}">
                <span class="font-w600 text-warning">${breakdown.stat.name}</span>
                <span class="font-w700 text-info ml-2">${breakdown.finalValue}</span>
            </div>
        `);

        // Base stat row
        sections.push(`
            <div class="d-flex justify-content-between mb-2 pb-2" style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <span class="text-muted">Base</span>
                <span>${breakdown.base}</span>
            </div>
        `);

        // Calculate pre-percent value for showing actual percent contributions
        const prePercentValue = breakdown.base + breakdown.totalFlat;

        // All bonuses - each source gets its own row with spacing
        const allContribs = [...breakdown.positive, ...breakdown.negative];
        if (allContribs.length > 0) {
            for (let i = 0; i < allContribs.length; i++) {
                const contrib = allContribs[i];
                const isPositive = breakdown.positive.includes(contrib);
                const colorClass = isPositive ? 'text-success' : 'text-danger';
                const isLast = i === allContribs.length - 1 && breakdown.combat.buffs.length === 0 && breakdown.combat.debuffs.length === 0;
                sections.push(this._buildSourceRow(contrib, colorClass, !isLast, prePercentValue));
            }
        }

        // Combat effects - each gets its own row with spacing
        const allCombat = [...breakdown.combat.buffs, ...breakdown.combat.debuffs];
        if (allCombat.length > 0) {
            for (let i = 0; i < allCombat.length; i++) {
                const effect = allCombat[i];
                const isBuff = breakdown.combat.buffs.includes(effect);
                const colorClass = isBuff ? 'text-success' : 'text-danger';
                const isLast = i === allCombat.length - 1;
                sections.push(this._buildSourceRow(effect, colorClass, !isLast, prePercentValue));
            }
        }

        return sections.join('');
    }

    /**
     * Build a source row with icon, name, and value - with clear visual separation
     * @param {StatContribution} contrib - The contribution to display
     * @param {string} colorClass - CSS class for coloring (text-success/text-danger)
     * @param {boolean} showBorder - Whether to show bottom border
     * @param {number} prePercentValue - The stat value before percent bonuses (for calculating actual percent contribution)
     */
    _buildSourceRow(contrib, colorClass = '', showBorder = true, prePercentValue = 0) {
        // Always reserve space for icon (use transparent placeholder if none)
        const iconHtml = contrib.icon 
            ? `<img class="skill-icon-xxs mr-2" src="${contrib.icon}">`
            : `<span class="skill-icon-xxs mr-2" style="display: inline-block;"></span>`;

        const valueDisplay = this._formatContribution(contrib, prePercentValue);
        const hasSubs = contrib.subContributions && contrib.subContributions.length > 0;
        
        // Wrap entire group in container with border at bottom
        const borderStyle = showBorder ? 'border-bottom: 1px solid rgba(255,255,255,0.1);' : '';
        
        let html = `<div class="py-1 mb-1" style="${borderStyle}">`;
        
        // Always include chevron space for alignment - use invisible placeholder if no subs
        const chevronHtml = hasSubs 
            ? `<i class="fa fa-chevron-down fa-fw mr-1" style="font-size: 0.7em;"></i>`
            : `<i class="fa fa-fw mr-1" style="font-size: 0.7em; visibility: hidden;"></i>`;
        
        if (hasSubs) {
            const collapseId = `collapse-${this._collapseIdCounter++}`;
            html += `
                <div class="d-flex justify-content-between align-items-center" style="cursor: pointer;" data-collapse-toggle="${collapseId}" data-depth="0">
                    <span class="text-muted">
                        ${chevronHtml}${iconHtml}${contrib.source}
                    </span>
                    <span class="${colorClass} font-w600 ml-3">${valueDisplay}</span>
                </div>
            `;
            
            // Sub-contributions container (collapsible) - supports recursive nesting
            html += `<div data-collapse-id="${collapseId}">`;
            for (const sub of contrib.subContributions) {
                html += this._buildSubContribution(sub, colorClass, prePercentValue, 1, contrib.icon);
            }
            html += `</div>`;
        } else {
            // No subs - simple row but still with chevron placeholder for alignment
            html += `
                <div class="d-flex justify-content-between align-items-center">
                    <span class="text-muted">${chevronHtml}${iconHtml}${contrib.source}</span>
                    <span class="${colorClass} font-w600 ml-3">${valueDisplay}</span>
                </div>
            `;
        }

        html += `</div>`;
        return html;
    }

    /**
     * Build HTML for a sub-contribution (supports recursive nesting)
     * @param {StatContribution} sub - The sub-contribution
     * @param {string} colorClass - CSS class for value coloring
     * @param {number} prePercentValue - Value before percent bonuses
     * @param {number} depth - Nesting depth (1 = first level sub, 2 = nested sub, etc.)
     * @param {string} parentIcon - Parent's icon URL (to hide duplicates)
     */
    _buildSubContribution(sub, colorClass, prePercentValue, depth = 1, parentIcon = null) {
        // Types where we hide duplicate icons (sub-items that are breakdowns of the same source)
        const hideDuplicateIconTypes = ['itemBase', 'itemLevel', 'itemMastery', 'itemMasterful', 'jobScaling', 'jobMastery'];
        const shouldHideDuplicate = hideDuplicateIconTypes.includes(sub.sourceType) && sub.icon === parentIcon;
        
        // Show icon unless it's a breakdown type with matching parent icon
        const showIcon = sub.icon && !shouldHideDuplicate;
        const subIcon = showIcon
            ? `<img class="skill-icon-xxs mr-1" src="${sub.icon}">`
            : `<span class="skill-icon-xxs mr-1" style="display: inline-block;"></span>`;
        const subValue = this._formatContribution(sub, prePercentValue);
        const nameClass = sub.isLevelCapped ? 'text-warning' : 'text-muted';
        const paddingLeft = depth * 1; // rem units
        const opacity = Math.max(0.6, 1 - depth * 0.15);
        const fontSize = Math.max(0.75, 1 - depth * 0.1);
        
        const hasNestedSubs = sub.subContributions && sub.subContributions.length > 0;
        
        // Always include chevron space for alignment - use invisible placeholder if no nested subs
        const chevronHtml = hasNestedSubs
            ? `<i class="fa fa-chevron-down fa-fw mr-1" style="font-size: 0.7em;"></i>`
            : `<i class="fa fa-fw mr-1" style="font-size: 0.7em; visibility: hidden;"></i>`;
        
        let html = '';
        
        if (hasNestedSubs) {
            // This sub has its own children - make it collapsible
            const collapseId = `collapse-${this._collapseIdCounter++}`;
            html += `
                <div class="d-flex justify-content-between align-items-center pt-1" style="padding-left: ${paddingLeft}rem; opacity: ${opacity}; font-size: ${fontSize}em; cursor: pointer;" data-collapse-toggle="${collapseId}" data-depth="${depth}">
                    <span class="${nameClass}">
                        ${chevronHtml}${subIcon}${sub.source}
                    </span>
                    <span class="${colorClass} ml-3">${subValue}</span>
                </div>
            `;
            html += `<div data-collapse-id="${collapseId}">`;
            for (const nested of sub.subContributions) {
                html += this._buildSubContribution(nested, colorClass, prePercentValue, depth + 1, sub.icon);
            }
            html += `</div>`;
        } else {
            // Leaf sub-contribution - still include chevron placeholder for alignment
            html += `
                <div class="d-flex justify-content-between align-items-center pt-1" style="padding-left: ${paddingLeft}rem; opacity: ${opacity}; font-size: ${fontSize}em;">
                    <span class="${nameClass}">${chevronHtml}${subIcon}${sub.source}</span>
                    <span class="${colorClass} ml-3">${subValue}</span>
                </div>
            `;
        }
        
        return html;
    }

    /**
     * Format a contribution's value for display
     * For parent contributions with sub-contributions, shows totals
     * For percent-only contributions, calculates and shows actual value
     * @param {StatContribution} contrib - The contribution
     * @param {number} prePercentValue - Value before percent bonuses for calculating actual contribution
     */
    _formatContribution(contrib, prePercentValue = 0) {
        const parts = [];
        
        // If this has sub-contributions, show the totals
        if (contrib.subContributions && contrib.subContributions.length > 0) {
            const totalFlat = contrib.totalFlat;
            const totalPercent = contrib.totalPercent;
            
            if (totalFlat !== 0) {
                const sign = totalFlat > 0 ? '+' : '';
                parts.push(`${sign}${totalFlat}`);
            }
            
            if (totalPercent !== 0) {
                // Calculate actual value from percent for parent totals
                const actualValue = prePercentValue * totalPercent / 100;
                const sign = actualValue >= 0 ? '+' : '';
                const displayValue = Number.isInteger(actualValue) ? actualValue : actualValue.toFixed(1);
                const percentSign = totalPercent > 0 ? '+' : '';
                parts.push(`${sign}${displayValue} (${percentSign}${totalPercent}%)`);
            }
        } else {
            // Direct contribution (no subs)
            if (contrib.flat !== 0) {
                const sign = contrib.flat > 0 ? '+' : '';
                parts.push(`${sign}${contrib.flat}`);
            }
            
            if (contrib.percent !== 0) {
                // Calculate the actual value this percent contributes (not floored - stat calc floors at end)
                const actualValue = prePercentValue * contrib.percent / 100;
                const sign = actualValue >= 0 ? '+' : '';
                // Show to 1 decimal place, or as integer if whole number
                const displayValue = Number.isInteger(actualValue) ? actualValue : actualValue.toFixed(1);
                // Show as "+X (+Y%)" where X is actual contribution, Y is the percent
                const percentSign = contrib.percent > 0 ? '+' : '';
                parts.push(`${sign}${displayValue} (${percentSign}${contrib.percent}%)`);
            }
        }

        return parts.join(' ') || '—';
    }

    /**
     * Format total for section header
     */
    _formatTotal(total) {
        const parts = [];
        
        if (total.flat !== 0) {
            const sign = total.flat > 0 ? '+' : '';
            parts.push(`${sign}${total.flat}`);
        }
        
        if (total.percent !== 0) {
            const sign = total.percent > 0 ? '+' : '';
            parts.push(`${sign}${total.percent}%`);
        }

        return parts.join(' ') || '+0';
    }
}

window.customElements.define('adventuring-stat-breakdown-tooltip', AdventuringStatBreakdownTooltipElement);
