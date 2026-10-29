/**
 * Diagnostic tests for the review findings.
 *
 * These tests assert the behavior the code *should* have. Failures mean the
 * finding is reproducible; passes mean that particular case already works.
 * Production code is intentionally not changed.
 */
import {beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import jsep from "jsep";
// eslint-disable-next-line import/no-nodejs-modules
import {readFileSync} from "node:fs";
import type {MarkdownPostProcessorContext} from "obsidian";
import {processKitchenForgeBlock} from "./kitchenforge";
import {round, roundToStep, type Vars} from "./calc";
import {prefillVars, recalcCalcBindings, type Ingredient, type Recipe} from "./recipe";

const ctx = {} as unknown as MarkdownPostProcessorContext;

type ElOpts = {cls?: string; text?: string};

beforeAll(() => {
	jsep.addBinaryOp("@", 10);

	// Polyfills for Obsidian's HTMLElement extensions
	(HTMLElement.prototype as unknown as {createDiv: (opts?: ElOpts) => HTMLElement}).createDiv = function (
		this: HTMLElement,
		opts?: ElOpts,
	) {
		const div = document.createElement("div");
		if (opts?.cls) div.className = opts.cls;
		if (opts?.text) div.textContent = opts.text;
		this.appendChild(div);
		return div;
	};

	(HTMLElement.prototype as unknown as {createSpan: (opts?: ElOpts) => HTMLElement}).createSpan = function (
		this: HTMLElement,
		opts?: ElOpts,
	) {
		const span = document.createElement("span");
		if (opts?.cls) span.className = opts.cls;
		if (opts?.text) span.textContent = opts.text;
		this.appendChild(span);
		return span;
	};

	(HTMLElement.prototype as unknown as {
		createEl: (tag: string, opts?: ElOpts) => HTMLElement;
	}).createEl = function (this: HTMLElement, tag: string, opts?: ElOpts) {
		const el = document.createElement(tag);
		if (opts?.cls) el.className = opts.cls;
		if (opts?.text) el.textContent = opts.text;
		this.appendChild(el);
		return el;
	};

	(HTMLElement.prototype as unknown as {setText: (t: string) => void}).setText = function (
		this: HTMLElement,
		text: string,
	) {
		this.textContent = text;
	};

	(HTMLElement.prototype as unknown as {addClass: (...c: string[]) => void}).addClass = function (
		this: HTMLElement,
		...classes: string[]
	) {
		this.classList.add(...classes);
	};
});

let container: HTMLElement;

beforeEach(() => {
	document.body.innerHTML = "";
	container = document.createElement("div");
	document.body.appendChild(container);
});

function render(source: string): HTMLElement | null {
	processKitchenForgeBlock(source, container, ctx);
	return container.querySelector<HTMLElement>(".kf-block");
}

function errorEl(): HTMLElement | null {
	return container.querySelector<HTMLElement>(".kf-error");
}

function items(block: HTMLElement, sectionIndex = 0): HTMLLIElement[] {
	const ol = block.querySelectorAll("ol")[sectionIndex];
	return ol ? Array.from(ol.querySelectorAll("li")) : [];
}

function valueText(item: HTMLLIElement | undefined): string {
	const b = item?.querySelector("b");
	if (!b) return "";
	const input = b.querySelector("input");
	if (input) return input.value;
	return b.firstElementChild?.textContent ?? "";
}

function inputFor(item: HTMLLIElement | undefined): HTMLInputElement | null {
	return item?.querySelector<HTMLInputElement>("input") ?? null;
}

async function copyRecipe(block: HTMLElement): Promise<string> {
	let copied = "";
	const writeText = vi.spyOn(navigator.clipboard, "writeText").mockImplementation(async (text: string) => {
		copied = text;
	});
	try {
		const button = Array.from(block.querySelectorAll("button")).find(b => b.textContent === "📋");
		if (!button) throw new Error("Copy button not found");
		button.click();
		await new Promise(resolve => setTimeout(resolve, 0));
	} finally {
		writeText.mockRestore();
	}
	return copied;
}

// Accept either a working id or an explicit validation error mentioning ids.
// The current code does neither for most malformed ids.
function expectIdHandled(block: HTMLElement | null, expected: string): void {
	const err = errorEl();
	if (err) {
		expect(err.textContent ?? "").toMatch(/\bid\b/i);
		return;
	}
	expect(block).not.toBeNull();
	expect(valueText(items(block!, 0)[1])).toBe(expected);
}

describe("finding 1: recipe.scales is not validated", () => {
	const withScales = (scales: string) => `unit: g
${scales}
sections:
  - name: S
    items:
      - {name: A, value: 100}
`;

	it.each([
		["a string", "scales: foo"],
		["a mapping", "scales: {}"],
		["a null entry", "scales:\n  - null"],
	] as const)("does not crash on %s", (_label, scales) => {
		expect(() => render(withScales(scales))).not.toThrow();
		expect(errorEl()?.textContent ?? "").toMatch(/scales/i);
	});

	it("rejects a non-numeric mult", () => {
		const block = render(`unit: g
scales:
  - name: Full
    mult: abc
sections:
  - name: S
    items:
      - {name: A, value: 100}
`);
		expect(block).toBeNull();
		expect(errorEl()?.textContent ?? "").toMatch(/mult/i);
	});

	it("rejects a missing mult", () => {
		const block = render(`unit: g
scales:
  - name: Full
sections:
  - name: S
    items:
      - {name: A, value: 100}
`);
		expect(block).toBeNull();
		expect(errorEl()?.textContent ?? "").toMatch(/mult/i);
	});

	it("does not add an implicit 1:1 scale when mult is the string '1'", () => {
		const block = render(`unit: g
scales:
  - name: Full
    mult: "1"
sections:
  - name: S
    items:
      - {name: A, value: 100}
`);
		if (block) {
			expect(block.querySelectorAll(".kf-scale-block button").length).toBe(1);
		} else {
			expect(errorEl()).not.toBeNull();
		}
	});

	it("auto-names a scale without a name", () => {
		const block = render(`unit: g
scales:
  - mult: 1
sections:
  - name: S
    items:
      - {name: A, value: 100}
`);
		expect(block).not.toBeNull();
		const buttons = block!.querySelectorAll(".kf-scale-block button");
		expect(buttons.length).toBe(1);
		expect(buttons[0]!.textContent).toContain("1:1");
	});

	it("rejects a non-string scale name", () => {
		const block = render(`unit: g
scales:
  - name: 2
    mult: 2
sections:
  - name: S
    items:
      - {name: A, value: 100}
`);
		expect(block).toBeNull();
		expect(errorEl()?.textContent ?? "").toMatch(/name/i);
	});

	it("does not silently zero amounts for mult: 0", () => {
		const block = render(`unit: g
scales:
  - name: Zero
    mult: 0
sections:
  - name: S
    items:
      - {name: A, value: 100}
`);
		if (block) {
			expect(valueText(items(block, 0)[0])).not.toBe("0");
		} else {
			expect(errorEl()).not.toBeNull();
		}
	});
});

describe("finding 2: quoted numeric values stay strings", () => {
	it("prefillVars stores numbers, not strings", () => {
		const recipe = {
			scales: [],
			sections: [{name: "S", items: [{name: "A", id: "a", value: "800"}]}],
		} as unknown as Recipe;
		const vars: Vars = {};
		prefillVars(recipe, vars);
		expect(vars.a).toBe(800);
	});

	it("uses quoted numeric values in + formulas", () => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: Meat, id: meat, value: "800"}
      - {name: Lard, id: lard, value: "200"}
      - {name: Spice, calc: "(meat + lard) @ 20"}
`);
		expect(valueText(block ? items(block, 0)[2] : undefined)).toBe("20");
	});

	it("does coerce quoted values for * — which is why the + bug is easy to miss", () => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: Meat, id: meat, value: "800"}
      - {name: Double, calc: "meat * 2"}
`);
		expect(valueText(block ? items(block, 0)[1] : undefined)).toBe("1600");
	});

	it("rejects a non-numeric value with a clear error", () => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: Meat, id: meat, value: "1/2"}
      - {name: Spice, calc: "meat * 2"}
