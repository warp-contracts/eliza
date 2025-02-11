import { Plugin } from "@elizaos/core";
import {task} from "./actions/task.ts";
import {aoClaraProfileProvider} from "./clara/AoClaraProfileProvider.ts";
import {storyClaraProfileProvider} from "./clara/StoryClaraProfileProvider.ts";

export const aoPlugin: Plugin = {
    name: "ao",
    description: "AO Plugin for Eliza",
    actions: [task],
    evaluators: [],
    providers: [aoClaraProfileProvider, storyClaraProfileProvider],
};

export default aoPlugin;
