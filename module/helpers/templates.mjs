/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @returns {Promise}
 */
export const preloadHandlebarsTemplates = async function() {
  return loadTemplates([
    // Actor partials.
    "systems/spellburn-and-battlescars/templates/actor/parts/character-sheet-attributes.hbs",
    "systems/spellburn-and-battlescars/templates/actor/parts/character-sheet-header.hbs",
    "systems/spellburn-and-battlescars/templates/actor/parts/character-sheet-abilities.hbs",
    "systems/spellburn-and-battlescars/templates/actor/parts/character-sheet-inventory.hbs",
    "systems/spellburn-and-battlescars/templates/actor/parts/character-sheet-spells.hbs",
    "systems/spellburn-and-battlescars/templates/actor/parts/actor-features.hbs", // TODO: Remove this after updating the sheet.
    "systems/spellburn-and-battlescars/templates/actor/parts/actor-items.hbs", // TODO: Remove this after updating the sheet.
    "systems/spellburn-and-battlescars/templates/actor/parts/actor-spells.hbs" // TODO: Remove this after updating the sheet.
  ]);
};

export const prefetchFonts = async function() {
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = "https://fonts.googleapis.com/css2?family=Suez+One&display=swap";
  link.as = "style";
  document.head.appendChild(link);

  const link2 = document.createElement("link");
  link2.rel = "prefetch";
  link2.href = "https://fonts.googleapis.com/css2?family=Alegreya:wght@500;700&display=swap";
  link2.as = "style";
  document.head.appendChild(link2);
};
