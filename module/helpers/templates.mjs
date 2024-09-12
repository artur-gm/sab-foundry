/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @returns {Promise}
 */
export const preloadHandlebarsTemplates = async function() {
  return loadTemplates([
    // Actor partials.
    "systems/spellburn-and-battlescars/templates/actor/parts/actor-features.hbs",
    "systems/spellburn-and-battlescars/templates/actor/parts/actor-items.hbs",
    "systems/spellburn-and-battlescars/templates/actor/parts/actor-spells.hbs"
  ]);
};

export const prefetchFonts = async function() {
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = "https://fonts.googleapis.com/css2?family=Suez+One&display=swap";
  link.as = "style";
  document.head.appendChild(link);
};
