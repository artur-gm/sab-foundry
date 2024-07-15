import SabItemBase from "./base-item.mjs";

export default class SabSpell extends SabItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    return schema;
  }
}