import { Toolset } from "@core/chorus/Toolsets";

export class ToolsetTerminal extends Toolset {
    constructor() {
        super(
            "terminal",
            "Terminal",
            {}, // No config needed
            "Run commands in the terminal (DISABLED)",
        );

        // Terminal toolset disabled for security reasons
        // All shell execution capabilities have been removed
    }
}

// # todo:
// - coder toolset?
