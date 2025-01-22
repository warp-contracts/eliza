import { Plugin } from "@elizaos/core";
import {task} from "./actions/task.ts";
import {aoClientProvider} from "./clara/aoClientProvider.ts";

export const aoPlugin: Plugin = {
    name: "ao",
    description: "AO Plugin for Eliza",
    actions: [task],
    evaluators: [],
    providers: [aoClientProvider],
};

export default aoPlugin;
