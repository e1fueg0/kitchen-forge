import {beforeAll, beforeEach, describe, expect, it} from "vitest";
import jsep from "jsep";
import type {MarkdownPostProcessorContext} from "obsidian";
import {round} from "./calc";
import {processKitchenForgeBlock} from "./kitchenforge";

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

function getSectionItems(block: HTMLElement, sectionIndex: number): HTMLLIElement[] {
	const ol = block.querySelectorAll("ol")[sectionIndex];
	return ol ? Array.from(ol.querySelectorAll("li")) : [];
}

function getItemValueText(item: HTMLLIElement | undefined): string {
	const b = item?.querySelector("b");
	if (!b) return "";
	const input = b.querySelector("input");
	if (input) return input.value;
	const valueSpan = b.firstElementChild;
	return valueSpan?.textContent ?? "";
}

function getItemUnit(item: HTMLLIElement | undefined): string {
	const b = item?.querySelector("b");
	if (!b) return "";
	const unitSpan = b.lastElementChild;
	return (unitSpan?.textContent ?? "").trim();
}

const calcRecipe = `
unit: г
sections:
  - name: 🥩 Сырьё
    items:
      - name: Свинина полужирная
        id: porc
        value: 801

      - name: Шпик
        id: lard
        value: 200

  - name: 🧂 Специи и пряности
    items:
      - name: Соль нитритная (0,6 % NaNO₂)
        calc: (porc + lard) @ 20

      - name: Перец чёрный молотый
        calc: (porc + lard) @ 1.5

      - name: Мускатный орех
        calc: (porc + lard) @ .5

      - name: Сахар
        calc: (porc + lard) @ 1.5

      - name: Чеснок сушёный
        calc: (porc + lard) @ 5

      - name: Сухое молоко
        calc: (porc + lard) @ 5

      - name: Вода ледяная
        calc: porc @ 15
`;

describe("workflow 1: id + calc", () => {
	it("renders both sections with the correct number of items", () => {
		const block = render(calcRecipe);
		expect(block).not.toBeNull();
		const headings = block!.querySelectorAll("h3");
		expect(headings.length).toBe(2);
		expect(headings[0]!.textContent).toBe("🥩 Сырьё");
		expect(headings[1]!.textContent).toBe("🧂 Специи и пряности");
		expect(getSectionItems(block!, 0).length).toBe(2);
		expect(getSectionItems(block!, 1).length).toBe(7);
	});

	it("renders id items as <input type=number> with their initial value", () => {
		const block = render(calcRecipe);
		const raw = getSectionItems(block!, 0);
		const porc = raw[0]!.querySelector("input");
		const lard = raw[1]!.querySelector("input");
		expect(porc).not.toBeNull();
		expect(porc!.type).toBe("number");
		expect(porc!.value).toBe("801");
		expect(lard).not.toBeNull();
		expect(lard!.value).toBe("200");
	});

	it("evaluates @ formulas at render time using id values", () => {
		const block = render(calcRecipe);
		const spices = getSectionItems(block!, 1);
		const total = 801 + 200;
		expect(getItemValueText(spices[0])).toBe(String(round(total * 20 / 1000, 2)));
		expect(getItemValueText(spices[1])).toBe(String(round(total * 1.5 / 1000, 2)));
		expect(getItemValueText(spices[2])).toBe(String(round(total * 0.5 / 1000, 2)));
		expect(getItemValueText(spices[3])).toBe(String(round(total * 1.5 / 1000, 2)));
		expect(getItemValueText(spices[4])).toBe(String(round(total * 5 / 1000, 2)));
		expect(getItemValueText(spices[5])).toBe(String(round(total * 5 / 1000, 2)));
		expect(getItemValueText(spices[6])).toBe(String(round(801 * 15 / 1000, 2)));
	});

	it("uses the recipe-level unit (г) when item has no override", () => {
		const block = render(calcRecipe);
		const ingredients = getSectionItems(block!, 0);
		const spices = getSectionItems(block!, 1);
		expect(getItemUnit(ingredients[0])).toBe("г");
		expect(getItemUnit(ingredients[1])).toBe("г");
		expect(getItemUnit(spices[0])).toBe("г");
	});

	it("recalculates all dependent calc items when an id input changes", () => {
		const block = render(calcRecipe);
		const ingredients = getSectionItems(block!, 0);
		const porcInput = ingredients[0]!.querySelector("input")!;

		porcInput.value = "1000";
		porcInput.dispatchEvent(new Event("input"));

		const spices = getSectionItems(block!, 1);
		const newTotal = 1000 + 200;
		expect(getItemValueText(spices[0])).toBe(String(round(newTotal * 20 / 1000, 2)));
		expect(getItemValueText(spices[6])).toBe(String(round(1000 * 15 / 1000, 2)));
	});

	it("does not render scale buttons when there are no scales", () => {
		const block = render(calcRecipe);
		expect(block!.querySelector(".kf-scale-block")).toBeNull();
	});

	it("renders a copy (📋) button at the top of the block", () => {
		const block = render(calcRecipe);
		const firstBtn = block!.querySelector("button");
		expect(firstBtn).not.toBeNull();
		expect(firstBtn!.textContent).toBe("📋");
	});
});

