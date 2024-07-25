import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from "../helpers/effects.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class SabActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["spellburn-and-battlescars", "sheet", "actor"],
      width: 600,
      height: 600,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "features",
        },
      ],
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
    if (actorData.type == "character") {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    // Prepare NPC data and items.
    if (actorData.type == "npc") {
      this._prepareItems(context);
    }

    // Enrich biography info for display
    // Enrichment turns text like `[[/r 1d20]]` into buttons
    context.enrichedBiography = await TextEditor.enrichHTML(
      this.actor.system.biography,
      {
        // Whether to show secret blocks in the finished html
        secrets: this.document.isOwner,
        // Necessary in v11, can be removed in v12
        async: true,
        // Data to fill in for inline rolls
        rollData: this.actor.getRollData(),
        // Relative UUID resolution
        relativeTo: this.actor,
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
    // This is where you can enrich character-specific editor fields
    // or setup anything else that's specific to this type
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
      // Append to features.
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
    html.on("click", ".item-edit", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.on("click", ".item-create", this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.on("click", ".item-delete", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Active Effect management
    html.on("click", ".effect-control", (ev) => {
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
    html.on('change', '#gold', (ev) => {
        this._onGoldChange(ev);
    });

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = (ev) => this._onDragStart(ev);
      html.find("li.item").each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
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
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data,
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system["type"];

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType == "item") {
        const itemId = element.closest(".item").dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
      if (dataset.rollType == "spell") {
        console.log("Spell roll");
        const spellId = element.closest(".item").dataset.itemId;
        const spell = this.actor.items.get(spellId);
        if (spell) return this._rollSpell(spell);
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `[ability] ${dataset.label}` : "";
      let atribute = dataset.attribute ? dataset.attribute : "";
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get("core", "rollMode"),
      });

      if (this.actor.type == "character") {
        if (roll.result == 20) {
          this.actor.update({
            "system.attributes.luck.value":
              this.actor.system.attributes.luck.value - 1,
          });
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: game.i18n.localize("SAB.critFailMessage"),
          });
        }

        if (roll.result == this.actor.system[atribute].value) {
          this.actor.update({
            "system.attributes.luck.value":
              this.actor.system.attributes.luck.value + 1,
          });
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: game.i18n.localize("SAB.critMessage"),
          });
        }
      }
      return roll;
    }
  }

  async _rollNewCharacter() {
    const rolls = [];
    for (let i = 0; i < 3; i++) {
      let roll = await new Roll("2d6+3").toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.localize("SAB.rollNewChar"),
      });
      rolls.push(roll.rolls[0]);
    }
    rolls.sort((a, b) => a.total - b.total);
    const luck = rolls[0].total;
    const mind = rolls[1].total;
    const body = rolls[2].total;
    const hpRoll = await new Roll("1d6").toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: game.i18n.localize("SAB.HP.long"),
    });
    console.log(hpRoll);
    this.actor.update({
      "system.attributes.luck.value": luck,
      "system.mind.value": mind,
      "system.mind.max": mind,
      "system.body.value": body,
      "system.body.max": body,
      "system.health.value": hpRoll.rolls[0].total,
      "system.health.max": hpRoll.rolls[0].total,
      "system.attributes.level.value": 1,
    });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: game.i18n.localize("SAB.charRollMsg"),
    });
  }

  async _levelUp() {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: game.i18n.localize("SAB.levelUp.msg"),
    });
    const messages = [
      "SAB.Ability.Body.long",
      "SAB.Ability.Mind.long",
      "SAB.Ability.Luck.long",
    ];
    let body = 0;
    let mind = 0;
    let luck = 0;
    let notLeveled = true;
    if (this.actor.system.body.max < 18) {
      let roll = await new Roll("d20").toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.localize(messages[0]),
      });
      body = roll.rolls[0].total;
    }
    if (this.actor.system.mind.max < 18) {
      let roll = await new Roll("d20").toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.localize(messages[1]),
      });
      mind = roll.rolls[0].total;
    }
    if (this.actor.system.attributes.luck.value < 18) {
      let roll = await new Roll("d20").toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.localize(messages[2]),
      });
      luck = roll.rolls[0].total;
    }

    if (body > this.actor.system.body.max) {
      notLeveled = false;
      this.actor.update({
        "system.body.value": this.actor.system.body.value + 1,
        "system.body.max": this.actor.system.body.max + 1,
      });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: game.i18n.localize("SAB.levelUp.body"),
      });
    }
    if (mind > this.actor.system.mind.max) {
      notLeveled = false;
      this.actor.update({
        "system.mind.value": this.actor.system.mind.value + 1,
        "system.mind.max": this.actor.system.mind.max + 1,
      });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: game.i18n.localize("SAB.levelUp.mind"),
      });
    }
    if (luck > this.actor.system.attributes.luck.value) {
      notLeveled = false;
      this.actor.update({
        "system.attributes.luck.value":
          this.actor.system.attributes.luck.value + 1,
      });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: game.i18n.localize("SAB.levelUp.luck"),
      });
    }
    if (notLeveled) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: game.i18n.localize("SAB.levelUp.nothing"),
      });
    }
    this.actor.update({
      "system.attributes.level.value":
        this.actor.system.attributes.level.value + 1,
      "system.health.value": this.actor.system.health.value + 1,
      "system.health.max": this.actor.system.health.max + 1,
    });
  }

  async _onGoldChange(ev) {
    let currentGold = parseInt(ev.target.value, 10);
    if (currentGold< 100) return;
    const goldData = {
      name: `100 ${game.i18n.localize('SAB.gold.long')}`,
      type: 'item',
      system: {
        weight: 1,
        description: `100 ${game.i18n.localize('SAB.gold.long')}`,
      },
    };
  
    const goldItemsToCreate = Math.floor(currentGold / 100);
    currentGold = currentGold % 100;
  
    for (let i = 0; i < goldItemsToCreate; i++) {
      await Item.create(goldData, { parent: this.actor });
    }
  
    await this.actor.update({ "system.attributes.gold.value": currentGold });
  }

  async _rollSpell(spell) {
    let powerLevel = await this._getPowerLevel();
    let roll = await new Roll(powerLevel + "d6").toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `[${spell.type}] ${spell.name}: ${spell.system.description}`,
      rollMode: game.settings.get("core", "rollMode"),
    });
    console.log(roll);
    let rollDice = roll.rolls[0].dice[0].results.map((result) => result.result);
    let uniqueRolls = new Set(rollDice);
    if (uniqueRolls.size < rollDice.length) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: game.i18n.localize("SAB.Spellburn"),
      });
    }
    await this._checkFatigue(rollDice);
  }

  async _getPowerLevel() {
    let powerLevel = await new Promise((resolve) => {
      const div = document.createElement("div");

      const label = document.createElement("label");
      label.setAttribute("for", "powerLevel");
      label.textContent = game.i18n.localize("SAB.Item.Spell.powerLVL") + ": ";
      div.appendChild(label);

      const input = document.createElement("input");
      input.type = "number";
      input.id = "powerLevel";
      input.name = "powerLevel";
      input.required = true;
      div.appendChild(input);

      const divContainer = document.createElement("div");
      divContainer.appendChild(div);
      const content = divContainer.innerHTML;

      new Dialog({
        title: game.i18n.localize("SAB.Item.Spell.pLVLdialog"),
        content: content,
        buttons: {
          ok: {
            label: "OK",
            callback: (html) => {
              const input = html.find("#powerLevel")[0];
              // treat the input value
              if (isNaN(parseInt(input.value))) {
                input.value = 1;
              }
              if (parseInt(input.value) > 5) {
                input.value = 5;
              }
              if (parseInt(input.value) < 1) {
                input.value = 1;
              }
              resolve(parseInt(input.value));
            },
          },
        },
        default: "ok",
      }).render(true);
    });
    return powerLevel;
  }

  async _checkFatigue(rollDice) {
    let totalFatigue = 0;
    const fatigueData = {
      name: game.i18n.localize("SAB.Item.Fatigue.name"),
      type: "item",
      system: {
        description: game.i18n.localize("SAB.Item.Fatigue.name"),
        weight: 1,
      },
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
        content: game.i18n.localize("SAB.Item.Fatigue.msg") + totalFatigue,
      });
    }
  }
}
