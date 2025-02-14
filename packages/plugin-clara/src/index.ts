import { Plugin } from "@elizaos/core";
import {task} from "./actions/task.ts";
import {aoClaraProfileProvider} from "./clara/AoClaraProfileProvider.ts";
import {storyClaraProfileProvider} from "./clara/StoryClaraProfileProvider.ts";

export const claraPlugin: Plugin = {
    name: "CLARA",
    description: "CLARA Plugin for Eliza",
    actions: [task],
    evaluators: [],
    providers: [aoClaraProfileProvider, storyClaraProfileProvider],
};

export default claraPlugin;
