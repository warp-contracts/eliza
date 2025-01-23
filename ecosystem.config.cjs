module.exports = {
    apps: [
        {
            name: "agent-smith",
            script: "pnpm",
            node_args: "-r dotenv/config",
            args: "start --character='characters/agent_smith.character.json'  dotenv_config_path=./smith.env",
            env: {
                PORT: "3000",
            },
        },
        {
            name: "agent-neo",
            script: "pnpm",
            node_args: "-r dotenv/config",
            args: "start --character='characters/neo.character.json' dotenv_config_path=./neo.env",
            env: {
                PORT: "3001",
            },
        },
        {
            name: "agent-morpheus",
            script: "pnpm",
            node_args: "-r dotenv/config",
            args: "start --character='characters/morpheus.character.json' dotenv_config_path=./morpheus.env",
            env: {
                PORT: "3002",
            },
        },
    ],
};