const scaleRecipe = `
unit: г
decimals: 1
scales:
  - name: Полный
    mult: 1
  - name: Половина
    mult: .5
  - name: Треть
    mult: .33
sections:
  - name: 🥣 Тесто
    items:
      - name: Мука
        value: 400
      - name: Сливочное масло
        value: 140
      - name: Яичные желтки
        value: 2
        unit: шт
      - name: Сметана
        value: 160
      - name: Соль
        value: 5

  - name: 🌰 Начинка
    items:
      - name: Молотые орехи
        value: 80
      - name: Сахарная пудра
        value: 40
`;

function getScaleButtons(block: HTMLElement): HTMLButtonElement[] {
	return Array.from(block.querySelectorAll(".kf-scale-block button"));
}

describe("workflow 2: scales", () => {
	it("renders all items with their initial values", () => {
		const block = render(scaleRecipe);
		expect(block).not.toBeNull();
		const dough = getSectionItems(block!, 0);
		expect(dough.length).toBe(5);
		expect(getItemValueText(dough[0])).toBe("400");
		expect(getItemValueText(dough[1])).toBe("140");
		expect(getItemValueText(dough[2])).toBe("2");
		expect(getItemValueText(dough[3])).toBe("160");
		expect(getItemValueText(dough[4])).toBe("5");
		const filling = getSectionItems(block!, 1);
		expect(filling.length).toBe(2);
		expect(getItemValueText(filling[0])).toBe("80");
		expect(getItemValueText(filling[1])).toBe("40");
	});

	it("respects per-item unit override (шт) and falls back to recipe unit otherwise", () => {
		const block = render(scaleRecipe);
		const dough = getSectionItems(block!, 0);
		expect(getItemUnit(dough[0])).toBe("г");
		expect(getItemUnit(dough[2])).toBe("шт");
	});

	it("renders one scale button per defined scale", () => {
		const block = render(scaleRecipe);
		const buttons = getScaleButtons(block!);
		expect(buttons.length).toBe(3);
	});

	it("pre-selects the scale with mult=1 on render", () => {
		const block = render(scaleRecipe);
		const buttons = getScaleButtons(block!);
		// scaleRecipe has Полный (mult: 1) first, Половина (.5), Треть (.33)
		expect(buttons[0]!.textContent?.startsWith("✅")).toBe(true);
		expect(buttons[1]!.textContent?.startsWith("🎚")).toBe(true);
		expect(buttons[2]!.textContent?.startsWith("🎚")).toBe(true);
	});

	it("pre-selects the mult=1 scale regardless of its position in the list", () => {
		const source = `
unit: г
scales:
  - name: Половина
    mult: .5
  - name: Полный
    mult: 1
  - name: Треть
    mult: .33
sections:
  - name: S
    items:
      - name: A
        value: 100
`;
		const block = render(source);
		const buttons = getScaleButtons(block!);
		expect(buttons[0]!.textContent?.startsWith("🎚")).toBe(true);
		expect(buttons[1]!.textContent?.startsWith("✅")).toBe(true);
		expect(buttons[2]!.textContent?.startsWith("🎚")).toBe(true);
	});

	it("leaves every scale on 🎚 when no scale has mult=1", () => {
		const source = `
unit: г
scales:
  - name: Половина
    mult: .5
  - name: Треть
    mult: .33
sections:
  - name: S
    items:
      - name: A
        value: 100
`;
		const block = render(source);
		const buttons = getScaleButtons(block!);
		for (const btn of buttons) {
			expect(btn.textContent?.startsWith("🎚")).toBe(true);
		}
	});

	it("halves all values when the 'Половина' scale is clicked", () => {
		const block = render(scaleRecipe);
		const half = getScaleButtons(block!).find(b => b.textContent?.includes("Половина"))!;
		half.click();

		const dough = getSectionItems(block!, 0);
		expect(getItemValueText(dough[0])).toBe(String(round(400 * 0.5, 1)));
		expect(getItemValueText(dough[1])).toBe(String(round(140 * 0.5, 1)));
		expect(getItemValueText(dough[2])).toBe(String(round(2 * 0.5, 1)));
		expect(getItemValueText(dough[3])).toBe(String(round(160 * 0.5, 1)));
		expect(getItemValueText(dough[4])).toBe(String(round(5 * 0.5, 1)));
		const filling = getSectionItems(block!, 1);
		expect(getItemValueText(filling[0])).toBe(String(round(80 * 0.5, 1)));
		expect(getItemValueText(filling[1])).toBe(String(round(40 * 0.5, 1)));
	});

	it("uses the decimals override (decimals: 1) when scaling", () => {
		const block = render(scaleRecipe);
		const third = getScaleButtons(block!).find(b => b.textContent?.includes("Треть"))!;
		third.click();

		const dough = getSectionItems(block!, 0);
		expect(getItemValueText(dough[0])).toBe(String(round(400 * 0.33, 1)));
		expect(getItemValueText(dough[1])).toBe(String(round(140 * 0.33, 1)));
		expect(getItemValueText(dough[2])).toBe(String(round(2 * 0.33, 1)));
	});

	it("scales relative to original values (clicking 'Полный' after 'Половина' restores them)", () => {
		const block = render(scaleRecipe);
		const buttons = getScaleButtons(block!);
		const half = buttons.find(b => b.textContent?.includes("Половина"))!;
		const full = buttons.find(b => b.textContent?.includes("Полный"))!;

		half.click();
		full.click();

		const dough = getSectionItems(block!, 0);
		expect(getItemValueText(dough[0])).toBe("400");
		expect(getItemValueText(dough[1])).toBe("140");
		expect(getItemValueText(dough[3])).toBe("160");
	});

	it("marks the clicked scale with ✅ and keeps 🎚 on the others", () => {
		const block = render(scaleRecipe);
		const buttons = getScaleButtons(block!);
		const half = buttons.find(b => b.textContent?.includes("Половина"))!;

		half.click();

		const after = getScaleButtons(block!);
		const halfText = after.find(b => b.textContent?.includes("Половина"))!.textContent ?? "";
		const fullText = after.find(b => b.textContent?.includes("Полный"))!.textContent ?? "";
		const thirdText = after.find(b => b.textContent?.includes("Треть"))!.textContent ?? "";

		expect(halfText.startsWith("✅")).toBe(true);
		expect(fullText.startsWith("🎚")).toBe(true);
		expect(thirdText.startsWith("🎚")).toBe(true);
	});

	it("moves the ✅ marker to the newly clicked scale and resets the previous one to 🎚", () => {
		const block = render(scaleRecipe);
		const buttons = getScaleButtons(block!);
		const half = buttons.find(b => b.textContent?.includes("Половина"))!;
		const full = buttons.find(b => b.textContent?.includes("Полный"))!;

		half.click();
		full.click();

		const after = getScaleButtons(block!);
		const halfText = after.find(b => b.textContent?.includes("Половина"))!.textContent ?? "";
		const fullText = after.find(b => b.textContent?.includes("Полный"))!.textContent ?? "";

		expect(halfText.startsWith("🎚")).toBe(true);
		expect(fullText.startsWith("✅")).toBe(true);
	});
});

