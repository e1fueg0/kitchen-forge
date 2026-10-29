import jsep from "jsep";

export type Vars = Record<string, number>;

// Move the decimal point without multiplying: `1.005 * 100` is
// 100.49999999999999 in binary floating point, while `1.005e2` is exactly
// 100.5. `toExponential()` gives one normalized mantissa and exponent, so the
// shift also works for very large and very small values.
function shiftDecimal(value: number, decimals: number): number {
	const [mantissa, exponent] = value.toExponential().split("e");
	return Number(`${mantissa}e${Number(exponent) + decimals}`);
}

export function round(value: number, decimals: number): number {
	if (!Number.isFinite(value))
		return value;

	const rounded = Math.round(shiftDecimal(value, decimals));
	// `Math.round` uses JS semantics (half toward +Infinity), including its
	// negative-zero result for values such as -0.5. Decimal shifting loses the
	// sign of -0, so restore it explicitly.
	if (rounded === 0)
		return value < 0 || Object.is(value, -0) ? -0 : 0;
	return shiftDecimal(rounded, -decimals);
}

// Round to the nearest multiple of `step` (e.g. eggs to whole units, coarse
// ingredients to the nearest 25 g). A non-zero amount never collapses to zero —
// it floors at one step — so scaling down can't make an ingredient vanish.
// `decimals` is used only to scrub floating-point artefacts from the result.
export function roundToStep(value: number, step: number, decimals: number): number {
	if (step <= 0) return round(value, decimals);
	const snapped = Math.round(value / step) * step;
	const floored = snapped === 0 && value !== 0 ? Math.sign(value) * step : snapped;
	const result = round(floored, decimals);
	// Rounding to `decimals` can turn a small non-zero step (for example 0.1
	// with decimals=0) back into zero. Keep at least one step in that case.
	if (result === 0 && value !== 0)
		return Math.sign(value) * step;
	return result;
}

export function evaluate(node: jsep.Expression, vars: Vars): number {
	switch (node.type) {

		case "Literal":
			return Number((node as jsep.Literal).value);

		case "Identifier": {
			const name = (node as jsep.Identifier).name;
			const value = vars[name];

			// Only own properties are variables. Otherwise names such as
			// "constructor" or "toString" would resolve through Object.prototype.
			if (!Object.prototype.hasOwnProperty.call(vars, name) || value == null) {
				throw new Error(`Unknown variable: ${name}`);
			}

			return value;
		}

		case "UnaryExpression": {
			const unary = node as jsep.UnaryExpression;
			if (!unary.prefix)
				throw new Error(`Unsupported unary operator: ${unary.operator}`);

			const argument = evaluate(unary.argument, vars);
			switch (unary.operator) {
				case "-":
					return -argument;

				case "+":
					return +argument;

				default:
					throw new Error(`Unsupported unary operator: ${unary.operator}`);
			}
		}

		case "BinaryExpression": {
			const bin = node as jsep.BinaryExpression;
			const left = evaluate(bin.left, vars);
			const right = evaluate(bin.right, vars);

			let result;
			switch (bin.operator) {
				case "+":
					result = left + right;
					break;

				case "-":
					result = left - right;
					break;

				case "*":
					result = left * right;
					break;

				case "/":
					result = left / right;
					break;

				case "@":
					result = left * right / 1000;
					break;

				default:
					throw new Error(`Unsupported operator: ${bin.operator}`);
			}
			return result;
		}

		default:
			throw new Error(`Unsupported node type: ${node.type}`);
	}
}
