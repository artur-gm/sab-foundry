import SabDataModel from "./base-model.mjs";

export default class SabActorBase extends SabDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.health = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 1 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 1 }),
      old: new fields.NumberField({ ...requiredInteger, initial: 1 })
    });

    schema.body = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 10 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 10 })
    });

    schema.mind = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 10 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 10 })
    });

    schema.ar = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0 })
    });
    schema.biography = new fields.StringField({ required: true, blank: true });

    return schema;
  }
}
