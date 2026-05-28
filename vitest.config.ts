import {defineConfig} from "vitest/config";
import path from "node:path";

export default defineConfig({
	test: {
		environment: "happy-dom",
	},
	resolve: {
		alias: {
			obsidian: path.resolve(__dirname, "src/__mocks__/obsidian.ts"),
		},
	},
});
