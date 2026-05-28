import jsep from "jsep";

export type Vars = Record<string, number>;

export function round(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

export function evaluate(node: jsep.Expression, vars: Vars): number {
	switch (node.type) {

		case "Literal":
			return Number((node as jsep.Literal).value);

		case "Identifier": {
			const name = (node as jsep.Identifier).name;
			const value = vars[name];

			if (value == null) {
				throw new Error(`Unknown variable: ${name}`);
			}

			return value;
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
