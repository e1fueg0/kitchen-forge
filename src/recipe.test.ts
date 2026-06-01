import {beforeAll, describe, expect, it, vi} from "vitest";
import jsep from "jsep";
import {round} from "./calc";
import {Vars} from "./calc";
import {
	applyScale,
	CalcBinding,
	formatRecipeToMarkdown,
	Ingredient,
	MultBinding,
	prefillVars,
	recalcCalcBindings,
	Recipe,
} from "./recipe";

beforeAll(() => {
	jsep.addBinaryOp("@", 10);
});

describe("formatRecipeToMarkdown", () => {
	it("formats a single section with numbered items", () => {
		const recipe: Recipe = {
			scales: [],
			sections: [
				{
					name: "Тесто",
					items: [
						{name: "Мука", value: 400, unit: "г"},
						{name: "Сахар", value: 50, unit: "г"},
					],
				},
			],
		};
		expect(formatRecipeToMarkdown(recipe)).toBe(
			"__Тесто__\n\n 1. Мука: **400 г**\n 2. Сахар: **50 г**\n",
		);
	});

	it("formats multiple sections with their own numbering and a trailing blank line each", () => {
		const recipe: Recipe = {
			scales: [],
			sections: [
				{name: "A", items: [{name: "x", value: 1, unit: "g"}]},
				{name: "B", items: [
					{name: "y", value: 2, unit: "g"},
					{name: "z", value: 3, unit: "ml"},
				]},
			],
		};
		expect(formatRecipeToMarkdown(recipe)).toBe(
			[
				"__A__",
				"",
				" 1. x: **1 g**",
				"",
				"__B__",
				"",
				" 1. y: **2 g**",
				" 2. z: **3 ml**",
				"",
			].join("\n"),
		);
	});

	it("renders missing value/unit as 'undefined' (current behaviour, surfaces under-spec'd items)", () => {
		const recipe: Recipe = {
			scales: [],
			sections: [
				{name: "X", items: [{name: "broken"}]},
			],
		};
		expect(formatRecipeToMarkdown(recipe)).toBe(
			"__X__\n\n 1. broken: **undefined undefined**\n",
		);
	});
});

describe("applyScale", () => {
	function makeBinding(origValue: number): {binding: MultBinding; item: Ingredient; el: {setText: ReturnType<typeof vi.fn>}} {
		const el = {setText: vi.fn()};
		const item: Ingredient = {name: "x", value: origValue};
		const binding: MultBinding = {origValue, el, item};
		return {binding, item, el};
	}

	it("multiplies each binding's origValue by the scale, rounds, and writes via setText", () => {
		const a = makeBinding(400);
		const b = makeBinding(140);
		const c = makeBinding(2);
		applyScale([a.binding, b.binding, c.binding], 0.5, 1);
		expect(a.el.setText).toHaveBeenCalledWith("200");
		expect(b.el.setText).toHaveBeenCalledWith("70");
		expect(c.el.setText).toHaveBeenCalledWith("1");
	});

	it("mutates item.value with the scaled and rounded result", () => {
		const a = makeBinding(400);
		applyScale([a.binding], 0.33, 1);
		// 400 * 0.33 = 132 → round(132, 1) = 132
		expect(a.item.value).toBe(132);
	});

	it("always scales relative to origValue, not the latest item.value", () => {
		const a = makeBinding(400);
		applyScale([a.binding], 0.5, 1); // item.value becomes 200
		applyScale([a.binding], 1, 1);   // should restore to 400, not 200
		expect(a.item.value).toBe(400);
		expect(a.el.setText).toHaveBeenLastCalledWith("400");
	});

	it("honors the decimals argument", () => {
		const a = makeBinding(2);
		applyScale([a.binding], 0.33, 0);
		// 2 * 0.33 = 0.66 → round(.., 0) = 1
		expect(a.el.setText).toHaveBeenCalledWith("1");
		expect(a.item.value).toBe(1);
	});

	it("is a no-op on an empty binding list", () => {
		expect(() => applyScale([], 0.5, 2)).not.toThrow();
	});

	it("snaps to a per-item round step instead of decimals when set", () => {
		const a = makeBinding(150);
		a.item.round = 25;
		applyScale([a.binding], 0.33, 1); // 150 * 0.33 = 49.5 → nearest 25 = 50
		expect(a.el.setText).toHaveBeenCalledWith("50");
		expect(a.item.value).toBe(50);
	});

	it("floors a rounded whole-unit ingredient at one step so it never hits 0", () => {
		const egg = makeBinding(1);
		egg.item.round = 1;
		applyScale([egg.binding], 0.33, 1); // 0.33 → would be 0, floored to 1
		expect(egg.el.setText).toHaveBeenCalledWith("1");
		expect(egg.item.value).toBe(1);
	});
});

