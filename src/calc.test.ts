import {beforeAll, describe, expect, it} from "vitest";
import jsep from "jsep";
import {evaluate, round, roundToStep, Vars} from "./calc";

beforeAll(() => {
	jsep.addBinaryOp("@", 10);
});

describe("round", () => {
	it("rounds to the given number of decimals", () => {
		expect(round(1.2345, 2)).toBe(1.23);
		expect(round(1.2355, 3)).toBe(1.236);
		expect(round(1.5, 0)).toBe(2);
	});

	it("rounds half away from zero for positive numbers", () => {
		expect(round(0.5, 0)).toBe(1);
		expect(round(2.5, 0)).toBe(3);
	});

	it("rounds half toward +Infinity for negative numbers (JS Math.round)", () => {
		expect(round(-0.5, 0)).toBe(-0);
		expect(round(-1.5, 0)).toBe(-1);
		expect(round(-1.25, 1)).toBe(-1.2);
	});

	it("returns the same value when already at target precision", () => {
		expect(round(1.23, 2)).toBe(1.23);
		expect(round(7, 0)).toBe(7);
		expect(round(0, 2)).toBe(0);
	});

	it("rounds values with binary floating-point artefacts", () => {
		expect(round(1.005, 2)).toBe(1.01);
		expect(round(8.575, 2)).toBe(8.58);
	});

	it("leaves values unchanged when decimal shifting would overflow", () => {
		expect(round(1e307, 2)).toBe(1e307);
		expect(round(1.5, 309)).toBe(1.5);
	});

	it("handles negative decimals (rounds to tens, hundreds, ...)", () => {
		expect(round(1234, -1)).toBe(1230);
		expect(round(1250, -2)).toBe(1300);
	});

	it("preserves negative zero-sign edge cases as 0", () => {
		expect(round(-0.0001, 2)).toBe(-0);
	});
});

describe("roundToStep", () => {
	it("snaps to the nearest multiple of step", () => {
		expect(roundToStep(150, 25, 1)).toBe(150);
		expect(roundToStep(49.5, 25, 1)).toBe(50);
		expect(roundToStep(33, 25, 1)).toBe(25);
		expect(roundToStep(16.5, 5, 1)).toBe(15);
	});

	it("rounds whole-unit ingredients (step 1) to integers", () => {
		expect(roundToStep(0.5, 1, 1)).toBe(1);
		expect(roundToStep(1.4, 1, 1)).toBe(1);
		expect(roundToStep(3.3, 1, 1)).toBe(3);
	});

	it("floors a non-zero amount at one step so it never vanishes", () => {
		// 1 egg * 0.33 = 0.33 → would round to 0, but floors to a whole egg.
		expect(roundToStep(0.33, 1, 1)).toBe(1);
		expect(roundToStep(0.0001, 25, 1)).toBe(25);
	});

	it("keeps an exact zero as zero (no spurious floor)", () => {
		expect(roundToStep(0, 1, 1)).toBe(0);
		expect(roundToStep(0, 25, 1)).toBe(0);
	});

	it("floors negative amounts toward -step (sign preserved)", () => {
		expect(roundToStep(-0.1, 5, 1)).toBe(-5);
	});

	it("scrubs floating-point artefacts via decimals", () => {
		// 0.1 * 3 = 0.30000000000000004 without the final cleanup.
		expect(roundToStep(0.3, 0.1, 2)).toBe(0.3);
	});

	it("falls back to plain decimal rounding when step is non-positive", () => {
		expect(roundToStep(1.2345, 0, 2)).toBe(1.23);
		expect(roundToStep(1.2345, -5, 2)).toBe(1.23);
	});
});

describe("evaluate", () => {
	const parse = (expr: string) => jsep(expr);

	describe("literals", () => {
		it("evaluates positive integer literal", () => {
			expect(evaluate(parse("42"), {})).toBe(42);
		});

		it("evaluates decimal literal", () => {
			expect(evaluate(parse("3.14"), {})).toBe(3.14);
		});

		it("evaluates zero", () => {
			expect(evaluate(parse("0"), {})).toBe(0);
		});
	});

	describe("identifiers", () => {
		it("resolves an identifier from vars", () => {
			const vars: Vars = {flour: 500};
			expect(evaluate(parse("flour"), vars)).toBe(500);
		});

		it("resolves an identifier with value 0", () => {
			const vars: Vars = {empty: 0};
			expect(evaluate(parse("empty"), vars)).toBe(0);
		});

		it("throws on unknown variable", () => {
			expect(() => evaluate(parse("unknown"), {})).toThrow("Unknown variable: unknown");
		});

		it("throws on variable explicitly set to undefined", () => {
			const vars = {x: undefined as unknown as number};
			expect(() => evaluate(parse("x"), vars)).toThrow("Unknown variable: x");
		});
	});

	describe("binary operators", () => {
		it("addition", () => {
			expect(evaluate(parse("2 + 3"), {})).toBe(5);
		});

		it("subtraction", () => {
			expect(evaluate(parse("10 - 4"), {})).toBe(6);
		});

		it("multiplication", () => {
			expect(evaluate(parse("6 * 7"), {})).toBe(42);
		});

		it("division", () => {
			expect(evaluate(parse("20 / 4"), {})).toBe(5);
		});

		it("custom @ operator computes a * b / 1000", () => {
			expect(evaluate(parse("500 @ 20"), {})).toBe(10);
			expect(evaluate(parse("1000 @ 1000"), {})).toBe(1000);
		});

		it("respects operator precedence: * before +", () => {
			expect(evaluate(parse("2 + 3 * 4"), {})).toBe(14);
		});

		it("respects parentheses overriding precedence", () => {
			expect(evaluate(parse("(2 + 3) * 4"), {})).toBe(20);
		});

		it("evaluates nested expressions with variables", () => {
			const vars: Vars = {flour: 500, ratio: 0.6};
			expect(evaluate(parse("flour * ratio"), vars)).toBe(300);
		});

		it("evaluates a baker's-percentage style formula via @ operator", () => {
			const vars: Vars = {flour: 500};
			expect(evaluate(parse("flour @ 65"), vars)).toBe(32.5);
		});

		it("propagates Infinity on division by zero (no throw)", () => {
			expect(evaluate(parse("1 / 0"), {})).toBe(Infinity);
		});

		it("throws on an unsupported binary operator (e.g. %)", () => {
			expect(() => evaluate(parse("10 % 3"), {})).toThrow("Unsupported operator: %");
		});
	});

	describe("unary expressions", () => {
		it("evaluates unary minus and plus", () => {
			expect(evaluate(parse("-5"), {})).toBe(-5);
			expect(evaluate(parse("+5"), {})).toBe(5);
			expect(evaluate(parse("-(2 + 3)"), {})).toBe(-5);
		});

		it("throws on an unsupported unary operator (e.g. ~)", () => {
			expect(() => evaluate(parse("~5"), {})).toThrow(/Unsupported unary operator/);
		});
	});

	describe("unsupported node types", () => {
		it("throws on a call expression", () => {
			expect(() => evaluate(parse("foo()"), {})).toThrow(/Unsupported node type/);
		});
	});
});
