import { Plugin } from "@elizaos/core";
import {task} from "./actions/task.ts";
import {claraProfileProvider} from "./clara/ClaraProfileProvider.ts";

export const aoPlugin: Plugin = {
    name: "ao",
    description: "AO Plugin for Eliza",
    actions: [task],
    evaluators: [],
    providers: [claraProfileProvider],
};

export default aoPlugin;
