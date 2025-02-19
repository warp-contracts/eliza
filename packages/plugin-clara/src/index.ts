import { Plugin } from "@elizaos/core";
import {task} from "./actions/task.ts";
import {aoClaraProfileProvider} from "./ao/AoClaraProfileProvider.ts";
import {storyClaraProfileProvider} from "./story/StoryClaraProfileProvider.ts";

console.log(``);
console.log("┌════════════════════════════════════════┐");
console.log("│        CLARA Protocol PLUGIN           │");
console.log("├────────────────────────────────────────┤");
console.log("│  Initializing Clara Plugin...          │");
console.log("└════════════════════════════════════════┘");
console.log(``);


export const claraPlugin: Plugin = {
    name: "CLARA Protocol",
    description: "CLARA Protocol Plugin",
    actions: [task],
    evaluators: [],
    providers: [storyClaraProfileProvider, aoClaraProfileProvider],
};

export default claraPlugin;
