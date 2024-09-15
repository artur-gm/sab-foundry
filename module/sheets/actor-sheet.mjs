import {
  onManageActiveEffect,
  prepareActiveEffectCategories
} from "../helpers/effects.mjs";

import { clampAttribute, clampValue } from "../helpers/sheet.mjs";
import * as SABRolls from "../helpers/rolls.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class SabActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["spellburn-and-battlescars", "sheet", "actor"],
      width: 800,
      height: 800,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "items"
        }
      ]
    });
  }

  /** @override */
  get template() {
    return `systems/spellburn-and-battlescars/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = this.document.toPlainObject();

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Adding a pointer to CONFIG.SAB
    context.config = CONFIG.SAB;

    // Prepare character data and items.
    if (actorData.type === "character") {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    // Prepare NPC data and items.
    if (actorData.type === "npc") {
      this._prepareItems(context);
    }

    // Enrich biography info for display
    // Enrichment turns text like `[[/r 1d20]]` into buttons
    context.enrichedBiography = await TextEditor.enrichHTML(
      this.actor.system.biography,
      {
        // Whether to show secret blocks in the finished html
        secrets: this.document.isOwner,
        // Data to fill in for inline rolls
        rollData: this.actor.getRollData(),
        // Relative UUID resolution
        relativeTo: this.actor
      }
    );

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(
      // A generator that returns all effects stored on the actor
      // as well as any items
      this.actor.allApplicableEffects()
    );

    return context;
  }

  /**
   * Character-specific context modifications
   *
   * @param {object} context The context object to mutate
   */
  _prepareCharacterData(context) {
    context.system.health = clampAttribute(
      context.system.health.value,
      context.system.health.max
    );
    context.system.body = clampAttribute(
      context.system.body.value,
      context.system.body.max
    );
    context.system.mind = clampAttribute(
      context.system.mind.value,
      context.system.mind.max
    );

    context.system.attributes.luck.value = clampValue(context.system.attributes.luck.value);
    context.system.ar.value = clampValue(context.system.ar.value, 0, 3);
  }

  /**
   * Organize and classify Items for Actor sheets.
   *
   * @param {object} context The context object to mutate
   */
  _prepareItems(context) {
    // Initialize containers.
    const gear = [];
    const features = [];
    const spells = [];

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      // Append to gear.
      if (i.type === "item") {
        gear.push(i);
      }
      else if (i.type === "feature") {
        features.push(i);
      }
      // Append to spells.
      else if (i.type === "spell") {
        spells.push(i);
      }
    }

    // Assign and return
    context.gear = gear;
    context.features = features;
    context.spells = spells;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.on("click", ".item-edit", ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Handle sheet rolls
    if (this.actor.isOwner) {
      html.on("click", ".attribute-save-roll", this._onAttributeSaveRoll.bind(this));
      html.on("click", ".short-rest-roll", this._onShortRestRoll.bind(this));
    }

    // Add Inventory Item
    html.on("click", ".item-create", this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.on("click", ".item-delete", ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Active Effect management
    html.on("click", ".effect-control", ev => {
      const row = ev.currentTarget.closest("li");
      const document =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

    // Rollable abilities.
    html.on("click", ".rollable", this._onRoll.bind(this));

    // Roll new character.
    html.on("click", ".roll-new-character", this._rollNewCharacter.bind(this));

    // Level up.
    html.on("click", ".level-up", this._levelUp.bind(this));

    // Handle gold
    html.on("change", "#gold", ev => {
      this._onGoldChange(ev);
    });

    // Archetype and origin config
    html.find(".character-archetype").click(this._onArchetypeConfig.bind(this));
    html.find(".character-origin").click(this._onOriginConfig.bind(this));

    // Battlescars handling
    html.on("click", "#current_hp", ev => {
      this.actor.update({"system.health.old": ev.target.value}); // Save the current health value
    });
    html.on("change", "#current_hp", ev => {
      this._onHealthChange(ev);
    });

    // Add and remove inventory slots
    html.on("click", "#add-slot", this._onAddInventorySlot.bind(this));
    html.on("click", "#remove-slot", this._onRemoveInventorySlot.bind(this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = ev => this._onDragStart(ev);
      html.find("li.item").each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }

    // Toggle character's isDeprived status
    html.on("click", "#toggle-deprived", ev => this._onToggleDeprived(ev));
  }

  async _onAttributeSaveRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    if (dataset) {
      SABRolls.AttributeSaveRoll(dataset, this.actor);
    }
  }

  async _onShortRestRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    if (dataset) {
      SABRolls.ShortRestRoll(dataset, this.actor);
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = foundry.utils.duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system.type;

    // Finally, create the item!
    await Item.create(itemData, { parent: this.actor });
    this._checkInvSlots();
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   * @returns {Roll|void} The resulting roll, if any
   */
  async _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType === "item") {
        const itemId = element.closest(".item").dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
      if (dataset.rollType === "spell") {
        const spellId = element.closest(".item").dataset.itemId;
        const spell = this.actor.items.get(spellId);
        if (spell) return this._rollSpell(spell);
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `${dataset.label}`.toUpperCase() : "";
      let roll = new Roll(dataset.roll, this.actor.getRollData());

      await roll.evaluate();

      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get("core", "rollMode")
      });

      return roll;
    }
  }

  async _rollNewCharacter() {
    const rolls = [];
    for (let i = 0; i < 3; i++) {
      let roll = await new Roll("2d6+3").toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.localize("SAB.rollNewChar")
      });
      rolls.push(roll.rolls[0]);
    }
    rolls.sort((a, b) => a.total - b.total);
    const luck = rolls[0].total;
    const mind = rolls[1].total;
    const body = rolls[2].total;
    const hpRoll = await new Roll("1d6").toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: game.i18n.localize("SAB.HP.long")
    });
    this.actor.update({
      "system.attributes.luck.value": luck,
      "system.mind.value": mind,
      "system.mind.max": mind,
      "system.body.value": body,
      "system.body.max": body,
      "system.health.value": hpRoll.rolls[0].total,
      "system.health.max": hpRoll.rolls[0].total
    });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: game.i18n.localize("SAB.charRollMsg")
    });
  }

  async _levelUp() {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: game.i18n.localize("SAB.levelUp.msg")
    });
    const messages = [
      "SAB.Ability.Body.long",
      "SAB.Ability.Mind.long",
      "SAB.Ability.Luck.long"
    ];
    let body = 0;
    let mind = 0;
    let luck = 0;
    let notLeveled = true;

    if (this.actor.system.body.max < 18) {
      let roll = await new Roll("d20").toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.localize(messages[0])
      });
      body = roll.rolls[0].total;
    }

    if (this.actor.system.mind.max < 18) {
      let roll = await new Roll("d20").toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.localize(messages[1])
      });
      mind = roll.rolls[0].total;
    }

    if (this.actor.system.attributes.luck.value < 18) {
      let roll = await new Roll("d20").toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.localize(messages[2])
      });
      luck = roll.rolls[0].total;
    }

    if (body > this.actor.system.body.max) {
      notLeveled = false;
      this.actor.update({
        "system.body.value": this.actor.system.body.value + 1,
        "system.body.max": this.actor.system.body.max + 1
      });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: game.i18n.localize("SAB.levelUp.body")
      });
    }

    if (mind > this.actor.system.mind.max) {
      notLeveled = false;
      this.actor.update({
        "system.mind.value": this.actor.system.mind.value + 1,
        "system.mind.max": this.actor.system.mind.max + 1
      });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: game.i18n.localize("SAB.levelUp.mind")
      });
    }

    if (luck > this.actor.system.attributes.luck.value) {
      notLeveled = false;
      this.actor.update({
        "system.attributes.luck.value": Math.floor(this.actor.system.attributes.luck.value + 1)
      });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: game.i18n.localize("SAB.levelUp.luck")
      });
    }

    if (notLeveled) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: game.i18n.localize("SAB.levelUp.nothing")
      });
    }

    this.actor.update({
      "system.health.value": this.actor.system.health.value + 1,
      "system.health.max": this.actor.system.health.max + 1
    });
  }

  // TODO: Fix gold change bug
  async _onGoldChange(ev) {
    let currentGold = parseInt(ev.target.value, 10);

    if (isNaN(currentGold)) {
      currentGold = 0;
    }

    await this.actor.update({ "system.attributes.gold.value": currentGold });
  }

  async _rollSpell(spell) {
    let maxBasePower = this._checkInvSlots();
    let powerLevel = await this._getPowerLevel(maxBasePower);
    if (powerLevel <= 0) {
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: game.i18n.localize("SAB.item.spell.no-slots")
      });
    }
    let roll = await new Roll(`${powerLevel}d6`).toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `[${spell.type}] ${spell.name}: ${spell.system.description}`,
      rollMode: game.settings.get("core", "rollMode")
    });
    let rollDice = roll.rolls[0].dice[0].results.map(result => result.result);
    let uniqueRolls = new Set(rollDice);
    if (uniqueRolls.size < rollDice.length) {
      let total=roll.rolls[0].total;
      if (total>21) {total=21;}
      ChatMessage.create({
        flavor: game.i18n.localize("SAB.Spellburn.flavor"),
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: game.i18n.localize(`SAB.Spellburn.${total}`)
      });
    }
    await this._checkFatigue(rollDice);
  }

  async _getPowerLevel(maxBasePower) {
    let powerLevel = await new Promise(resolve => {
      const div = document.createElement("div");
      div.classList.add("sheet-modal");

      const powerLevelContainer = document.createElement("div");
      powerLevelContainer.classList.add("power-level-container");

      const label = document.createElement("label");
      label.setAttribute("for", "powerLevel");
      label.textContent = `${game.i18n.localize("SAB.item.spell.power-level")}: `;
      powerLevelContainer.appendChild(label);

      const select = document.createElement("select");
      select.id = "powerLevel";
      select.name = "powerLevel";
      select.required = true;

      const items = this.actor.items.filter(item => item.type === "item");
      const totalWeight = items.reduce((sum, item) => sum + (item.system.weight || 0), 0);
      let availableSlots = this.actor.system.attributes.invSlots.value - totalWeight;
      availableSlots = Math.min(availableSlots, 5);

      if (availableSlots === 0) {
        select.disabled = true;
        const option = document.createElement("option");
        option.value = 0;
        option.textContent = game.i18n.localize("SAB.item.spell.no-slots");
        select.appendChild(option);
      } else {
        for (let i = 1; i <= availableSlots; i++) {
          const option = document.createElement("option");
          option.value = i;
          option.textContent = i;
          select.appendChild(option);
        }
      }

      powerLevelContainer.appendChild(select);
      div.appendChild(powerLevelContainer);

      const divContainer = document.createElement("div");
      divContainer.appendChild(div);
      const content = divContainer.innerHTML;

      new Dialog({
        title: game.i18n.localize("SAB.item.spell.pl-dialog"),
        content: content,
        buttons: {
          ok: {
            label: game.i18n.localize("SAB.actions.cast-spell"),
            callback: html => {
              const select = html.find("#powerLevel")[0];
              const power = parseInt(select.value);

              resolve(power);
            }
          }
        },
        default: "ok"
      }).render(true);
    });
    return powerLevel;
  }

  async _checkFatigue(rollDice) {
    let totalFatigue = 0;
    const fatigueData = {
      name: game.i18n.localize("SAB.item.fatigue.name"),
      type: "item",
      system: {
        description: game.i18n.localize("SAB.item.fatigue.name"),
        weight: 1
      }
    };

    rollDice.sort((a, b) => b - a);
    for (let i = 0; i < rollDice.length; i++) {
      if (rollDice[i] > 3) {
        await Item.create(fatigueData, { parent: this.actor });
        totalFatigue++;
      } else break;
    }
    if (totalFatigue > 0) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content:
          `${game.i18n.localize("SAB.item.fatigue.msg")} ${totalFatigue}`
      });
      this._checkInvSlots();
    }
  }

  async _onAddInventorySlot() {
    await this.actor.update({"system.attributes.invSlots.value": this.actor.system.attributes.invSlots.value + 1});
  }

  async _onRemoveInventorySlot() {
    await this.actor.update({"system.attributes.invSlots.value": this.actor.system.attributes.invSlots.value - 1});
  }

  _onHealthChange(ev) {
    let currentHealth = parseInt(ev.target.value, 10);
    if (currentHealth === 0) {
      let oldHealth = this.actor.system.health.old;
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: game.i18n.localize(`SAB.Battlescar.${oldHealth}.message`),
        flavor: game.i18n.localize(`SAB.Battlescar.${oldHealth}.flavor`)
      });
    }
  }

  _checkInvSlots() {
    let currentSlots = this.actor.system.attributes.invSlots.value;
    let items = this.actor.items.filter(item => item.type === "item");
    let totalWeight = items.reduce((sum, item) => sum + (item.system.weight || 0), 0);
    if (totalWeight >= currentSlots) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: game.i18n.localize("SAB.encumbrance.overburdened")
      });
      this.actor.update({"system.health.value": 0 });
    }
    return currentSlots-totalWeight;
  }

  _onArchetypeConfig(event) {
    event.preventDefault();
    const archetype = this.actor.system.attributes.archetype;

    new Dialog({
      title: game.i18n.localize("SAB.character.archetype"),
      content: `
        <form class="sheet-modal">
          <div>
            <label>${game.i18n.localize("SAB.character.sheet.archetype.label")}</label>
            <input type="text" name="name" value="${archetype.name}" placeholder="${game.i18n.localize("SAB.character.sheet.archetype-name-placeholder")}">
          </div>
          <div>
            <label>${game.i18n.localize("SAB.character.sheet.trigger.label")}</label>
            <input type="text" name="trigger" value="${archetype.trigger}" placeholder="${game.i18n.localize("SAB.character.sheet.trigger.placeholder")}">
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: game.i18n.localize("SAB.actions.save"),
          callback: html => {
            const form = html.find("form")[0];
            this.actor.update({
              "system.attributes.archetype.name": form.name.value,
              "system.attributes.archetype.trigger": form.trigger.value
            });
          }
        }
      },
      default: "save"
    }).render(true);
  }

  _onOriginConfig(event) {
    event.preventDefault();
    const origin = this.actor.system.attributes.origin;

    new Dialog({
      title: game.i18n.localize("SAB.character.origin"),
      content: `
        <form class="sheet-modal">
          <div>
            <label>${game.i18n.localize("SAB.character.sheet.origin.label")}</label>
            <input type="text" name="question" value="${origin.question}" placeholder="${game.i18n.localize("SAB.character.sheet.origin.question-placeholder")}">
          </div>
          <div>
            <label>${game.i18n.localize("SAB.character.sheet.origin.answer-title")}</label>
            <input type="text" name="answerTitle" value="${origin.answer.title}" placeholder="${game.i18n.localize("SAB.character.sheet.origin.answer-title-placeholder")}">
          </div>
          <div>
            <label>${game.i18n.localize("SAB.character.sheet.origin.answer-description")}</label>
            <textarea name="answerDescription" placeholder="${game.i18n.localize("SAB.character.sheet.origin.answer-description-placeholder")}">${origin.answer.description}</textarea>
          </div>
        </form>
      `,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: game.i18n.localize("SAB.actions.save"),
          callback: html => {
            const form = html.find("form")[0];
            this.actor.update({
              "system.attributes.origin.question": form.question.value,
              "system.attributes.origin.answer.title": form.answerTitle.value,
              "system.attributes.origin.answer.description": form.answerDescription.value
            });
          }
        }
      },
      default: "save"
    }).render(true);
  }

  /**
   * Toggles the deprived status of the character.
   * @param {Event} event The triggering click event.
   * @returns {Promise} A promise that resolves when the actor update is complete.
   * @private
   */
  _onToggleDeprived(event) {
    event.preventDefault();

    const isCurrentlyDeprived = this.actor.system.attributes.isDeprived;
    return this.actor.update({ "system.attributes.isDeprived": !isCurrentlyDeprived });
  }
}

