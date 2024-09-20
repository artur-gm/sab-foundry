import SabItemBase from "./base-item.mjs";

export default class SabItem extends SabItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.quantity = new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 });
    schema.weight = new fields.NumberField({ ...requiredInteger, initial: 1});

    // Break down roll formula into three independent fields
    schema.roll = new fields.SchemaField({
      diceNum: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 }),
      diceSize: new fields.StringField({ initial: "" }),
      diceBonus: new fields.StringField({ initial: "" })
    });

    schema.formula = new fields.StringField({ blank: true });

    return schema;
  }

  prepareDerivedData() {
    // Build the formula dynamically using string interpolation and max function
    const roll = this.roll;

    this.roll.diceBonus? this.formula = `{${roll.diceSize},${roll.diceBonus}}kh` : this.formula = `${roll.diceSize}`;
  }
}
