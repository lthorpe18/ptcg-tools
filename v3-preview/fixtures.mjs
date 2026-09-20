// Isolated CP01 specimen. Never passed to a domain store, sync or persistence API.
export const cover = { name: "Raging Bolt ex", set: "TEF", number: "208" };
export const deckName = "Raging Bolt ex / Teal Mask Ogerpon ex";
export const cards = [
  ["Raging Bolt ex", "TEF", "123", 4, "Pokémon"],
  ["Teal Mask Ogerpon ex", "TWM", "25", 4, "Pokémon"],
  ["Fezandipiti ex", "SFA", "38", 1, "Pokémon"],
  ["Squawkabilly ex", "PAL", "169", 1, "Pokémon"],
  ["Radiant Greninja", "ASR", "46", 1, "Pokémon"],
  ["Slither Wing", "PAR", "107", 1, "Pokémon"],
  ["Professor Sada’s Vitality", "PAR", "170", 4, "Trainers"],
  ["Earthen Vessel", "PAR", "163", 4, "Trainers"],
  ["Nest Ball", "SVI", "181", 4, "Trainers"],
  ["Ultra Ball", "SVI", "196", 2, "Trainers"],
  ["Pokégear 3.0", "SVI", "186", 4, "Trainers"],
  ["Energy Retrieval", "SVI", "171", 3, "Trainers"],
  ["Superior Energy Retrieval", "PAL", "189", 2, "Trainers"],
  ["Night Stretcher", "SFA", "61", 3, "Trainers"],
  ["Prime Catcher", "TEF", "157", 1, "Trainers"],
  ["Boss’s Orders (Ghetsis)", "PAL", "172", 2, "Trainers"],
  ["Iono", "PAL", "185", 1, "Trainers"],
  ["Switch Cart", "ASR", "154", 1, "Trainers"],
  ["Pokémon Catcher", "SVI", "187", 2, "Trainers"],
  ["PokéStop", "PGO", "68", 2, "Trainers"],
  ["Basic Grass Energy", "SVE", "1", 7, "Energy"],
  ["Basic Fighting Energy", "SVE", "6", 3, "Energy"],
  ["Basic Lightning Energy", "SVE", "4", 3, "Energy"],
].map(([name, set, number, quantity, group]) =>
  Object.freeze({ name, set, number, quantity, group }),
);
