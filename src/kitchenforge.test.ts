import {beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
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

	it("pre-selects the first scale in the list regardless of its mult", () => {
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
		// First scale (Половина, mult=0.5) should be selected and applied
		expect(buttons[0]!.textContent?.startsWith("✅")).toBe(true);
		expect(buttons[0]!.textContent).toContain("Половина");
		expect(buttons[1]!.textContent?.startsWith("🎚")).toBe(true);
		expect(buttons[2]!.textContent?.startsWith("🎚")).toBe(true);
		// Values should be halved (mult=0.5)
		const items = getSectionItems(block!, 0);
		expect(getItemValueText(items[0])).toBe("50"); // 100 * 0.5
	});

	it("adds an implicit 1:1 scale at the end when no scale has mult=1", () => {
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
		// The 💯 1:1 button is appended at the end; first user scale (Половина) is selected
		expect(buttons.length).toBe(3);
		expect(buttons[0]!.textContent?.startsWith("✅")).toBe(true);
		expect(buttons[0]!.textContent).toContain("Половина");
		expect(buttons[1]!.textContent?.startsWith("🎚")).toBe(true);
		expect(buttons[1]!.textContent).toContain("Треть");
		expect(buttons[2]!.textContent).toContain("1:1");
		expect(buttons[2]!.textContent?.startsWith("🎚")).toBe(true);
		// Values are halved because first scale (Половина, mult=0.5) is applied
		expect(getItemValueText(getSectionItems(block!, 0)[0])).toBe("50");
	});

	it("does not add an implicit 1:1 scale when a user scale already has mult=1", () => {
		const block = render(scaleRecipe);
		const buttons = getScaleButtons(block!);
		expect(buttons.length).toBe(3);
		expect(buttons.some(b => b.textContent?.includes("1:1"))).toBe(false);
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

const roundRecipe = `
unit: г
decimals: 1
scales:
  - name: Половина
    mult: .5
  - name: Треть
    mult: .33
sections:
  - name: 🍖 Фарш
    items:
      - name: Мясной фарш
        value: 1000
      - name: Картошка
        value: 150
        round: 25
      - name: Яйцо
        value: 1
        unit: шт
        round: 1
      - name: Соль
        value: 12
`;

describe("workflow 2b: per-item round", () => {
	it("snaps initial values to nice numbers and stays exact for unrounded items", () => {
		const block = render(roundRecipe);
		const filling = getSectionItems(block!, 0);
		// First scale (Половина, mult=0.5) is applied on initial render
		expect(getItemValueText(filling[0])).toBe("500");  // фарш: 1000 * 0.5
		expect(getItemValueText(filling[1])).toBe("75");   // картошка: 150 * 0.5 = 75, rounded to nearest 25 = 75
		expect(getItemValueText(filling[2])).toBe("1");    // яйцо: 1 * 0.5 = 0.5 → floored to 1
		expect(getItemValueText(filling[3])).toBe("6");    // соль: 12 * 0.5 = 6
	});

	it("rounds картошка to the nearest 25 g when scaling", () => {
		const block = render(roundRecipe);
		getScaleButtons(block!).find(b => b.textContent?.includes("Треть"))!.click();
		const filling = getSectionItems(block!, 0);
		// 150 * 0.33 = 49.5 → nearest 25 = 50
		expect(getItemValueText(filling[1])).toBe("50");
	});

	it("never lets a whole-unit ingredient (яйцо) scale down to 0", () => {
		const block = render(roundRecipe);
		getScaleButtons(block!).find(b => b.textContent?.includes("Треть"))!.click();
		const filling = getSectionItems(block!, 0);
		// 1 * 0.33 = 0.33 → floored to 1 egg, not 0
		expect(getItemValueText(filling[2])).toBe("1");
	});

	it("leaves unrounded ingredients (соль) on plain decimal scaling", () => {
		const block = render(roundRecipe);
		getScaleButtons(block!).find(b => b.textContent?.includes("Половина"))!.click();
		const filling = getSectionItems(block!, 0);
		expect(getItemValueText(filling[3])).toBe(String(round(12 * 0.5, 1))); // 6
	});
});

function getChoiceGroups(block: HTMLElement): HTMLElement[] {
	return Array.from(block.querySelectorAll<HTMLElement>(".kf-choice-group"));
}

function getChoiceButtons(block: HTMLElement, groupIndex = 0): HTMLButtonElement[] {
	const group = getChoiceGroups(block)[groupIndex];
	return group ? Array.from(group.querySelectorAll<HTMLButtonElement>(".kf-choice-block button")) : [];
}

function clickChoice(block: HTMLElement, label: string, groupIndex = 0): HTMLButtonElement {
	const button = getChoiceButtons(block, groupIndex).find(b => b.textContent?.includes(label));
	if (!button) throw new Error(`Choice button not found: ${label}`);
	button.click();
	return button;
}

function visibleVariants(block: HTMLElement, groupIndex = 0): HTMLElement[] {
	const group = getChoiceGroups(block)[groupIndex];
	if (!group) return [];
	return Array.from(group.querySelectorAll<HTMLElement>(".kf-choice-variant"))
		.filter(variant => !variant.classList.contains("kf-hidden"));
}

function variantValue(wrapper: HTMLElement): string {
	return wrapper.querySelector("li b")?.firstElementChild?.textContent ?? "";
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

function getShowAllButton(block: HTMLElement): HTMLButtonElement {
	const button = block.querySelector<HTMLButtonElement>(".kf-toolbar .kf-show-all");
	if (!button) throw new Error("Show-all button not found");
	return button;
}

function getStatus(block: HTMLElement): HTMLElement | null {
	return block.querySelector<HTMLElement>(".kf-toolbar .kf-status");
}

function getChoicePicker(block: HTMLElement, groupIndex = 0): HTMLElement | null {
	return getChoiceGroups(block)[groupIndex]?.querySelector<HTMLElement>(".kf-choice-block") ?? null;
}

function getChoiceTitle(block: HTMLElement, groupIndex = 0): HTMLElement | null {
	return getChoiceGroups(block)[groupIndex]?.querySelector<HTMLElement>("h3") ?? null;
}

function isHidden(el: Element | null): boolean {
	return el != null && el.classList.contains("kf-hidden");
}

const choiceRecipe = `
unit: г
sections:
  - name: 🧂 Основа
    items:
      - name: Соль
        value: 10

  - choice: Начинка
    name: 🍎 Яблоко
    items:
      - name: Яблоки
        value: 500

  - choice: Начинка
    name: 🍒 Вишня
    items:
      - name: Вишня
        value: 400

  - name: 🥣 Финиш
    items:
      - name: Сахар
        value: 20
`;

describe("workflow 3: choice groups", () => {
	it("renders the group heading, one button per variant, and a global eye next to copy", () => {
		const block = render(choiceRecipe);
		expect(block).not.toBeNull();
		expect(getChoiceGroups(block!).length).toBe(1);
		expect(getChoiceTitle(block!)!.textContent).toBe("Начинка");

		const buttons = getChoiceButtons(block!);
		expect(buttons.length).toBe(2);
		expect(buttons[0]!.textContent).toContain("🍎 Яблоко");
		expect(buttons[1]!.textContent).toContain("🍒 Вишня");

		const toolbarButtons = Array.from(block!.querySelectorAll<HTMLButtonElement>(".kf-toolbar button"));
		expect(toolbarButtons.length).toBe(2);
		expect(toolbarButtons[0]!.textContent).toBe("📋");
		expect(toolbarButtons[0]!.getAttribute("aria-label")).toBe("Copy recipe");
		expect(toolbarButtons[1]!.textContent).toBe("");
		expect(toolbarButtons[1]!.getAttribute("data-icon")).toBe("eye");
		expect(toolbarButtons[1]!.getAttribute("aria-label")).toBe("Show all variants");
		expect(toolbarButtons[1]!.classList.contains("kf-show-all")).toBe(true);

		const group = getChoiceGroups(block!)[0]!;
		expect(group.id).not.toBe("");
		expect(toolbarButtons[1]!.getAttribute("aria-controls")).toBe(group.id);
		const variants = Array.from(group.querySelectorAll<HTMLElement>(".kf-choice-variant"));
		expect(variants.every(variant => variant.id !== "")).toBe(true);
		expect(buttons[0]!.getAttribute("aria-controls")).toBe(variants[0]!.id);
		expect(buttons[1]!.getAttribute("aria-controls")).toBe(variants[1]!.id);

		const status = getStatus(block!);
		expect(status).not.toBeNull();
		expect(status!.getAttribute("role")).toBe("status");
		expect(status!.getAttribute("aria-live")).toBe("polite");
		expect(status!.getAttribute("aria-atomic")).toBe("true");
		expect(status!.textContent).toBe("");
	});

	it("keeps non-choice sections around the group and renders them as usual", () => {
		const block = render(choiceRecipe);
		const headings = Array.from(block!.querySelectorAll("h3")).map(h => h.textContent);
		expect(headings).toEqual(["🧂 Основа", "Начинка", "🥣 Финиш"]);
	});

	it("shows only the first variant by default and hides its sub-heading", () => {
		const block = render(choiceRecipe);
		const visible = visibleVariants(block!);
		expect(visible.length).toBe(1);
		expect(visible[0]!.textContent).toContain("Яблоки");
		expect(visible[0]!.textContent).not.toContain("Вишня");
		expect(isHidden(visible[0]!.querySelector("h4"))).toBe(true);
		expect(isHidden(getChoiceTitle(block!))).toBe(false);
		expect(isHidden(getChoicePicker(block!))).toBe(false);
	});

	it("marks the first variant as selected and exposes the state to assistive tech", () => {
		const block = render(choiceRecipe);
		const buttons = getChoiceButtons(block!);
		expect(buttons[0]!.textContent?.startsWith("●")).toBe(true);
		expect(buttons[1]!.textContent?.startsWith("○")).toBe(true);
		expect(buttons[0]!.getAttribute("aria-pressed")).toBe("true");
		expect(buttons[1]!.getAttribute("aria-pressed")).toBe("false");
	});

	it("switches to another variant when its button is clicked", () => {
		const block = render(choiceRecipe);
		clickChoice(block!, "🍒 Вишня");

		expect(getStatus(block!)!.textContent).toBe("Showing variant 🍒 Вишня");
		const visible = visibleVariants(block!);
		expect(visible.length).toBe(1);
		expect(visible[0]!.textContent).toContain("Вишня");
		expect(visible[0]!.textContent).not.toContain("Яблоки");

		const buttons = getChoiceButtons(block!);
		expect(buttons[0]!.textContent?.startsWith("○")).toBe(true);
		expect(buttons[1]!.textContent?.startsWith("●")).toBe(true);
	});

	it("shows every variant with composite h4 headings and removes the switchers", () => {
		const block = render(choiceRecipe);
		getShowAllButton(block!).click();

		expect(getStatus(block!)!.textContent).toBe("Showing all variants");
		const visible = visibleVariants(block!);
		expect(visible.length).toBe(2);
		const headings = visible.map(variant => variant.querySelector("h4"));
		expect(headings.map(h => h?.textContent)).toEqual([
			"Начинка → 🍎 Яблоко",
			"Начинка → 🍒 Вишня",
		]);
		expect(headings.every(h => !isHidden(h))).toBe(true);
		expect(isHidden(getChoiceTitle(block!))).toBe(true);
		expect(isHidden(getChoicePicker(block!))).toBe(true);

		const eye = getShowAllButton(block!);
		expect(eye.getAttribute("data-icon")).toBe("eye-off");
		expect(eye.getAttribute("aria-pressed")).toBe("true");
		expect(eye.getAttribute("aria-label")).toBe("Show one variant per group");
	});

	it("restores the last selected variant when show-all is turned off", () => {
		const block = render(choiceRecipe);
		clickChoice(block!, "🍒 Вишня");

		getShowAllButton(block!).click();
		getShowAllButton(block!).click();

		expect(getStatus(block!)!.textContent).toBe("Showing one variant per group");
		const visible = visibleVariants(block!);
		expect(visible.length).toBe(1);
		expect(visible[0]!.textContent).toContain("Вишня");
		expect(isHidden(visible[0]!.querySelector("h4"))).toBe(true);
		expect(isHidden(getChoiceTitle(block!))).toBe(false);
		expect(isHidden(getChoicePicker(block!))).toBe(false);
		expect(getShowAllButton(block!).getAttribute("data-icon")).toBe("eye");
	});

	it("renders a single-variant group as a plain section with a composite name", async () => {
		const source = `
unit: г
sections:
  - choice: Ягодная база
    name: конфитюрный вариант
    items:
      - name: Смородина
        value: 300
`;
		const block = render(source);

		expect(getChoiceGroups(block!)).toHaveLength(0);
		expect(block!.querySelector(".kf-show-all")).toBeNull();
		const section = block!.querySelector<HTMLElement>(".kf-section");
		expect(section).not.toBeNull();
		expect(section!.querySelector("h3")!.textContent).toBe("Ягодная база → конфитюрный вариант");
		expect(section!.textContent).toContain("Смородина");

		const copied = await copyRecipe(block!);
		expect(copied).toContain("__Ягодная база → конфитюрный вариант__");
	});

	it("collects non-consecutive variants into one group and copies in render order", async () => {
		const source = `
unit: г
sections:
  - choice: Начинка
    name: 🍎 Яблоко
    items:
      - name: Яблоки
        value: 500

  - name: 🥣 Пауза
    items:
      - name: Сахар
        value: 20

  - choice: Начинка
    name: 🍒 Вишня
    items:
      - name: Вишня
        value: 400
`;
		const block = render(source);
		expect(getChoiceGroups(block!).length).toBe(1);
		expect(getChoiceTitle(block!)!.textContent).toBe("Начинка");
		expect(getChoiceButtons(block!).length).toBe(2);

		const pause = Array.from(block!.querySelectorAll<HTMLElement>(".kf-section"))
			.find(section => section.textContent?.includes("🥣 Пауза"))!;
		expect(pause.previousElementSibling?.classList.contains("kf-choice-group")).toBe(true);

		getShowAllButton(block!).click();
		const copied = await copyRecipe(block!);
		expect(copied.indexOf("__Начинка → 🍎 Яблоко__")).toBeLessThan(copied.indexOf("__Начинка → 🍒 Вишня__"));
		expect(copied.indexOf("__Начинка → 🍒 Вишня__")).toBeLessThan(copied.indexOf("__🥣 Пауза__"));
	});

	it("toggles show-all globally across every choice group", () => {
		const source = `
unit: г
sections:
  - choice: Начинка
    name: Яблоко
    items:
      - name: Яблоки
        value: 1
  - choice: Начинка
    name: Вишня
    items:
      - name: Вишня
        value: 2
  - choice: Покрытие
    name: Глазурь
    items:
      - name: Сахар
        value: 3
  - choice: Покрытие
    name: Пудра
    items:
      - name: Пудра
        value: 4
`;
		const block = render(source);
		clickChoice(block!, "Вишня", 0);

		getShowAllButton(block!).click();

		expect(visibleVariants(block!, 0).length).toBe(2);
		expect(visibleVariants(block!, 1).length).toBe(2);
		expect(isHidden(getChoicePicker(block!, 0))).toBe(true);
		expect(isHidden(getChoicePicker(block!, 1))).toBe(true);
		expect(isHidden(getChoiceTitle(block!, 0))).toBe(true);
		expect(isHidden(getChoiceTitle(block!, 1))).toBe(true);

		getShowAllButton(block!).click();

		expect(visibleVariants(block!, 0).length).toBe(1);
		expect(visibleVariants(block!, 1).length).toBe(1);
		expect(visibleVariants(block!, 0)[0]!.textContent).toContain("Вишня");
		expect(visibleVariants(block!, 1)[0]!.textContent).toContain("Глазурь");
	});

	it("copies only the visible variant with its composite name", async () => {
		const block = render(choiceRecipe);
		const copied = await copyRecipe(block!);

		expect(getStatus(block!)!.textContent).toBe("Recipe copied");
		expect(copied).toContain("__🧂 Основа__");
		expect(copied).toContain("__Начинка → 🍎 Яблоко__");
		expect(copied).not.toContain("__Начинка → 🍒 Вишня__");
		expect(copied).toContain("__🥣 Финиш__");
	});

	it("copies every variant with composite names in show-all mode", async () => {
		const block = render(choiceRecipe);
		getShowAllButton(block!).click();
		const copied = await copyRecipe(block!);

		expect(copied).toContain("__Начинка → 🍎 Яблоко__");
		expect(copied).toContain("__Начинка → 🍒 Вишня__");
	});

	it("keeps separate state for each choice group", () => {
		const source = `
unit: г
sections:
  - choice: Начинка
    name: Яблоко
    items:
      - name: Яблоки
        value: 1
  - choice: Начинка
    name: Вишня
    items:
      - name: Вишня
        value: 2
  - name: Пауза
    items:
      - name: Вода
        value: 3
  - choice: Покрытие
    name: Глазурь
    items:
      - name: Сахар
        value: 4
  - choice: Покрытие
    name: Пудра
    items:
      - name: Пудра
        value: 5
`;
		const block = render(source);
		expect(getChoiceGroups(block!).length).toBe(2);
		const groupIds = getChoiceGroups(block!).map(group => group.id);
		expect(new Set(groupIds).size).toBe(groupIds.length);
		expect(getShowAllButton(block!).getAttribute("aria-controls")).toBe(groupIds.join(" "));

		clickChoice(block!, "Вишня", 0);
		expect(visibleVariants(block!, 0)[0]!.textContent).toContain("Вишня");
		expect(visibleVariants(block!, 1)[0]!.textContent).toContain("Глазурь");

		clickChoice(block!, "Пудра", 1);
		expect(visibleVariants(block!, 1)[0]!.textContent).toContain("Пудра");
		expect(visibleVariants(block!, 0)[0]!.textContent).toContain("Вишня");
	});

	it("keeps the selected scale when switching variants", () => {
		const source = `
unit: г
decimals: 1
scales:
  - name: Полный
    mult: 1
  - name: Половина
    mult: .5
sections:
  - name: Тесто
    items:
      - name: Мука
        value: 400
  - choice: Начинка
    name: Орехи
    items:
      - name: Орехи
        value: 80
  - choice: Начинка
    name: Джем
    items:
      - name: Джем
        value: 40
`;
		const block = render(source);
		getScaleButtons(block!).find(b => b.textContent?.includes("Половина"))!.click();

		expect(variantValue(visibleVariants(block!)[0]!)).toBe("40");

		clickChoice(block!, "Джем");
		expect(variantValue(visibleVariants(block!)[0]!)).toBe("20");

		// The scale row still shows the same choice after switching variants.
		const half = getScaleButtons(block!).find(b => b.textContent?.includes("Половина"))!;
		expect(half.textContent?.startsWith("✅")).toBe(true);

		getScaleButtons(block!).find(b => b.textContent?.includes("Полный"))!.click();
		expect(variantValue(visibleVariants(block!)[0]!)).toBe("40");
		clickChoice(block!, "Орехи");
		expect(variantValue(visibleVariants(block!)[0]!)).toBe("80");
	});

	it("recalculates formulas inside hidden variants and keeps values when switching", () => {
		const source = `
unit: г
sections:
  - name: Мясо
    items:
      - name: Свинина
        id: pork
        value: 800
  - choice: Приправа
    name: Солёная
    items:
      - name: Соль
        calc: pork @ 20
  - choice: Приправа
    name: Перчёная
    items:
      - name: Перец
        calc: pork @ 10
`;
		const block = render(source);
		expect(variantValue(visibleVariants(block!)[0]!)).toBe("16");

		const input = block!.querySelector("input")!;
		input.value = "1000";
		input.dispatchEvent(new Event("input"));

		const variants = getChoiceGroups(block!)[0]!.querySelectorAll<HTMLElement>(".kf-choice-variant");
		expect(variantValue(variants[1]!)).toBe("10");

		clickChoice(block!, "Перчёная");
		expect(variantValue(visibleVariants(block!)[0]!)).toBe("10");
		clickChoice(block!, "Солёная");
		expect(variantValue(visibleVariants(block!)[0]!)).toBe("20");
	});

	it("renders a choice field once and does not add a toolbar for blank/absent choices", () => {
		const source = `
unit: г
sections:
  - name: A
    items:
      - name: x
        value: 1
  - name: B
    choice: "   "
    items:
      - name: y
        value: 2
`;
		const block = render(source);
		expect(getChoiceGroups(block!).length).toBe(0);
		expect(block!.querySelector(".kf-show-all")).toBeNull();
		expect(block!.querySelectorAll("h3").length).toBe(2);
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

	it("catches clipboard failures from the copy button and reports them", async () => {
		const block = render(calcRecipe);
		const writeText = vi.spyOn(navigator.clipboard, "writeText")
			.mockRejectedValue(new Error("clipboard blocked"));
		try {
			const copyBtn = block!.querySelector("button");
			expect(copyBtn).not.toBeNull();
			copyBtn!.click();
			// Let the async onClick body resolve so the catch can run.
			await new Promise(resolve => setTimeout(resolve, 0));
			const err = errorEl();
			expect(err).not.toBeNull();
			expect(err!.textContent).toContain("Copy failed: clipboard blocked");
			expect(getStatus(block!)!.textContent).toBe("Copy failed");
		} finally {
			writeText.mockRestore();
		}
	});

	it("catches errors raised during a scale click and reports them with 'Scale failed:'", () => {
		const block = render(scaleRecipe);
		// Break setText on the first value span; applyScale will hit it during the click.
		const valueSpan = block!.querySelector("ol li b > span:first-child") as HTMLElement;
		valueSpan.setText = vi.fn(() => {
			throw new Error("synthetic");
		});

		const half = getScaleButtons(block!).find(b => b.textContent?.includes("Половина"))!;
		half.click();

		const err = errorEl();
		expect(err).not.toBeNull();
		expect(err!.textContent).toContain("Scale failed: synthetic");
	});

	it("catches errors raised by recalc during input change and reports them with 'Formula error:'", () => {
		const block = render(calcRecipe);
		// Break setText on the first calc-binding span; onChange's recalc will hit it.
		const calcSpan = block!.querySelector("ol li b > span:first-child") as HTMLElement;
		calcSpan.setText = vi.fn(() => {
			throw new Error("synthetic");
		});

		const ingredients = getSectionItems(block!, 0);
		const porcInput = ingredients[0]!.querySelector("input")!;
		porcInput.value = "999";
		porcInput.dispatchEvent(new Event("input"));

		const err = errorEl();
		expect(err).not.toBeNull();
		expect(err!.textContent).toContain("Formula error: synthetic");
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

	it("reports duplicate ids and does not render the recipe", () => {
		const source = `
unit: г
sections:
  - name: Sauce
    items:
      - name: Salt
        id: salt
        value: 5
  - name: Dough
    items:
      - name: Salt
        id: salt
        value: 2
`;
		expect(render(source)).toBeNull();
		const err = errorEl();
		expect(err).not.toBeNull();
		expect(err!.textContent).toContain("Duplicate id 'salt'");
		expect(err!.textContent).toContain("'Salt' in 'Sauce'");
		expect(err!.textContent).toContain("'Salt' in 'Dough'");
	});

	it("allows repeated section and item names when the ids are unique", () => {
		const source = `
unit: г
sections:
  - name: Sauce
    items:
      - name: Salt
        id: salt
        value: 5
  - name: Sauce
    items:
      - name: Salt
        id: salt2
        value: 2
`;
		expect(render(source)).not.toBeNull();
		expect(errorEl()).toBeNull();
	});
});