`);
		expect(block).toBeNull();
		expect(errorEl()?.textContent ?? "").toMatch(/value/i);
	});
});

describe("finding 3: recalc error isolation", () => {
	it("calculates later formulas after an earlier one fails", () => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: Broken, calc: "missing * 2"}
      - {name: Good, calc: "1 + 1"}
`);
		expect(valueText(block ? items(block, 0)[1] : undefined)).toBe("2");
	});

	it("calculates a visible variant even when a hidden variant is broken", () => {
		const block = render(`unit: g
sections:
  - choice: Filling
    name: Bad
    items:
      - {name: Broken, calc: "missing * 2"}
  - choice: Filling
    name: Good
    items:
      - {name: Good calc, calc: "1 + 1"}
`);
		if (!block) throw new Error("block not rendered");
		const buttons = Array.from(block.querySelectorAll<HTMLButtonElement>(".kf-choice-btn"));
		buttons[1]!.click();
		const visible = Array.from(block.querySelectorAll<HTMLElement>(".kf-choice-variant"))
			.find(v => !v.classList.contains("kf-hidden"));
		expect(visible?.querySelector("li b")?.textContent ?? "").toContain("2");
	});

	it("does not accumulate errors on every input change", () => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: A, id: a, value: 10}
      - {name: Broken, calc: "missing * 2"}
