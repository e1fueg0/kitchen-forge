import {describe, expect, it} from "vitest";
// eslint-disable-next-line import/no-nodejs-modules
import {execFileSync} from "node:child_process";
// eslint-disable-next-line import/no-nodejs-modules
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
// eslint-disable-next-line import/no-nodejs-modules
import {tmpdir} from "node:os";
// eslint-disable-next-line import/no-nodejs-modules
import {join, resolve} from "node:path";

type Manifest = {
	version: string;
	minAppVersion: string;
};

type VersionMap = Record<string, string>;

const projectRoot = globalThis.process.cwd();
const scriptPath = resolve(projectRoot, "version-bump.mjs");

function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, "utf8")) as T;
}

// npm sets NPM_PACKAGE_VERSION (uppercase) on Windows. Environment variables
// are case-insensitive there, so remove every spelling before setting the
// version under test; otherwise the inherited value wins.
function childEnv(targetVersion: string): Record<string, string | undefined> {
	const env: Record<string, string | undefined> = {...globalThis.process.env};
	for (const key of Object.keys(env)) {
		if (key.toLowerCase() === "npm_package_version")
			delete env[key];
	}
	env.npm_package_version = targetVersion;
	return env;
}

function runVersionBump(
	manifest: Manifest,
	versions: VersionMap,
	targetVersion: string,
): {manifest: Manifest; versions: VersionMap} {
	const dir = mkdtempSync(join(tmpdir(), "kf-version-bump-"));
	try {
		writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, "\t"));
		writeFileSync(join(dir, "versions.json"), JSON.stringify(versions, null, "\t"));
		execFileSync(globalThis.process.execPath, [scriptPath], {
			cwd: dir,
			env: childEnv(targetVersion),
			stdio: "pipe",
		});
		return {
			manifest: readJson<Manifest>(join(dir, "manifest.json")),
			versions: readJson<VersionMap>(join(dir, "versions.json")),
		};
	} finally {
		rmSync(dir, {recursive: true, force: true});
	}
}

describe("version-bump", () => {
	it("adds a new version even when minAppVersion is already present", () => {
		const result = runVersionBump(
			{version: "1.0.2", minAppVersion: "1.2.3"},
			{"1.0.0": "1.2.3", "1.0.1": "1.2.3", "1.0.2": "1.2.3"},
			"1.0.3",
		);

		expect(result.manifest.version).toBe("1.0.3");
		expect(result.versions["1.0.3"]).toBe("1.2.3");
	});

	it("does not overwrite an existing version entry", () => {
		const result = runVersionBump(
			{version: "1.0.2", minAppVersion: "1.4.0"},
			{"1.0.2": "1.2.3"},
			"1.0.2",
		);

		expect(result.versions["1.0.2"]).toBe("1.2.3");
	});

	it("keeps versions.json in sync with the current package version", () => {
		const pkg = readJson<{version: string}>(join(projectRoot, "package.json"));
		const manifest = readJson<Manifest>(join(projectRoot, "manifest.json"));
		const versions = readJson<VersionMap>(join(projectRoot, "versions.json"));

		expect(manifest.version).toBe(pkg.version);
		expect(versions[pkg.version]).toBeDefined();
	});
});