describe("recalcCalcBindings", () => {
	function makeCalcBinding(expr: string): {binding: CalcBinding; item: Ingredient; el: {setText: ReturnType<typeof vi.fn>}} {
		const el = {setText: vi.fn()};
		const item: Ingredient = {name: expr};
		const binding: CalcBinding = {expr, el, item};
		return {binding, item, el};
	}

	it("evaluates each expression against vars and writes the rounded result", () => {
		const a = makeCalcBinding("flour + lard");
		const b = makeCalcBinding("flour @ 15");
		recalcCalcBindings([a.binding, b.binding], {flour: 801, lard: 200}, 2);
		expect(a.el.setText).toHaveBeenCalledWith("1001");
		expect(b.el.setText).toHaveBeenCalledWith(String(round((801 * 15) / 1000, 2)));
		expect(a.item.value).toBe(1001);
		expect(b.item.value).toBe(12.02);
	});

	it("uses the supplied decimals", () => {
		const a = makeCalcBinding("x / 3");
		recalcCalcBindings([a.binding], {x: 10}, 1);
		// 10 / 3 = 3.333... → round to 3.3
		expect(a.el.setText).toHaveBeenCalledWith("3.3");
		expect(a.item.value).toBe(3.3);
	});

	it("propagates evaluation errors (unknown variable)", () => {
		const a = makeCalcBinding("nonexistent + 1");
		expect(() => recalcCalcBindings([a.binding], {}, 2)).toThrow(
			"Unknown variable: nonexistent",
		);
	});

	it("propagates parse errors from jsep when expressions are malformed", () => {
		const a = makeCalcBinding("a + + +");
		expect(() => recalcCalcBindings([a.binding], {a: 1}, 2)).toThrow();
	});

	it("is a no-op on an empty binding list", () => {
		expect(() => recalcCalcBindings([], {}, 2)).not.toThrow();
	});

	it("applies a per-item round step to the computed result", () => {
		const a = makeCalcBinding("flour @ 2"); // 137 * 2 / 1000 = 0.274
		a.item.round = 0.5;
		recalcCalcBindings([a.binding], {flour: 137}, 2); // 0.274 → nearest 0.5, floored to 0.5
		expect(a.el.setText).toHaveBeenCalledWith("0.5");
		expect(a.item.value).toBe(0.5);
	});
});

describe("prefillVars", () => {
	function makeRecipe(items: Ingredient[]): Recipe {
		return {scales: [], sections: [{name: "S", items}]};
	}

	it("populates vars with id+value pairs", () => {
		const vars: Vars = {};
		prefillVars(makeRecipe([
			{name: "A", id: "a", value: 10},
			{name: "B", id: "b", value: 20},
		]), vars);
		expect(vars).toEqual({a: 10, b: 20});
	});

	it("treats value of 0 as a valid value (only null/undefined skipped)", () => {
		const vars: Vars = {};
		prefillVars(makeRecipe([{name: "zero", id: "z", value: 0}]), vars);
		expect(vars).toEqual({z: 0});
	});

	it("skips id items that have no value", () => {
		const vars: Vars = {};
		prefillVars(makeRecipe([{name: "A", id: "a"}]), vars);
		expect(vars).toEqual({});
	});

	it("ignores items that have only a value (no id)", () => {
		const vars: Vars = {};
		prefillVars(makeRecipe([{name: "plain", value: 5}]), vars);
		expect(vars).toEqual({});
	});

	it("aggregates vars across multiple sections", () => {
		const vars: Vars = {};
		const recipe: Recipe = {
			scales: [],
			sections: [
				{name: "X", items: [{name: "A", id: "a", value: 1}]},
				{name: "Y", items: [{name: "B", id: "b", value: 2}]},
			],
		};
		prefillVars(recipe, vars);
		expect(vars).toEqual({a: 1, b: 2});
	});

	it("preserves pre-existing entries in the vars object", () => {
		const vars: Vars = {seeded: 99};
		prefillVars(makeRecipe([{name: "A", id: "a", value: 1}]), vars);
		expect(vars).toEqual({seeded: 99, a: 1});
	});

	it("returns true when any item has an id", () => {
		const vars: Vars = {};
		expect(prefillVars(makeRecipe([{name: "A", id: "a", value: 1}]), vars)).toBe(true);
	});

	it("returns true when any item has a calc, even if no ids exist", () => {
		const vars: Vars = {};
		expect(prefillVars(makeRecipe([{name: "B", calc: "1 + 1"}]), vars)).toBe(true);
	});

	it("returns true for an id-only item even without a value (still considered 'interactive')", () => {
		const vars: Vars = {};
		expect(prefillVars(makeRecipe([{name: "A", id: "a"}]), vars)).toBe(true);
	});

	it("returns false for a plain value-only recipe (scale-mode candidate)", () => {
		const vars: Vars = {};
		expect(prefillVars(makeRecipe([
			{name: "A", value: 100},
			{name: "B", value: 200},
		]), vars)).toBe(false);
	});

	it("returns false for an empty recipe", () => {
		const vars: Vars = {};
		expect(prefillVars({scales: [], sections: []}, vars)).toBe(false);
	});
});