`);
		if (!block) throw new Error("block not rendered");
		const input = inputFor(items(block, 0)[0])!;
		for (let i = 0; i < 3; i++) {
			input.value = String(20 + i);
			input.dispatchEvent(new Event("input"));
		}
		expect(container.querySelectorAll(".kf-error").length).toBe(1);
	});

	it("clears a formula error after the formula becomes valid", () => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: A, id: a}
      - {name: B, calc: "a * 2"}
`);
		if (!block) throw new Error("block not rendered");
		expect(container.querySelector(".kf-error")).not.toBeNull();
		const input = inputFor(items(block, 0)[0])!;
		input.value = "5";
		input.dispatchEvent(new Event("input"));
		expect(container.querySelector(".kf-error")).toBeNull();
		expect(valueText(items(block, 0)[1])).toBe("10");
	});
});

describe("finding 4: scales: [] is treated as present", () => {
	it("does not render a scale block for an empty scales list", () => {
		const block = render(`unit: g
scales: []
sections:
  - name: S
    items:
      - {name: A, value: 100}
`);
		expect(block?.querySelector(".kf-scale-block") ?? null).toBeNull();
	});

	it("does not reject id/calc recipes for an empty scales list", () => {
		const block = render(`unit: g
scales: []
sections:
  - name: S
    items:
      - {name: A, id: a, value: 10}
      - {name: B, calc: "a * 2"}
`);
		expect(errorEl()).toBeNull();
		expect(block).not.toBeNull();
	});
});

describe("finding 5: unconditional initial applyScale", () => {
	it("does not round a small authored value down to zero when there are no scales", () => {
		const block = render(`unit: g
decimals: 2
sections:
  - name: S
    items:
      - {name: Small, value: 0.004}
`);
		expect(valueText(block ? items(block, 0)[0] : undefined)).toBe("0.004");
	});

	it("does not silently change authored precision when there are no scales", () => {
		const block = render(`unit: g
decimals: 2
sections:
  - name: S
    items:
      - {name: Precise, value: 12.345}
`);
		expect(valueText(block ? items(block, 0)[0] : undefined)).toBe("12.345");
	});

	it("does not collapse a non-zero amount to zero in roundToStep", () => {
		expect(roundToStep(0.4, 0.1, 0)).not.toBe(0);
	});
});

describe("finding 6: ids are not validated as jsep identifiers", () => {
	it.each([
		["hyphen", "olive-oil", "olive-oil * 2", "20"],
		["boolean literal", '"true"', "true * 2", "20"],
		["space", '"a b"', "a b", "10"],
		["prototype key", '"__proto__"', "__proto__ * 2", "20"],
	] as const)("handles %s id", (_label, id, calc, expected) => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: A, id: ${id}, value: 10}
      - {name: B, calc: "${calc}"}
`);
		expectIdHandled(block, expected);
	});

	it("does not resolve an id without a value through Object.prototype", () => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: A, id: "constructor"}
      - {name: B, calc: "constructor * 2"}
`);
		const err = errorEl();
		if (err) {
			// A clear validation error or a normal "unknown variable" is fine.
			expect(err.textContent ?? "").toMatch(/\bid\b|Unknown variable/i);
		} else {
			expect(block?.textContent ?? "").not.toContain("NaN");
		}
	});
});

describe("finding 7: id + calc on one item", () => {
	it("rejects the combination or keeps vars in sync", () => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: A, id: a, value: 10, calc: "2"}
      - {name: B, calc: "a * 2"}
`);
		const err = errorEl();
		if (err) {
			expect(err.textContent ?? "").toMatch(/\b(id|calc)\b/i);
		} else {
			expect(valueText(block ? items(block, 0)[1] : undefined)).toBe("4");
		}
	});
});

describe("finding 8: no runtime validation of numeric/string fields", () => {
	it("rejects a non-numeric round", () => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: A, value: 100, round: abc}
`);
		expect(block).toBeNull();
		expect(errorEl()?.textContent ?? "").toMatch(/round/i);
	});

	it("rejects non-numeric decimals", () => {
		const block = render(`unit: g
decimals: abc
sections:
  - name: S
    items:
      - {name: A, value: 100}
`);
		expect(block).toBeNull();
		expect(errorEl()?.textContent ?? "").toMatch(/decimals/i);
	});

	it("accepts decimals at the supported precision limit", () => {
		const block = render(`unit: g
decimals: 15
sections:
  - name: S
    items:
      - {name: A, value: 100}
`);
		expect(block).not.toBeNull();
	});

	it("rejects decimals above the supported precision limit", () => {
		const block = render(`unit: g
decimals: 16
sections:
  - name: S
    items:
      - {name: A, value: 100}
`);
		expect(block).toBeNull();
		expect(errorEl()?.textContent ?? "").toMatch(/decimals/i);
	});

	it("rejects an object value", () => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: A, value: {}}
