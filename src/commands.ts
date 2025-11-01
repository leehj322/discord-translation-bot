import { translateCommandDefs } from "./commands/translate.js";
import { musicCommandDefs } from "./commands/music.js";

export const commandDefs = [...translateCommandDefs, ...musicCommandDefs];
