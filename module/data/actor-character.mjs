import SabActorBase from "./base-actor.mjs";

export default class SabCharacter extends SabActorBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const requiredString = { required: true, blank: true };
    const schema = super.defineSchema();

    schema.attributes = new fields.SchemaField({
      gold: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 10 })
      }),
      luck: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 10 })
      }),
      invSlots: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 10 })
      }),
      background: new fields.StringField({ ...requiredString }),
      archetype: new fields.SchemaField({
        name: new fields.StringField({ ...requiredString }),
        trigger: new fields.StringField({ ...requiredString })
      }),
      origin: new fields.SchemaField({
        question: new fields.StringField({ ...requiredString }),
        answer: new fields.SchemaField({
          title: new fields.StringField({ ...requiredString }),
          description: new fields.StringField({ ...requiredString })
        })
      }),
      isDeprived: new fields.BooleanField({ required: true, initial: false })
    });

    // Iterate over ability names and create a new SchemaField for each.
    schema.abilities = new fields.SchemaField(Object.keys(CONFIG.SAB.abilities).reduce((obj, ability) => {
      obj[ability] = new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 10, min: 0 })
      });
      return obj;
    }, {}));

    return schema;
  }

  prepareDerivedData() {
    // Loop through ability scores, and add their modifiers to our sheet output.
    for (const key in this.abilities) {
      // Handle ability label localization.
      this.abilities[key].label = game.i18n.localize(CONFIG.SAB.abilities[key]) ?? key;
    }
  }

  getRollData() {
    const data = {};

    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@str.mod + 4`.
    if (this.abilities) {
      for (let [k, v] of Object.entries(this.abilities)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    return data;
  }
}