`);
		expect(block).toBeNull();
		expect(errorEl()?.textContent ?? "").toMatch(/value/i);
	});

	it("rejects object name/unit", () => {
		const block = render(`unit: {}
sections:
  - name: S
    items:
      - name: {}
        value: 1
`);
		expect(block).toBeNull();
		expect(errorEl()?.textContent ?? "").toMatch(/name|unit/i);
	});

	it("rejects a non-string calc with a clear error", () => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: A, calc: 123}
`);
		expect(block).toBeNull();
		expect(errorEl()?.textContent ?? "").toMatch(/calc/i);
	});
});

describe("finding 9: empty number input", () => {
	it("does not show 0 in formulas while the input is empty", () => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: A, id: a, value: 10}
      - {name: B, calc: "a * 2"}
`);
		if (!block) throw new Error("block not rendered");
		const input = inputFor(items(block, 0)[0])!;
		input.value = "";
		input.dispatchEvent(new Event("input"));
		expect(input.value).toBe("");
		expect(valueText(items(block, 0)[1])).toBe("");
		expect(errorEl()?.textContent ?? "").toMatch(/Unknown variable: a/);
	});
});

describe("finding 10: float rounding", () => {
	it("rounds 1.005 to 1.01", () => {
		expect(round(1.005, 2)).toBe(1.01);
	});

	it("rounds 8.575 to 8.58", () => {
		expect(round(8.575, 2)).toBe(8.58);
	});
});

describe("finding 11: unary minus", () => {
	it("evaluates a leading unary minus", () => {
		const el = {setText: vi.fn()};
		const item = {name: "A"} as Ingredient;
		expect(() => recalcCalcBindings([{expr: "-5", el, item}], {}, 2)).not.toThrow();
		expect(el.setText).toHaveBeenCalledWith("-5");
	});
});

describe("finding 12: error prefix", () => {
	it("does not label formula errors as parse errors", () => {
		render(`unit: g
sections:
  - name: S
    items:
      - {name: A, calc: "missing * 2"}
`);
		expect(errorEl()?.textContent ?? "").not.toContain("Error parsing recipe");
	});
});

describe("finding 13: section rendering", () => {
	it("does not render a whitespace-only heading", () => {
		const block = render(`unit: g
sections:
  - name: "   "
    items:
      - {name: A, value: 1}
`);
		const headings = Array.from(block?.querySelectorAll("h3") ?? []);
		expect(headings.every(h => (h.textContent ?? "").trim().length > 0)).toBe(true);
	});

	it("does not add a gap before the first unnamed section", () => {
		const block = render(`unit: g
sections:
  - items:
      - {name: A, value: 1}
  - items:
      - {name: B, value: 2}
`);
		if (!block) throw new Error("block not rendered");
		const wrappers = Array.from(block.querySelectorAll<HTMLElement>(".kf-section"));
		expect(wrappers[0]?.querySelector(".kf-section-gap") ?? null).toBeNull();
		expect(wrappers[1]?.querySelector(".kf-section-gap") ?? null).not.toBeNull();
	});
});

describe("finding 14: copy of an id item without a value", () => {
	it("does not copy 'undefined'", async () => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: A, id: a}
`);
		if (!block) throw new Error("block not rendered");
		const copied = await copyRecipe(block);
		expect(copied).not.toContain("undefined");
		expect(copied).toContain("A: **— g**");
	});
});

describe("finding 15: number input attributes", () => {
	it("sets step=any and an accessible name", () => {
		const block = render(`unit: g
sections:
  - name: S
    items:
      - {name: A, id: a, value: 10}
`);
		if (!block) throw new Error("block not rendered");
		const input = inputFor(items(block, 0)[0])!;
		expect(input.getAttribute("step")).toBe("any");
		expect(input.getAttribute("aria-label")).toBeTruthy();
	});
});

describe("finding 16: docs/config", () => {
	const read = (name: string) => readFileSync(`${globalThis.process.cwd()}/${name}`, "utf8");

	it("does not claim 139 tests in README.md", () => {
		expect(read("README.md").includes("139 tests")).toBe(false);
	});

	it("does not claim 139 tests in README.fr.md", () => {
		expect(read("README.fr.md").includes("139 tests")).toBe(false);
	});

	it("does not use __dirname in vitest.config.ts", () => {
		expect(read("vitest.config.ts").includes("__dirname")).toBe(false);
	});
});