describe("error handling", () => {
	it("renders a .kf-error paragraph for malformed YAML", () => {
		render("this is: not\n  valid: yaml: ::");
		const err = errorEl();
		expect(err).not.toBeNull();
		expect(err!.textContent).toMatch(/^Error parsing recipe:/);
	});

	it("reports an error for an empty source", () => {
		render("");
		const err = errorEl();
		expect(err).not.toBeNull();
		expect(err!.textContent).toContain("Recipe must be a YAML mapping");
	});

	it("reports an error for a recipe with no 'sections' field", () => {
		render("unit: г\n");
		const err = errorEl();
		expect(err).not.toBeNull();
		expect(err!.textContent).toContain("Recipe must have a 'sections' array");
	});

	it("reports an error naming the section when 'items' is missing", () => {
		render(`
unit: г
sections:
  - name: Broken
`);
		const err = errorEl();
		expect(err).not.toBeNull();
		expect(err!.textContent).toContain("Section 'Broken' must have an 'items' array");
	});

	it("prefixes formula errors with 'Formula error:' to distinguish them from parse errors", () => {
		const source = `
unit: г
sections:
  - name: Section
    items:
      - name: A
        id: a
        value: 10
      - name: B
        calc: nonexistent * 2
`;
		render(source);
		const err = errorEl();
		expect(err).not.toBeNull();
		expect(err!.textContent).toContain("Formula error: Unknown variable: nonexistent");
	});

	it("rejects scales combined with id/calc items", () => {
		const source = `
unit: г
scales:
  - name: Полный
    mult: 1
sections:
  - name: Section
    items:
      - name: A
        id: a
        value: 10
      - name: B
        calc: a * 2
`;
		render(source);
		const err = errorEl();
		expect(err).not.toBeNull();
		expect(err!.textContent).toContain("Cannot have scales with ids/formulas specified");
	});

	it("reports the unknown variable name when a calc references an undefined id", () => {
		const source = `
unit: г
sections:
  - name: Section
    items:
      - name: A
        id: a
        value: 10
      - name: B
        calc: nonexistent * 2
`;
		render(source);
		const err = errorEl();
		expect(err).not.toBeNull();
		expect(err!.textContent).toContain("Unknown variable: nonexistent");
	});

	it("reports an unsupported operator surfaced from a calc expression", () => {
		const source = `
unit: г
sections:
  - name: Section
    items:
      - name: A
        id: a
        value: 10
      - name: B
        calc: a % 3
`;
		render(source);
		const err = errorEl();
		expect(err).not.toBeNull();
		expect(err!.textContent).toMatch(/Unsupported operator: %/);
	});
});
