import {beforeAll, describe, expect, it, vi} from "vitest";
import jsep from "jsep";
import {round} from "./calc";
import {
	applyScale,
	CalcBinding,
	formatRecipeToMarkdown,
	Ingredient,
	MultBinding,
	recalcCalcBindings,
	Recipe,
} from "./recipe";

beforeAll(() => {
	jsep.addBinaryOp("@", 10);
});

describe("formatRecipeForClipboard", () => {
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
});
