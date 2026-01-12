# Adventuring Mod - Data Structure Reference

This document provides comprehensive documentation for developers who want to add content to the Adventuring mod for Melvor Idle.

## Table of Contents

1. [File Structure](#file-structure)
2. [JSON Format](#json-format)
3. [Stats](#stats)
4. [Materials](#materials)
5. [Areas](#areas)
6. [Monsters](#monsters)
7. [Abilities (Generators & Spenders)](#abilities)
8. [Passives](#passives)
9. [Equipment (Base Items)](#equipment)
10. [Jobs](#jobs)
11. [Buffs & Debuffs](#buffs--debuffs)
12. [Tiles](#tiles)
13. [Difficulty Modes](#difficulty-modes)
14. [Achievements](#achievements)
15. [Slayer Tasks](#slayer-tasks)
16. [Tavern Drinks](#tavern-drinks)
17. [Consumables](#consumables)
18. [Buildings & Products](#buildings--products)
19. [Mastery](#mastery)
20. [Tutorials](#tutorials)
21. [Tags](#tags)
22. [Item Types & Slots](#item-types--slots)
23. [Equipment Sets](#equipment-sets)
24. [Requirements](#requirements)
25. [Effects System](#effects-system)
26. [Scaling Values](#scaling-values)

---

## File Structure

All data files are located in `adventuring/data/`. The structure is:

```
data/
├── base.json              # Core definitions (stats, buffs, debuffs, tiles, slots)
├── achievements.json      # Achievement definitions
├── difficulties.json      # Difficulty mode definitions
├── mastery.json          # Mastery category milestones
├── materials.json        # Additional material definitions
├── slayer-tasks.json     # Slayer task type definitions
├── tags.json             # Monster tag definitions
├── tavern-drinks.json    # Drink definitions
├── tutorials.json        # Tutorial step definitions
├── areas/                # One file per area (contains area, monsters, abilities)
├── items/                # Equipment and item definitions
│   ├── tier1.json        # Tier 1 equipment
│   ├── tier2.json        # Tier 2 equipment
│   ├── ...
│   ├── artifacts.json    # Special tiered artifacts
│   ├── uniques.json      # Unique items with special effects
│   └── types.json        # Item type definitions
└── jobs/
    ├── combat/           # Combat job definitions
    └── passive/          # Passive job definitions (crafting, etc.)
```

---

## JSON Format

All data files follow the Melvor Idle mod data format:

```json
{
    "$schema": "https://www.melvoridle.com/assets/schema/gameData.json",
    "namespace": "adventuring",
    "data": {
        "skillData": [{
            "skillID": "adventuring:Adventuring",
            "data": {
                // Your data arrays go here
            }
        }]
    }
}
```

### Namespacing

All IDs use the format `namespace:id`. When defining items within the `adventuring` namespace:
- Use just the `id` in the definition: `"id": "fighter"`
- Reference with full namespace: `"adventuring:fighter"`
- Reference Melvor base game items: `"melvorD:Bronze_Bar"`

### Media Paths

Media can reference:
- Mod assets: `"assets/media/my_icon.png"`
- Melvor assets: `"melvor:assets/media/skills/combat/attack.svg"`
- With color tinting: `"melvor:assets/media/bank/bar.png#shade=red"`
- With color tinting (SVG): `"melvor:assets/media/skills/smithing/smithing.svg#tint=yellow"`

Available shades/tints: `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `brown`

---

## Stats

Stats define the core attributes for heroes and monsters.

### Stat Definition

```json
{
    "id": "hitpoints",
    "name": "Hitpoints",
    "media": "melvor:assets/media/skills/hitpoints/hitpoints.svg",
    "base": 10
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `media` | string | ✓ | Icon path |
| `base` | number | ✗ | Base value for heroes (default: 1) |

### Built-in Stats

| ID | Name | Base | Description |
|----|------|------|-------------|
| `hitpoints` | Hitpoints | 10 | Health pool |
| `defence` | Defence | 1 | Damage reduction |
| `agility` | Agility | 1 | Turn order speed |
| `strength` | Strength | 1 | Physical damage |
| `ranged` | Ranged | 1 | Ranged damage |
| `magic` | Magic | 1 | Magic damage |
| `prayer` | Prayer | 1 | Healing power |

### Custom Stats

Passive jobs can add custom stats (e.g., `smithing` for the Smith job):

```json
{
    "stats": [
        {
            "id": "smithing",
            "name": "Smithing",
            "media": "melvor:assets/media/skills/smithing/smithing.svg#shade=red"
        }
    ]
}
```

---

## Materials

Materials are resources collected during adventures, used for crafting and upgrades.

### Material Definition

```json
{
    "id": "dragon_scale",
    "name": "Dragon Scale",
    "media": "melvor:assets/media/bank/dragonhide_green.png",
    "category": "adventuring:monster_drops",
    "tier": 2,
    "requirements": [
        { "type": "skill_level", "level": 40 }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `media` | string | ✓ | Icon path |
| `category` | string | ✓ | Material category ID |
| `tier` | number | ✗ | Tier level (1-4, default: 1) |
| `isCurrency` | boolean | ✗ | If true, treated as currency |
| `requirements` | array | ✗ | Requirements to unlock/use |

### Material Categories

| ID | Name | Description |
|----|------|-------------|
| `currency` | Currency | Coins and tokens |
| `salvage` | Salvage | Equipment scraps |
| `monster_drops` | Monster Drops | Common monster materials |
| `boss_drops` | Boss Drops | Rare boss materials |
| `materials` | Materials | General crafting materials |
| `special` | Special | Unique special materials |

### Built-in Materials

**Currency:**
- `currency` - Adventuring Coins
- `slayer_coins` - Slayer Coins

**Salvage (tiered):**
- `parts` - Salvage Scraps (T1)
- `big_parts` - Quality Salvage (T2)
- `superior_salvage` - Superior Salvage (T3)
- `pristine_salvage` - Pristine Salvage (T4)
- `legendary_salvage` - Legendary Salvage (T5)
- `mythic_salvage` - Mythic Salvage (T6)

---

## Areas

Areas (dungeons) define explorable locations with floors, monsters, and loot.

### Area Definition

```json
{
    "id": "chicken_coop",
    "name": "Chicken Coop",
    "media": "melvor:assets/media/monsters/chicken.png",
    "requirements": [
        { "type": "skill_level", "level": 1 }
    ],
    "height": 5,
    "width": 5,
    "floors": [
        {
            "monsters": [
                { "id": "adventuring:chicken", "weight": 100 }
            ],
            "exit": [
                "adventuring:chicken",
                "adventuring:chicken"
            ]
        }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `media` | string | ✓ | Icon path |
| `requirements` | array | ✗ | Requirements to unlock |
| `height` | number | ✓ | Floor grid height |
| `width` | number | ✓ | Floor grid width |
| `floors` | array | ✓ | Array of floor definitions |
| `tiles` | array | ✗ | Custom tile pool for this area |
| `loot` | array | ✗ | Global loot table for area drops |
| `description` | string | ✗ | Area description text |
| `masteryXP` | number | ✗ | Base mastery XP per clear (default: 2000) |
| `passives` | array | ✗ | Passive effect IDs active in this area |
| `masteryAuraId` | string | ✗ | Buff ID for mastery level 99 |
| `isGauntlet` | boolean | ✗ | If true, area is a gauntlet mode |
| `gauntletTier` | number | ✗ | Gauntlet difficulty tier |
| `encounterFloorMax` | number | ✗ | Max encounter tiles per floor |
| `encounterWeight` | number | ✗ | Encounter spawn weight override |

### Floor Definition

```json
{
    "monsters": [
        { "id": "adventuring:green_dragon", "weight": 70 },
        { "id": "adventuring:blue_dragon", "weight": 30 }
    ],
    "exit": [
        "adventuring:green_dragon",
        "adventuring:green_dragon",
        "adventuring:blue_dragon"
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `monsters` | array | ✓ | Weighted monster pool for random encounters |
| `exit` | array | ✓ | Fixed encounter at floor exit (monster IDs) |

**Monster Weight Entry:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Full monster ID |
| `weight` | number | ✓ | Spawn weight (higher = more common) |

---

## Monsters

Monsters are enemies encountered in dungeons.

### Monster Definition

```json
{
    "id": "red_dragon",
    "name": "Red Dragon",
    "media": "melvor:assets/media/monsters/dragon_red.png",
    "tags": ["boss", "dragon"],
    "xp": 11,
    "isBoss": true,
    "stats": [
        { "id": "adventuring:hitpoints", "amount": 45 },
        { "id": "adventuring:defence", "amount": 22 },
        { "id": "adventuring:agility", "amount": 38 },
        { "id": "adventuring:strength", "amount": 22 },
        { "id": "adventuring:ranged", "amount": 40 },
        { "id": "adventuring:magic", "amount": 48 },
        { "id": "adventuring:prayer", "amount": 32 }
    ],
    "generator": "adventuring:fire_breath",
    "spender": "adventuring:dragon_inferno",
    "passives": [
        "adventuring:dragon_scales",
        "adventuring:fire_aura"
    ],
    "loot": [
        { "id": "adventuring:currency", "qty": 50, "type": "currency" },
        { "id": "adventuring:dragon_scale", "qty": 2, "type": "materials", "chance": 0.35 },
        { "type": "equipment_pool", "pool": "adventuring:tier3_dragons_lair", "chance": 0.15 }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `media` | string | ✓ | Icon/sprite path |
| `tags` | array | ✗ | Monster tags for slayer tasks |
| `xp` | number | ✓ | Base XP reward |
| `isBoss` | boolean | ✗ | If true, treated as boss |
| `stats` | array | ✓ | Base stat values |
| `generator` | string | ✓ | Generator ability ID |
| `spender` | string | ✓ | Spender ability ID |
| `passives` | array | ✗ | Array of passive ability IDs |
| `loot` | array | ✓ | Loot table entries |
| `masteryXP` | number | ✗ | Base mastery XP (default: 100) |

### Boss Properties

Bosses can have additional properties:

```json
{
    "isBoss": true,
    "enrageThreshold": 30,
    "enrageBuff": {
        "damage": 0.5,
        "speed": 0.2
    },
    "phases": [
        {
            "name": "Ancient Terror"
        },
        {
            "name": "Firestorm",
            "hpThreshold": 50,
            "generator": "adventuring:fire_breath",
            "spender": "adventuring:dragon_breath",
            "statBuffs": [
                { "id": "adventuring:magic", "amount": 0.35 }
            ]
        }
    ]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `enrageThreshold` | number | HP% that triggers enrage |
| `enrageBuff.damage` | number | Damage multiplier when enraged |
| `enrageBuff.speed` | number | Speed multiplier when enraged |
| `phases` | array | Boss phase definitions |

**Phase Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | ✓ | Phase name |
| `hpThreshold` | number | ✗ | HP% to trigger phase (first phase has none) |
| `generator` | string | ✗ | New generator for this phase |
| `spender` | string | ✗ | New spender for this phase |
| `statBuffs` | array | ✗ | Stat multipliers for this phase |

### Loot Entry Types

**Currency:**
```json
{ "id": "adventuring:currency", "qty": 50, "type": "currency" }
```

**Salvage:**
```json
{ "id": "adventuring:parts", "qty": 12, "type": "salvage" }
```

**Materials (with chance):**
```json
{ "id": "adventuring:dragon_scale", "qty": 2, "type": "materials", "chance": 0.35 }
```

**Equipment Pool:**
```json
{ "type": "equipment_pool", "pool": "adventuring:tier3_dragons_lair", "chance": 0.15 }
```

**Direct Equipment:**
```json
{ "type": "equipment", "id": "adventuring:dragon_sword", "chance": 0.05 }
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | ✓ | `currency`, `salvage`, `materials`, `equipment_pool`, `equipment` |
| `id` | string | ✓* | Material/item ID (*not for equipment_pool) |
| `pool` | string | ✓* | Equipment pool ID (*only for equipment_pool) |
| `qty` | number | ✗ | Quantity (default: 1) |
| `chance` | number | ✗ | Drop chance 0-1 (default: 1 = guaranteed) |

---

## Abilities

Abilities are combat actions divided into **Generators** (build energy) and **Spenders** (use energy).

### Generator Definition

```json
{
    "id": "slash",
    "name": "Slash",
    "requirements": [
        { "type": "current_job_level", "job": "adventuring:fighter", "level": 1 }
    ],
    "energy": 20,
    "hits": [
        {
            "target": "front",
            "party": "enemy",
            "effects": [
                {
                    "type": "damage_flat",
                    "amount": {
                        "base": 10,
                        "scaling": [
                            { "id": "adventuring:strength", "amount": 0.25 }
                        ]
                    }
                },
                {
                    "type": "debuff",
                    "id": "adventuring:bleed",
                    "stacks": {
                        "base": 1,
                        "scaling": [
                            { "id": "adventuring:strength", "amount": 0.025 }
                        ]
                    }
                }
            ]
        }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `requirements` | array | ✗ | Requirements to unlock |
| `energy` | number | ✓ | Energy generated per use |
| `hits` | array | ✓ | Array of hit definitions |
| `isEnemy` | boolean | ✗ | If true, only for monsters |
| `description` | string | ✗ | Template description with {effect.N.amount} placeholders |
| `flavorText` | string | ✗ | Italic flavor text in tooltip |
| `learnType` | string | ✗ | How ability is learned: `normal`, `blue_mage` |
| `learnBonus` | number | ✗ | XP bonus multiplier when learning |
| `isAchievementAbility` | boolean | ✗ | If true, unlocked via achievement |

### Spender Definition

```json
{
    "id": "whirlwind",
    "name": "Whirlwind",
    "requirements": [
        { "type": "current_job_level", "job": "adventuring:fighter", "level": 1 }
    ],
    "cost": 100,
    "hits": [
        {
            "target": "all",
            "party": "enemy",
            "delay": 200,
            "repeat": 2,
            "effects": [
                {
                    "type": "damage_flat",
                    "amount": {
                        "base": 5,
                        "scaling": [
                            { "id": "adventuring:strength", "amount": 0.15 }
                        ]
                    }
                }
            ]
        }
    ],
    "masteryAura": {
        "id": "adventuring:might",
        "stacks": 2
    }
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `requirements` | array | ✗ | Requirements to unlock |
| `cost` | number | ✓ | Energy cost to use |
| `hits` | array | ✓ | Array of hit definitions |
| `isEnemy` | boolean | ✗ | If true, only for monsters |
| `description` | string | ✗ | Template description with {effect.N.amount} placeholders |
| `flavorText` | string | ✗ | Italic flavor text in tooltip |
| `learnType` | string | ✗ | How ability is learned: `normal`, `blue_mage` |
| `learnBonus` | number | ✗ | XP bonus multiplier when learning |
| `isAchievementAbility` | boolean | ✗ | If true, unlocked via achievement |
| `masteryAura` | object | ✗ | Buff applied at area mastery 99 |

### Hit Definition

```json
{
    "target": "random",
    "party": "enemy",
    "delay": 100,
    "repeat": 3,
    "effects": [
        { ... }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `target` | string | ✓ | Target selection method |
| `party` | string | ✓ | Target party |
| `delay` | number | ✗ | Delay between repeats in ms |
| `repeat` | number | ✗ | Number of times to repeat this hit |
| `effects` | array | ✓ | Effects to apply |

**Target Values:**

| Value | Description |
|-------|-------------|
| `front` | First living target |
| `back` | Last living target |
| `random` | Random living target |
| `lowest` | Target with lowest HP |
| `highest` | Target with highest HP |
| `all` | All living targets |
| `self` | The caster |
| `attacker` | Entity that attacked (for reactive effects) |

**Party Values:**

| Value | Description |
|-------|-------------|
| `ally` | Friendly party |
| `enemy` | Enemy party |

---

## Passives

Passives are permanent effects that apply during combat.

### Passive Definition

```json
{
    "id": "dragon_scales",
    "name": "Dragon Scales",
    "requirements": [],
    "effects": [
        {
            "trigger": "encounter_start",
            "type": "immune",
            "duration": 1
        }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `requirements` | array | ✗ | Requirements to unlock |
| `effects` | array | ✓ | Array of effect definitions |

### Passive Examples

**Damage Aura:**
```json
{
    "id": "fire_aura",
    "name": "Fire Aura",
    "effects": [
        {
            "trigger": "turn_start",
            "type": "damage_flat",
            "target": "all",
            "party": "enemy",
            "amount": {
                "base": 5,
                "scaling": [
                    { "id": "adventuring:magic", "amount": 0.1 }
                ]
            }
        }
    ]
}
```

**Encounter Start Debuff:**
```json
{
    "id": "draconic_fury",
    "name": "Draconic Fury",
    "effects": [
        {
            "trigger": "encounter_start",
            "type": "debuff",
            "target": "all",
            "party": "enemy",
            "id": "adventuring:burn",
            "stacks": { "base": 3, "scaling": [] }
        }
    ]
}
```

---

## Equipment

Equipment (Base Items) define weapons, armor, and accessories.

### Basic Equipment Definition

```json
{
    "id": "sword1h",
    "name": "Sword",
    "media": "melvor:assets/media/bank/weapon_sword_bronze.png",
    "type": "adventuring:sword1h",
    "materials": [
        { "id": "adventuring:parts", "qty": 5 }
    ],
    "base": [
        { "id": "adventuring:hitpoints", "amount": 5 },
        { "id": "adventuring:strength", "amount": 8 }
    ],
    "scaling": [
        { "id": "adventuring:hitpoints", "amount": 0.4 },
        { "id": "adventuring:strength", "amount": 0.7 }
    ],
    "upgradeMaterials": [
        { "id": "adventuring:parts", "qty": 2 }
    ],
    "requirements": [
        { "type": "skill_level", "level": 1 }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `media` | string | ✓ | Icon path |
| `type` | string | ✓ | Item type ID (determines slots) |
| `materials` | array | ✓ | Cost to acquire |
| `base` | array | ✓ | Base stats at level 1 |
| `scaling` | array | ✓ | Stat increase per level |
| `upgradeMaterials` | array | ✓ | Cost per upgrade level |
| `requirements` | array | ✗ | Requirements to unlock |
| `effects` | array | ✗ | Special effects (see Effects section) |
| `tier` | number | ✗ | Item tier level (affects salvage) |
| `flavorText` | string | ✗ | Italic flavor text in tooltip |
| `customDescription` | string | ✗ | Override auto-generated description |
| `maxUpgrades` | number | ✗ | Maximum upgrade level (default: 10) |
| `set` | string | ✗ | Equipment set ID (auto-assigned) |

### Equipment with Effects

```json
{
    "id": "vampiric_dagger",
    "name": "Vampiric Dagger",
    "media": "melvor:assets/media/bank/weapon_dagger_dragon.png#shade=red",
    "type": "adventuring:dagger",
    "materials": [...],
    "base": [...],
    "scaling": [...],
    "upgradeMaterials": [...],
    "effects": [
        {
            "id": "adventuring:vampirism",
            "trigger": "encounter_start",
            "stacks": 2
        }
    ]
}
```

### Tiered Equipment (Artifacts)

Artifacts have multiple tiers with different stats and effects:

```json
{
    "id": "ancient_medallion",
    "name": "Ancient Medallion",
    "media": "melvor:assets/media/bank/amulet_of_glory.png#shade=red",
    "type": "adventuring:amulet",
    "isArtifact": true,
    "requirements": [
        { "type": "area_mastery", "area": "adventuring:shadow_temple", "level": 25 },
        { "type": "area_mastery", "area": "adventuring:crystal_caverns", "level": 25 }
    ],
    "tiers": [
        {
            "name": "Ancient Medallion",
            "base": [
                { "id": "adventuring:hitpoints", "amount": 20 },
                { "id": "adventuring:strength", "amount": 15 }
            ],
            "scaling": [
                { "id": "adventuring:hitpoints", "amount": 1.8 },
                { "id": "adventuring:strength", "amount": 1.3 }
            ],
            "materials": [
                { "id": "adventuring:currency", "qty": 5000 },
                { "id": "adventuring:pristine_salvage", "qty": 10 }
            ]
        },
        {
            "name": "Empowered Ancient Medallion",
            "base": [...],
            "scaling": [...],
            "effects": [
                { "id": "adventuring:might", "trigger": "encounter_start", "stacks": 1 }
            ],
            "materials": [...]
        },
        {
            "name": "Ascended Ancient Medallion",
            "base": [...],
            "scaling": [...],
            "effects": [
                { "id": "adventuring:might", "trigger": "encounter_start", "stacks": 2 },
                { "id": "adventuring:fortify", "trigger": "encounter_start", "stacks": 1 }
            ],
            "materials": [...]
        }
    ]
}
```

### Unique Items

Unique items have special triggered effects:

```json
{
    "id": "ring_of_valor",
    ...
    "effects": [
        {
            "id": "adventuring:berserk",
            "trigger": "after_damage_received",
            "chance": 25,
            "stacks": 1
        }
    ]
}
```

Effect trigger properties on equipment:

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Buff/debuff ID to apply |
| `trigger` | string | When effect triggers |
| `stacks` | number | Number of stacks to apply |
| `chance` | number | Percent chance (0-100) |

---

## Jobs

Jobs define hero classes with stat scaling, allowed equipment, and abilities.

### Combat Job Definition

```json
{
    "id": "fighter",
    "tier": 0,
    "name": "Fighter",
    "media": "melvor:assets/media/skills/combat/attack.svg#tint=yellow",
    "requirements": [
        { "type": "skill_level", "level": 1 }
    ],
    "isMilestoneReward": true,
    "allowedItems": [
        "adventuring:helm",
        "adventuring:platebody",
        "adventuring:sword1h",
        "adventuring:sword2h",
        "adventuring:shield"
    ],
    "scaling": [
        { "id": "adventuring:hitpoints", "amount": 1.5 },
        { "id": "adventuring:defence", "amount": 0.5 },
        { "id": "adventuring:agility", "amount": 0.5 },
        { "id": "adventuring:strength", "amount": 1.5 }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `media` | string | ✓ | Icon path |
| `tier` | number | ✗ | Job tier (0 = starter) |
| `requirements` | array | ✗ | Requirements to unlock |
| `isMilestoneReward` | boolean | ✗ | If true, unlocked at milestones |
| `allowedItems` | array | ✓ | Base item IDs this job can equip |
| `scaling` | array | ✓ | Stat scaling per job level |
| `isPassive` | boolean | ✗ | If true, passive job (crafting) |
| `alwaysMultiple` | boolean | ✗ | If true, always assignable to multiple heroes |

### Passive Job Definition

Passive jobs add crafting/town functionality:

```json
{
    "id": "smith",
    "name": "Smith",
    "media": "melvor:assets/media/skills/smithing/smithing.svg#shade=red",
    "requirements": [
        { "type": "skill_level", "level": 5 }
    ],
    "isMilestoneReward": true,
    "isPassive": true,
    "scaling": [
        { "id": "adventuring:smithing", "amount": 1 }
    ]
}
```

Passive jobs typically also define:
- Custom stats
- Buildings (workshops)
- Products (craftable items)
- Tiles (dungeon discovery)
- Consumable types

---

## Buffs & Debuffs

Buffs provide positive effects, debuffs provide negative effects. Both use the same structure.

### Buff/Debuff Definition

```json
{
    "id": "block",
    "name": "Block",
    "media": "melvor:assets/media/status/evasion_increase.png",
    "effects": [
        {
            "trigger": "before_damage_received",
            "type": "absorb",
            "consume": true,
            "amount": 1,
            "perStack": true
        },
        {
            "trigger": "round_end",
            "type": "remove"
        },
        {
            "trigger": "encounter_end",
            "type": "remove",
            "describe": false
        },
        {
            "trigger": "death",
            "type": "remove",
            "describe": false
        }
    ],
    "stackable": true,
    "combineMode": "stack"
}
```

### Aura Effect Properties

Effects within buffs/debuffs have additional properties:

| Property | Type | Description |
|----------|------|-------------|
| `consume` | boolean | Remove 1 stack after triggering |
| `age` | number | Required age (turns) before effect activates |
| `modifier` | number | Multiplier applied to effect |
| `count` | number | Fractional execution (0.5 = every other trigger) |
| `condition` | object | Condition that must be met |
| `chance` | number | Percent chance to trigger (0-100) |
| `perStack` | boolean | Multiply effect by stack count |
| `scaleFrom` | string | Stat source: `source`, `target`, or `snapshot` |

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `media` | string | ✓ | Icon path |
| `effects` | array | ✓ | Effect definitions |
| `description` | string | ✗ | Template description with {effect.N.amount} placeholders |
| `flavorText` | string | ✗ | Italic flavor text in tooltip |
| `stackable` | boolean | ✗ | Can accumulate stacks |
| `combineMode` | string | ✗ | How stacks combine |
| `maxStacks` | number | ✗ | Maximum stack limit |
| `hidden` | boolean | ✗ | If true, not shown in UI |

### Combine Modes

| Mode | Description |
|------|-------------|
| `stack` | Stacks add together |
| `separate` | Each application tracked separately |
| `bySource` | One stack per source |

### Built-in Buffs

| ID | Name | Effect |
|----|------|--------|
| `block` | Block | Absorb damage, removed at round end |
| `regen` | Regen | Heal over time |
| `thorns` | Thorns | Reflect damage to attacker |
| `haste` | Haste | +1% Agility per stack |
| `might` | Might | +1% Strength per stack |
| `barrier` | Barrier | Absorb damage (persists) |
| `arcane_power` | Arcane Power | +1% Magic per stack |
| `divine_favor` | Divine Favor | +1% Prayer per stack |
| `berserk` | Berserk | +30% damage, -15% defence per stack |
| `focus` | Focus | +25% crit chance per stack |
| `empower` | Empower | +100% damage (consumed on attack) |
| `bloodlust` | Bloodlust | +5% damage per stack |
| `fortify` | Fortify | -25% damage received (consumed) |
| `evasion` | Evasion | 30% dodge chance, loses stack on dodge |
| `immunity` | Immunity | Block one debuff |
| `vampirism` | Vampirism | +10% lifesteal per stack |
| `inspiration` | Inspiration | +25% XP per stack |
| `prosperity` | Prosperity | +25% loot per stack |
| `undying` | Undying | Prevent death once |
| `invisible` | Invisible | Untargetable until attack |
| `precision` | Precision | +10% crit chance per stack |
| `protection` | Protection | -5% damage received per stack |
| `stealth` | Stealth | +15% Agility, untargetable |

### Built-in Debuffs

| ID | Name | Effect |
|----|------|--------|
| `stun` | Stunned | Skip turn |
| `bleed` | Bleeding | 8 damage/turn per stack, loses stacks |
| `burn` | Burning | 5 damage/turn per stack, loses stacks |
| `shock` | Shocked | Damage on ability use, then removed |
| `chill` | Chilled | -1% Agility per stack |
| `poison` | Poisoned | 8 damage/turn per stack (persists) |
| `weaken` | Weakened | -5% Strength per stack |
| `vulnerability` | Vulnerable | +5% damage received per stack |
| `marked` | Marked | +10 flat damage received, removed on hit |
| `fear` | Feared | 50% chance skip turn |
| `curse` | Cursed | -25% healing received per stack |
| `slow` | Slowed | -15% Agility per stack |
| `expose` | Exposed | -20% Defence per stack |
| `blind` | Blinded | 25% miss chance per stack |
| `silence` | Silenced | Cannot use spender |
| `taunt` | Taunted | Forced target |
| `confuse` | Confused | 25% chance attack random target |
| `entangle` | Entangled | Skip turn (loses stacks) |
| `decay` | Decaying | 10 damage/turn, loses stacks |
| `doom` | Doomed | 15 damage/turn (persists) |
| `shred` | Shredded | -3% Defence per stack |

---

## Tiles

Tiles are dungeon floor elements with various effects.

### Tile Definition

```json
{
    "id": "fountain",
    "name": "Fountain",
    "media": "melvor:assets/media/skills/firemaking/firemaking.svg",
    "requirements": [],
    "weight": 10,
    "floor_max": 1,
    "dungeon_max": 1,
    "masteryUnlock": false,
    "effects": [
        { "type": "heal_percent", "amount": 20 }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `media` | string | ✓ | Icon path |
| `requirements` | array | ✗ | Requirements to spawn |
| `weight` | number | ✗ | Spawn weight (higher = more common) |
| `floor_max` | number | ✗ | Max per floor (-1 = unlimited) |
| `dungeon_max` | number | ✗ | Max per dungeon run (-1 = unlimited) |
| `masteryUnlock` | boolean | ✗ | If true, only spawns when area is mastered |
| `alwaysShowIcon` | boolean | ✗ | If true, icon always visible on map |
| `effects` | array | ✗ | Effects when tile is activated |

### Built-in Tiles

| ID | Name | Weight | Effect |
|----|------|--------|--------|
| `wall` | Wall | - | Impassable |
| `start` | Start | - | Spawn point |
| `exit` | Floor Exit | - | Triggers exit encounter |
| `boss` | Boss | - | Boss encounter |
| `empty` | Empty | 100 | Nothing |
| `encounter` | Encounter | 30 | Monster encounter |
| `trap` | Trap | 10 | 10% party damage |
| `fountain` | Fountain | 10 | 20% party heal |
| `treasure` | Treasure Chest | 5 | Random loot |

### Tile Effects

**Heal:**
```json
{ "type": "heal_percent", "amount": 20 }
```

**Damage:**
```json
{ "type": "damage_percent", "amount": 10 }
```

**XP Grant (for passive job tiles):**
```json
{ "type": "xp", "amount": 30, "job": "adventuring:smith" }
```

**Loot:**
```json
{
    "type": "loot",
    "pool": [
        { "id": "adventuring:currency", "qty": 100, "weight": 50 },
        { "id": "adventuring:parts", "qty": 30, "weight": 30 }
    ]
}
```

---

## Difficulty Modes

Difficulties modify dungeon runs with different challenges and rewards.

### Difficulty Definition

```json
{
    "id": "heroic",
    "name": "Heroic",
    "media": "melvor:assets/media/main/gamemode_standard.png#shade=red",
    "color": "#ff4444",
    "unlockLevel": 25,
    "isEndless": false,
    "description": "Enemies are stronger but give more rewards.",
    "effects": [
        {
            "trigger": "encounter_start",
            "type": "stat_percent",
            "stat": "all",
            "amount": 50,
            "target": "enemy"
        },
        {
            "trigger": "passive",
            "type": "xp_percent",
            "amount": 200
        },
        {
            "trigger": "passive",
            "type": "loot_percent",
            "amount": 50
        }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `media` | string | ✓ | Icon path |
| `color` | string | ✗ | UI color (hex) |
| `unlockLevel` | number | ✗ | Area mastery level to unlock |
| `isEndless` | boolean | ✗ | If true, infinite waves |
| `description` | string | ✗ | Description text |
| `effects` | array | ✓ | Modifier effects |
| `waveScaling` | object | ✗ | For endless mode stat scaling |
| `waveGeneration` | object | ✗ | Wave generation settings |

### Wave Generation

```json
{
    "waveGeneration": {
        "type": "infinite",
        "floorsPerWave": 1,
        "floorSelection": "first"
    }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | `infinite` for endless mode |
| `floorsPerWave` | number | Floors per wave (default: 1) |
| `floorSelection` | string | `first` or `random` |

### Built-in Difficulties

| ID | Name | Unlock | Description |
|----|------|--------|-------------|
| `normal` | Normal | 0 | Standard difficulty, heal 20% between floors |
| `heroic` | Heroic | 25 | +50% enemy stats, +200% XP, +50% loot |
| `mythic` | Mythic | 75 | +150% enemy stats, enemies start with +2 Might |
| `endless` | Endless | 50 | Infinite waves with scaling difficulty |

### Wave Scaling (Endless Mode)

```json
{
    "waveScaling": {
        "statPercentPerWave": 5,
        "effects": [
            {
                "waveInterval": 5,
                "trigger": "encounter_start",
                "type": "buff",
                "id": "adventuring:might",
                "stacks": 1,
                "target": "enemy"
            }
        ]
    }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `statPercentPerWave` | number | % stat increase per wave (default: 5) |
| `effects` | array | Effects applied at wave intervals |
| `effects[].waveInterval` | number | Apply every N waves |

---

## Achievements

Achievements provide goals with rewards.

### Achievement Definition

```json
{
    "id": "first_blood",
    "name": "First Blood",
    "category": "combat",
    "media": "melvor:assets/media/skills/combat/combat.svg",
    "requirement": {
        "type": "total_kills",
        "target": 1
    },
    "rewards": [
        { "type": "currency", "id": "adventuring:currency", "qty": 100 }
    ],
    "description": "Defeat your first monster."
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `category` | string | ✓ | Category ID |
| `media` | string | ✓ | Icon path |
| `requirement` | object | ✓ | Completion requirement |
| `rewards` | array | ✓ | Rewards on completion |
| `description` | string | ✗ | Description text |

### Achievement Categories

- `combat` - Combat achievements
- `exploration` - Dungeon exploration
- `jobs` - Job progression
- `mastery` - Mastery milestones
- `collection` - Item collection
- `challenge` - Special challenges

### Requirement Types

**Total Kills:**
```json
{ "type": "total_kills", "target": 100 }
```

**Total Clears:**
```json
{ "type": "total_clears", "target": 10 }
```

**Area Clear:**
```json
{ "type": "area_cleared", "area": "adventuring:dragons_lair" }
```

**Area Mastery:**
```json
{ "type": "area_mastery", "target": 50 }
```

**Job Level:**
```json
{ "type": "job_level", "job": "adventuring:fighter", "level": 50 }
```

**Jobs At Level:**
```json
{ "type": "jobs_at_level", "level": 50, "target": 5 }
```

**Kills by Tag:**
```json
{ "type": "kills_by_tag", "tag": "dragon", "target": 100 }
```

**Heroic/Mythic Clears:**
```json
{ "type": "heroic_clears", "target": 10 }
{ "type": "mythic_clears", "target": 5 }
```

**Endless Wave:**
```json
{ "type": "endless_wave", "target": 50 }
```

**Total Endless Waves:**
```json
{ "type": "total_endless_waves", "target": 100 }
```

**Slayer Tasks:**
```json
{ "type": "slayer_tasks", "target": 50 }
```

**Set Bonus Active:**
```json
{ "type": "set_bonus_active", "pieces": 3 }
```

**Monster Mastery:**
```json
{ "type": "monster_mastery", "target": 50 }
{ "type": "total_monster_mastery", "target": 500 }
```

**Learned Abilities:**
```json
{ "type": "learned_abilities", "target": 10 }
```

**Total Materials/Currency:**
```json
{ "type": "total_materials", "target": 1000 }
{ "type": "total_currency", "target": 5000 }
```

**Unique Monsters:**
```json
{ "type": "unique_monsters", "target": 50 }
```

**Flawless/Last Stand Wins:**
```json
{ "type": "flawless_wins", "target": 10 }
{ "type": "last_stand_wins", "target": 5 }
```

**Fast Wins:**
```json
{ "type": "fast_wins", "rounds": 3, "target": 10 }
```

**Total Damage/Healing:**
```json
{ "type": "total_damage", "target": 100000 }
{ "type": "total_healing", "target": 50000 }
```

**Job Unlocked:**
```json
{ "type": "job_unlocked", "job": "adventuring:knight" }
```

**Passive Job Levels:**
```json
{ "type": "any_passive_job_level", "target": 50 }
{ "type": "all_passive_jobs_level", "level": 25 }
```

### Reward Types

**Currency:**
```json
{ "type": "currency", "id": "adventuring:currency", "qty": 1000 }
```

**Material:**
```json
{ "type": "material", "id": "adventuring:pristine_salvage", "qty": 5 }
```

**Effect (permanent buff):**
```json
{ "type": "effect", "effects": [{ "type": "xp_percent", "amount": 5 }] }
```

**Ability Unlock:**
```json
{ "type": "ability", "id": "adventuring:special_move" }
```

---

## Slayer Tasks

Slayer task types define bounty objectives.

### Slayer Task Type Definition

```json
{
    "id": "kill",
    "name": "Kill Task",
    "descriptionTemplate": "Kill {target} {count} times.",
    "targetType": "monster",
    "baseRequirements": [0, 0, 0, 0, 0, 0],
    "requirementVariance": [0, 0, 0, 0, 0, 0],
    "baseRewards": [10, 20, 35, 50, 75, 100],
    "materialRewardChance": [0.1, 0.15, 0.2, 0.25, 0.3, 0.4],
    "consumableRewardChance": [0.05, 0.1, 0.15, 0.2, 0.25, 0.3]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `descriptionTemplate` | string | ✓ | Template with `{target}`, `{count}` |
| `progressVerb` | string | ✗ | Verb for progress display (e.g., "Kill", "Collect") |
| `targetType` | string | ✓ | What the task targets |
| `targetStat` | string | ✗ | Stat name for stat-based tasks |
| `targetDifficulty` | string | ✗ | Difficulty for difficulty-based tasks |
| `baseRequirements` | array | ✓ | Base count per tier [1-6] |
| `requirementVariance` | array | ✓ | Random variance per tier |
| `baseRewards` | object | ✓ | Reward config (see below) |
| `materialRewardChance` | array | ✗ | Chance for material bonus per tier |
| `consumableRewardChance` | array | ✗ | Chance for consumable bonus per tier |

### Base Rewards Object

```json
{
    "baseRewards": {
        "currency": [10, 20, 35, 50, 75, 100],
        "currencyVariance": [5, 10, 15, 25, 35, 50],
        "xp": [50, 100, 200, 350, 500, 750],
        "xpVariance": [10, 25, 50, 100, 150, 200]
    }
}
```

### Target Types

| Type | Description |
|------|-------------|
| `monster` | Specific monster |
| `monster_tag` | Monsters with specific tag |
| `material` | Collect materials |
| `area` | Clear specific area |
| `stat` | Track cumulative stat (uses `targetStat`) |
| `difficulty` | Clear at specific difficulty |
| `endless_wave` | Reach wave in endless mode |

### Built-in Task Types

| ID | Description |
|----|-------------|
| `kill` | Kill specific monster |
| `kill_tag` | Kill monsters with tag |
| `collect` | Collect materials |
| `clear` | Clear area (normal) |
| `clear_heroic` | Clear area (heroic) |
| `clear_mythic` | Clear area (mythic) |
| `endless_waves` | Reach wave in endless |
| `deal_damage` | Deal total damage |
| `healing_done` | Heal total amount |
| `apply_debuffs` | Apply debuff stacks |
| `apply_buffs` | Apply buff stacks |
| `earn_currency` | Earn adventuring coins |
| `explore_floors` | Explore floor tiles |
| `find_tiles` | Find special tiles |

---

## Tavern Drinks

Drinks provide temporary party buffs.

### Drink Definition

```json
{
    "id": "warriors_brew",
    "name": "Warrior's Brew",
    "media": "melvor:assets/media/bank/potion_melee_i.png",
    "tiers": [
        {
            "tier": 1,
            "flavorText": "A hearty brew for warriors.",
            "materials": [
                { "id": "adventuring:currency", "qty": 50 }
            ],
            "effects": [
                {
                    "trigger": "passive",
                    "type": "stat_percent",
                    "stat": "adventuring:strength",
                    "amount": 5
                }
            ]
        },
        {
            "tier": 2,
            "flavorText": "An even heartier brew.",
            "materials": [
                { "id": "adventuring:currency", "qty": 150 },
                { "id": "adventuring:parts", "qty": 10 }
            ],
            "effects": [
                {
                    "trigger": "passive",
                    "type": "stat_percent",
                    "stat": "adventuring:strength",
                    "amount": 10
                }
            ]
        }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `media` | string | ✓ | Icon path |
| `tiers` | array | ✓ | Tier definitions |

### Tier Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `tier` | number | ✓ | Tier number (1-4) |
| `nameSuffix` | string | ✗ | Appended to name |
| `media` | string | ✗ | Override icon for this tier |
| `flavorText` | string | ✗ | Description/flavor text |
| `materials` | array | ✓ | Purchase cost |
| `effects` | array | ✓ | Effects while active |

---

## Consumables

Consumables are single-use items crafted and equipped for dungeon runs.

### Consumable Type Definition

```json
{
    "id": "steel_resolve",
    "name": "Steel Resolve",
    "media": "melvor:assets/media/bank/steel_bar.png",
    "type": "tool",
    "sourceJob": "adventuring:smith",
    "maxCharges": 3,
    "tiers": [
        {
            "tier": 1,
            "nameSuffix": "I",
            "media": "melvor:assets/media/bank/steel_bar.png",
            "flavorText": "Slaying enemies fortifies your defenses.",
            "effects": [
                {
                    "type": "buff",
                    "trigger": "kill",
                    "id": "fortify",
                    "stacks": 1,
                    "target": "self"
                }
            ],
            "materials": [
                { "id": "adventuring:crude_slag", "count": 3 }
            ]
        },
        {
            "tier": 2,
            "nameSuffix": "II",
            "media": "melvor:assets/media/bank/gold_bar.png",
            "flavorText": "Slaying enemies provides stronger fortification.",
            "effects": [
                {
                    "type": "buff",
                    "trigger": "kill",
                    "id": "fortify",
                    "stacks": 2,
                    "target": "self"
                }
            ],
            "materials": [
                { "id": "adventuring:refined_slag", "count": 3 }
            ]
        }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Base display name |
| `media` | string | ✓ | Default icon path |
| `type` | string | ✗ | Category (`tool`, `potion`, etc.) |
| `sourceJob` | string | ✗ | Job that crafts this |
| `maxCharges` | number | ✗ | Max uses per dungeon |
| `target` | string | ✗ | Default target for effects (`self`, `ally`, `enemy`) |
| `tiers` | array | ✓ | Tier definitions |

### Consumable Tier Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `tier` | number | ✓ | Tier number (1-4) |
| `nameSuffix` | string | ✗ | Appended to name (e.g., "I", "II") |
| `media` | string | ✗ | Override icon for this tier |
| `flavorText` | string | ✗ | Description text |
| `effects` | array | ✓ | Effects when triggered |
| `materials` | array | ✓ | Crafting cost |

---

## Buildings & Products

Buildings are town locations with functionality. Products are craftable items.

### Building Definition

```json
{
    "id": "forge",
    "type": "workshop",
    "name": "Forge",
    "description": "Smelt ores into bars and craft metal equipment.",
    "media": "melvor:assets/media/skills/township/Blacksmiths_Forge.png",
    "requirements": [],
    "idle": [
        "Hammering away",
        "Stoking the fire"
    ],
    "actions": [
        "adventuring:work"
    ],
    "products": [
        "adventuring:bronze_bar",
        "adventuring:iron_bar",
        "adventuring:craft_steel_resolve"
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `type` | string | ✓ | `page` or `workshop` |
| `name` | string | ✓ | Display name |
| `description` | string | ✗ | Description text |
| `media` | string | ✓ | Icon path |
| `requirements` | array | ✗ | Requirements to unlock |
| `page` | string | ✗ | Page ID (for `page` type) |
| `idle` | array | ✗ | Idle status messages |
| `actions` | array | ✗ | Town action IDs |
| `products` | array | ✗ | Product IDs available |
| `itemSlotOrder` | array | ✗ | Equipment slot display order |

### Product Definition

```json
{
    "id": "bronze_bar",
    "item": "melvorD:Bronze_Bar",
    "outputType": "item",
    "tiers": [
        {
            "tier": 1,
            "count": 1,
            "requirements": [
                { "type": "current_job_level", "job": "adventuring:smith", "level": 1 }
            ],
            "materials": [
                { "id": "adventuring:crude_slag", "count": 1 }
            ]
        },
        {
            "tier": 2,
            "count": 3,
            "requirements": [
                { "type": "current_job_level", "job": "adventuring:smith", "level": 25 }
            ],
            "materials": [
                { "id": "adventuring:refined_slag", "count": 1 }
            ]
        }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `outputType` | string | ✓ | `item`, `material`, `consumable`, `conversion` |
| `item` | string | ✗ | Melvor item ID (for `item` output) |
| `material` | string | ✗ | Material ID (for `material` output) |
| `consumable` | string | ✗ | Consumable ID (for `consumable` output) |
| `tiers` | array | ✓ | Production tiers |

### Product Tier Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `tier` | number | ✓ | Tier number |
| `count` | number | ✓ | Output quantity |
| `requirements` | array | ✗ | Requirements to use this tier |
| `materials` | array | ✓ | Input materials |
| `material` | string | ✗ | Output material (for conversions) |

---

## Mastery

Mastery categories define progression milestones with rewards.

### Mastery Category Definition

```json
{
    "id": "monsters",
    "name": "Monster Mastery",
    "media": "melvor:assets/media/skills/combat/combat.svg",
    "maxLevel": 99,
    "milestones": [
        {
            "level": 1,
            "scaling": true,
            "effects": [
                { "trigger": "passive", "type": "drop_rate_percent", "amount": 1 }
            ]
        },
        {
            "level": 5,
            "effects": [
                { "trigger": "passive", "type": "unlock", "unlockType": "drop_table_reveal" },
                { "trigger": "passive", "type": "xp_percent", "amount": 5 }
            ]
        },
        {
            "level": 50,
            "effects": [
                { "trigger": "passive", "type": "ability_learn_chance_percent", "amount": 50 }
            ]
        }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `media` | string | ✓ | Icon path |
| `maxLevel` | number | ✓ | Maximum mastery level |
| `milestones` | array | ✓ | Milestone definitions |

### Milestone Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `level` | number | ✓ | Level to unlock |
| `scaling` | boolean | ✗ | If true, effect scales per level |
| `effects` | array | ✓ | Effects at this milestone |

### Mastery Categories

| ID | Name | Description |
|----|------|-------------|
| `monsters` | Monster Mastery | Per-monster progression |
| `areas` | Area Mastery | Per-area progression |
| `jobs` | Job Mastery | Per-job progression |
| `equipment` | Equipment Mastery | Per-item progression |

---

## Tutorials

Tutorials guide new players through game mechanics.

### Tutorial Definition

```json
{
    "id": "tutorial_intro",
    "name": "Welcome to Adventuring",
    "priority": 0,
    "trigger": { "type": "immediate" },
    "requiresState": "town",
    "steps": [
        {
            "target": "combatJob:0",
            "message": "Welcome! Each hero needs a Combat Job...",
            "position": "bottom"
        },
        {
            "target": "ability:0:0",
            "message": "Each job has Generators and Spenders...",
            "position": "bottom"
        }
    ],
    "chainTo": "adventuring:tutorial_dungeon"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `priority` | number | ✗ | Display priority (lower = earlier) |
| `trigger` | object | ✓ | When tutorial activates |
| `requiresState` | string | ✗ | Required game state (`town`, `dungeon`) |
| `steps` | array | ✓ | Tutorial step definitions |
| `chainTo` | string | ✗ | Next tutorial to trigger |

### Trigger Types

```json
{ "type": "immediate" }
{ "type": "chained" }
{ "type": "event", "event": "dungeonStart" }
{ "type": "currency", "currencyId": "currency", "amount": 25 }
{ "type": "material", "check": "anyUpgrade" }
{ "type": "mastery", "category": "job", "level": 10 }
```

### Step Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `target` | string | ✗ | UI element to highlight |
| `message` | string | ✓ | Tutorial text |
| `position` | string | ✗ | Tooltip position (`top`, `bottom`, `left`, `right`) |

---

## Tags

Tags categorize monsters for slayer tasks and other systems.

### Tag Definition

```json
{
    "id": "dragon",
    "name": "Dragon",
    "media": "melvor:assets/media/monsters/dragon_red.png"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `media` | string | ✓ | Icon path |

### Built-in Tags

| ID | Name |
|----|------|
| `undead` | Undead |
| `beast` | Beast |
| `dragon` | Dragon |
| `elemental` | Elemental |
| `humanoid` | Humanoid |
| `spider` | Spider |
| `demon` | Demon |
| `bird` | Bird |
| `aquatic` | Aquatic |
| `construct` | Construct |
| `giant` | Giant |
| `golbin` | Golbin |
| `boss` | Boss |

---

## Item Types & Slots

Item types define equipment categories and slot assignments.

### Item Type Definition

```json
{
    "id": "sword2h",
    "name": "Two-Handed Sword",
    "slots": ["adventuring:weapon"],
    "occupies": ["adventuring:offhand"]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `slots` | array | ✓ | Slots this item uses |
| `pairs` | array | ✗ | Dual-wield partner types |
| `occupies` | array | ✗ | Additional slots blocked |

### Dual-Wielding

```json
{
    "id": "sword1h",
    "name": "One-Handed Sword",
    "slots": ["adventuring:weapon"],
    "pairs": ["adventuring:sword1h", "adventuring:dagger"]
}
```

### Built-in Item Slots

| ID | Name |
|----|------|
| `weapon` | Weapon |
| `offhand` | Offhand |
| `head` | Head |
| `body` | Body |
| `legs` | Legs |
| `hands` | Hands |
| `feet` | Feet |
| `amulet` | Neck |
| `cape` | Cape |
| `ring1` | Ring |
| `ring2` | Ring |

### Common Item Types

**Weapons:**
- `sword1h`, `sword2h`, `dagger`, `axe`, `mace`, `hammer2h`, `polearm`
- `bow`, `crossbow`, `knives`, `javelin`
- `staff`, `wand`, `orb`

**Armor:**
- `helm`, `cowl`, `hat` (head)
- `platebody`, `vest`, `robe_top` (body)
- `platelegs`, `chaps`, `robe_bottom` (legs)
- `gauntlets`, `vambraces`, `gloves` (hands)
- `sabatons`, `boots`, `shoes` (feet)

**Accessories:**
- `shield` (offhand)
- `amulet` (neck)
- `ring` (ring1/ring2)
- `cape` (cape)

---

## Equipment Sets

Equipment sets provide bonuses when multiple pieces from the same set are equipped.

### Equipment Set Definition

```json
{
    "id": "dragon_set",
    "name": "Dragon Set",
    "items": [
        "adventuring:dragon_helm",
        "adventuring:dragon_platebody",
        "adventuring:dragon_platelegs"
    ],
    "bonuses": [
        {
            "pieces": 2,
            "effects": [
                { "trigger": "passive", "type": "stat_percent", "stat": "adventuring:strength", "amount": 10 }
            ]
        },
        {
            "pieces": 3,
            "effects": [
                { "trigger": "passive", "type": "stat_percent", "stat": "adventuring:strength", "amount": 20 },
                { "trigger": "encounter_start", "type": "buff", "id": "adventuring:might", "stacks": 1 }
            ]
        }
    ]
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✓ | Unique identifier |
| `name` | string | ✓ | Display name |
| `items` | array | ✓ | Array of base item IDs in the set |
| `bonuses` | array | ✓ | Tier bonus definitions |

### Set Bonus Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `pieces` | number | ✓ | Number of pieces required |
| `effects` | array | ✓ | Effects applied at this tier |

---

## Requirements

Requirements gate content behind various conditions.

### Requirement Types

**Skill Level:**
```json
{ "type": "skill_level", "level": 25 }
```
Requires Adventuring skill level.

**Job Level:**
```json
{ "type": "job_level", "job": "adventuring:fighter", "level": 10 }
```
Requires specific job at level.

**Current Job Level:**
```json
{ "type": "current_job_level", "job": "adventuring:fighter", "level": 5 }
```
Requires hero's current job to be at level.

**Area Mastery:**
```json
{ "type": "area_mastery", "area": "adventuring:dragons_lair", "level": 25 }
```
Requires area mastery level.

**Melvor Skill Level:**
```json
{ "type": "melvor_skill_level", "skill": "melvorD:Smithing", "level": 50 }
```
Requires base Melvor skill level.

**Dead (for town actions):**
```json
{ "type": "dead" }
```
Hero must be dead.

**Comparison:**
```json
{ "type": "comparison", "property": "hitpoints_percent", "operator": "<", "value": 100 }
```
Compare property against value. Operators: `<`, `<=`, `==`, `>=`, `>`

**Slayer Tasks Completed:**
```json
{ "type": "slayer_tasks_completed", "count": 50 }
```
Requires total slayer tasks completed.

**Achievement Completion:**
```json
{ "type": "achievement_completion", "id": "adventuring:first_blood" }
```
Requires specific achievement completed.

**Area Cleared:**
```json
{ "type": "area_cleared", "area": "adventuring:dragons_lair" }
```
Requires area to have been cleared at least once.

**Item Upgrade:**
```json
{ "type": "item_upgrade", "item": "adventuring:dragon_sword", "level": 10 }
```
Requires equipment upgrade level.

**Dropped (special):**
```json
{ "type": "dropped" }
```
Item must be found as a drop (not craftable).

**Always False:**
```json
{ "type": "always_false", "hint": "Unlock through special event" }
```
Cannot be met normally; used for special unlocks.

**Multiple Requirements:**
```json
"requirements": [
    { "type": "skill_level", "level": 40 },
    { "type": "area_mastery", "area": "adventuring:fire_temple", "level": 10 }
]
```
All requirements must be met (AND logic).

---

## Effects System

Effects are the core mechanic for abilities, buffs, debuffs, equipment, and more.

### Effect Structure

```json
{
    "trigger": "before_damage_delivered",
    "type": "damage_modifier_percent",
    "amount": 25,
    "target": "self",
    "party": "ally",
    "condition": { "type": "hp_below", "threshold": 50 },
    "chance": 100,
    "consume": false,
    "perStack": true,
    "describe": true
}
```

### Common Effect Properties

| Property | Type | Description |
|----------|------|-------------|
| `trigger` | string | When effect activates |
| `type` | string | What the effect does |
| `amount` | number/object | Effect magnitude |
| `target` | string | Who receives the effect |
| `party` | string | Target party |
| `condition` | object | Condition to check |
| `chance` | number | Percent chance (0-100) |
| `consume` | boolean | Remove stack after use |
| `perStack` | boolean | Multiply by stacks |
| `describe` | boolean | Show in descriptions |
| `count` | number | Fractional execution (0.5 = every other) |
| `limit` | string | Limit type: `combat`, `round`, or `turn` |
| `times` | number | Max triggers per limit period (default: 1) |

### Triggers

**Combat Flow:**
| Trigger | When |
|---------|------|
| `passive` | Always active |
| `encounter_start` | Combat begins |
| `encounter_end` | Combat ends |
| `round_start` | Round begins |
| `round_end` | Round ends |
| `turn_start` | Turn begins |
| `turn_end` | Turn ends |

**Damage:**
| Trigger | When |
|---------|------|
| `before_damage_delivered` | Before dealing damage |
| `after_damage_delivered` | After dealing damage |
| `before_damage_received` | Before taking damage |
| `after_damage_received` | After taking damage |

**Abilities:**
| Trigger | When |
|---------|------|
| `before_ability_cast` | Before using ability |
| `after_ability_cast` | After using ability |
| `before_spender_cast` | Before using spender |
| `after_spender_cast` | After using spender |

**Status:**
| Trigger | When |
|---------|------|
| `before_debuff_received` | Before receiving debuff |
| `before_heal_received` | Before receiving heal |
| `kill` | After killing target |
| `death` | On death |
| `dodge` | On successful dodge |
| `targeting` | When being targeted |

### Effect Types

**Damage:**
| Type | Description |
|------|-------------|
| `damage_flat` | Deal flat damage |
| `damage_percent` | Deal % of max HP damage |
| `damage_modifier_flat` | Add flat damage to attacks |
| `damage_modifier_percent` | Add % damage to attacks |

**Healing:**
| Type | Description |
|------|-------------|
| `heal_flat` | Heal flat amount |
| `heal_percent` | Heal % of max HP |
| `reduce_heal_percent` | Reduce healing received |
| `lifesteal` | Heal % of damage dealt |

**Buffs/Debuffs:**
| Type | Description |
|------|-------------|
| `buff` | Apply buff stacks |
| `debuff` | Apply debuff stacks |
| `remove` | Remove this status |
| `remove_stacks` | Remove N stacks |
| `prevent_debuff` | Block debuff application |

**Stats:**
| Type | Description |
|------|-------------|
| `stat_flat` | Add flat stat bonus |
| `stat_percent` | Add % stat bonus |

**Defense:**
| Type | Description |
|------|-------------|
| `absorb` | Absorb damage (1 per stack) |
| `reduce_damage_percent` | Reduce damage by % |
| `evade` | Completely evade attack |
| `dodge` | Chance to dodge |
| `prevent_death` | Survive lethal damage |
| `prevent_lethal` | Cannot go below 1 HP |

**Combat Control:**
| Type | Description |
|------|-------------|
| `skip` | Skip turn |
| `prevent_ability` | Cannot use ability |
| `miss` | Attack misses |
| `crit_chance` | Add crit chance % |
| `reflect` | Reflect % damage |
| `force_target` | Must target this entity |
| `confuse` | May target wrong party |
| `untargetable` | Cannot be targeted |

**Progression:**
| Type | Description |
|------|-------------|
| `xp_percent` | Bonus XP % |
| `loot_percent` | Bonus loot % |
| `drop_rate_percent` | Bonus drop rate % |
| `drop_quantity_percent` | Bonus drop quantity % |

**Unlocks:**
| Type | Description |
|------|-------------|
| `unlock` | Unlock feature |
| `immune` | Temporary immunity |

**Other:**
| Type | Description |
|------|-------------|
| `xp` | Grant XP to job |
| `loot` | Grant loot |
| `energy` | Add/remove energy |
| `revive` | Revive dead hero |
| `work` | Perform work action |

### Target Values

| Value | Description |
|-------|-------------|
| `self` | The entity with this effect |
| `front` | First living target |
| `back` | Last living target |
| `random` | Random living target |
| `lowest` | Lowest HP target |
| `highest` | Highest HP target |
| `all` | All living targets |
| `attacker` | Entity that attacked |
| `enemy` | Enemy party |
| `ally` | Allied party |

### Conditions

**HP Threshold:**
```json
{ "type": "hp_below", "threshold": 50 }
{ "type": "hp_above", "threshold": 25 }
```

**Chance:**
```json
{ "type": "chance", "value": 50 }
```

**Has Buff/Debuff:**
```json
{ "type": "has_buff", "id": "adventuring:might" }
{ "type": "has_debuff", "id": "adventuring:bleed" }
```

---

## Scaling Values

Many effects use scaling values that combine a base amount with stat scaling.

### Scaling Value Structure

```json
{
    "base": 10,
    "scaling": [
        { "id": "adventuring:strength", "amount": 0.25 },
        { "id": "adventuring:agility", "amount": 0.1 }
    ]
}
```

**Formula:** `final = base + (stat1 * amount1) + (stat2 * amount2) + ...`

### Scale From Property

For effects that need to scale from the target's stats instead of the source's:

```json
{
    "type": "damage_flat",
    "amount": {
        "base": 0,
        "scaling": [
            { "id": "adventuring:hitpoints", "amount": 0.1 }
        ]
    },
    "scaleFrom": "target"
}
```

| Value | Description |
|-------|-------------|
| `source` | Scale from ability user's stats (default) |
| `target` | Scale from target's stats |
| `snapshot` | Use stats captured when effect was applied |

### Usage Examples

**Damage with Scaling:**
```json
{
    "type": "damage_flat",
    "amount": {
        "base": 10,
        "scaling": [
            { "id": "adventuring:strength", "amount": 0.5 }
        ]
    }
}
```

**Stacks with Scaling:**
```json
{
    "type": "debuff",
    "id": "adventuring:bleed",
    "stacks": {
        "base": 1,
        "scaling": [
            { "id": "adventuring:strength", "amount": 0.05 }
        ]
    }
}
```

**Equipment Stat Scaling:**
```json
{
    "scaling": [
        { "id": "adventuring:hitpoints", "amount": 1.5 },
        { "id": "adventuring:strength", "amount": 2.0 }
    ]
}
```
Equipment scaling is per upgrade level.

### Static Values

For non-scaling values, use just the number:

```json
{ "type": "damage_flat", "amount": 50 }
{ "type": "buff", "id": "adventuring:might", "stacks": 2 }
```

Or explicit zero scaling:

```json
{
    "amount": {
        "base": 50,
        "scaling": []
    }
}
```

---

## Complete Examples

### Adding a New Area with Monsters

Create `data/areas/my_dungeon.json`:

```json
{
    "$schema": "https://www.melvoridle.com/assets/schema/gameData.json",
    "namespace": "adventuring",
    "data": {
        "skillData": [{
            "skillID": "adventuring:Adventuring",
            "data": {
                "areas": [{
                    "id": "my_dungeon",
                    "name": "My Dungeon",
                    "media": "melvor:assets/media/monsters/goblin.png",
                    "requirements": [
                        { "type": "skill_level", "level": 10 }
                    ],
                    "height": 5,
                    "width": 5,
                    "floors": [
                        {
                            "monsters": [
                                { "id": "adventuring:my_monster", "weight": 100 }
                            ],
                            "exit": ["adventuring:my_monster", "adventuring:my_monster"]
                        },
                        {
                            "monsters": [
                                { "id": "adventuring:my_monster", "weight": 50 },
                                { "id": "adventuring:my_boss", "weight": 50 }
                            ],
                            "exit": ["adventuring:my_boss"]
                        }
                    ]
                }],
                "monsters": [
                    {
                        "id": "my_monster",
                        "name": "My Monster",
                        "media": "melvor:assets/media/monsters/goblin.png",
                        "tags": ["humanoid"],
                        "xp": 5,
                        "stats": [
                            { "id": "adventuring:hitpoints", "amount": 20 },
                            { "id": "adventuring:defence", "amount": 5 },
                            { "id": "adventuring:agility", "amount": 10 },
                            { "id": "adventuring:strength", "amount": 8 }
                        ],
                        "generator": "adventuring:my_attack",
                        "spender": "adventuring:my_special",
                        "passives": [],
                        "loot": [
                            { "id": "adventuring:currency", "qty": 10, "type": "currency" },
                            { "id": "adventuring:parts", "qty": 3, "type": "salvage" }
                        ]
                    },
                    {
                        "id": "my_boss",
                        "name": "My Boss",
                        "media": "melvor:assets/media/monsters/goblin.png#shade=red",
                        "tags": ["humanoid", "boss"],
                        "xp": 15,
                        "isBoss": true,
                        "stats": [
                            { "id": "adventuring:hitpoints", "amount": 50 },
                            { "id": "adventuring:defence", "amount": 15 },
                            { "id": "adventuring:agility", "amount": 15 },
                            { "id": "adventuring:strength", "amount": 20 }
                        ],
                        "generator": "adventuring:my_attack",
                        "spender": "adventuring:my_special",
                        "passives": [],
                        "loot": [
                            { "id": "adventuring:currency", "qty": 50, "type": "currency" },
                            { "id": "adventuring:parts", "qty": 10, "type": "salvage" },
                            { "id": "adventuring:big_parts", "qty": 3, "type": "salvage" }
                        ]
                    }
                ],
                "generators": [
                    {
                        "id": "my_attack",
                        "name": "Basic Attack",
                        "requirements": [],
                        "isEnemy": true,
                        "energy": 30,
                        "hits": [{
                            "target": "front",
                            "party": "enemy",
                            "effects": [{
                                "type": "damage_flat",
                                "amount": {
                                    "base": 5,
                                    "scaling": [
                                        { "id": "adventuring:strength", "amount": 0.3 }
                                    ]
                                }
                            }]
                        }]
                    }
                ],
                "spenders": [
                    {
                        "id": "my_special",
                        "name": "Power Attack",
                        "requirements": [],
                        "isEnemy": true,
                        "cost": 100,
                        "hits": [{
                            "target": "front",
                            "party": "enemy",
                            "effects": [
                                {
                                    "type": "damage_flat",
                                    "amount": {
                                        "base": 15,
                                        "scaling": [
                                            { "id": "adventuring:strength", "amount": 0.5 }
                                        ]
                                    }
                                },
                                {
                                    "type": "debuff",
                                    "id": "adventuring:weaken",
                                    "stacks": 2
                                }
                            ]
                        }]
                    }
                ]
            }
        }]
    }
}
```

### Adding New Equipment

Create or add to an items file:

```json
{
    "baseItems": [{
        "id": "my_sword",
        "name": "My Sword",
        "media": "melvor:assets/media/bank/weapon_sword_dragon.png#shade=purple",
        "type": "adventuring:sword1h",
        "requirements": [
            { "type": "skill_level", "level": 30 }
        ],
        "materials": [
            { "id": "adventuring:currency", "qty": 500 },
            { "id": "adventuring:big_parts", "qty": 10 }
        ],
        "base": [
            { "id": "adventuring:hitpoints", "amount": 15 },
            { "id": "adventuring:strength", "amount": 25 }
        ],
        "scaling": [
            { "id": "adventuring:hitpoints", "amount": 1.2 },
            { "id": "adventuring:strength", "amount": 2.0 }
        ],
        "upgradeMaterials": [
            { "id": "adventuring:big_parts", "qty": 5 }
        ],
        "effects": [
            {
                "id": "adventuring:might",
                "trigger": "kill",
                "stacks": 1
            }
        ]
    }]
}
```

---

## Tips & Best Practices

1. **Test incrementally** - Add one thing at a time and verify it works
2. **Check the console** - Errors appear in browser developer console
3. **Use existing examples** - Copy similar content as a template
4. **Balance carefully** - Compare stats to similar tier content
5. **Namespace everything** - Always use `adventuring:` prefix for references
6. **Validate JSON** - Use a JSON validator before testing
7. **Document changes** - Note what you add for future reference

---

*Last updated: January 2026*

