import {ButtonComponent, MarkdownPostProcessorContext, TextComponent} from 'obsidian';
import YAML from "yaml";
import {Vars} from "./calc";
import {
	applyScale,
	CalcBinding,
	findDuplicateId,
	formatSectionsToMarkdown,
	groupSections,
	MultBinding,
	prefillVars,
	recalcCalcBindings,
	Recipe,
	Scale,
	Section,
} from "./recipe";

const SCALE_PREFIX = "🎚 ️";
const SELECTED_PREFIX = "✅ ";
const ORIGINAL_SCALE_NAME = "💯 1:1";
const CHOICE_SELECTED_PREFIX = "● ";
const CHOICE_PREFIX = "○ ";
const SHOW_ALL_LABEL = "👁 All";
const SHOW_ONE_LABEL = "👁 One";

const HIDDEN_CLASS = "kf-hidden";

function setVisible(el: HTMLElement, visible: boolean): void {
	el.classList.toggle(HIDDEN_CLASS, !visible);
	el.hidden = !visible;
}

function isVisible(el: HTMLElement): boolean {
	return !el.hidden && !el.classList.contains(HIDDEN_CLASS);
}

function reportError(el: HTMLElement, message: string) {
	el.createEl('p', {text: 'Error parsing recipe: ' + message, cls: "kf-error"});
}

export function processKitchenForgeBlock(source: string, el: HTMLElement, _: MarkdownPostProcessorContext): void {
	let recipe: Recipe | null;
	try {
		recipe = YAML.parse(source) as Recipe | null;
	} catch (e) {
		reportError(el, e instanceof Error ? e.message : String(e));
		return;
	}

	if (recipe == null || typeof recipe !== "object") {
		reportError(el, "Recipe must be a YAML mapping");
		return;
	}
	if (!Array.isArray(recipe.sections)) {
		reportError(el, "Recipe must have a 'sections' array");
		return;
	}
	for (const section of recipe.sections) {
		if (!Array.isArray(section.items)) {
			reportError(el, `Section '${section.name}' must have an 'items' array`);
			return;
		}
	}

	const duplicateId = findDuplicateId(recipe);
	if (duplicateId) {
		const describe = (sectionName: string, itemName: string) =>
			sectionName
				? `'${itemName}' in '${sectionName}'`
				: `'${itemName}' in an unnamed section`;
		reportError(
			el,
			`Duplicate id '${duplicateId.id}': ${describe(duplicateId.first.section.name, duplicateId.first.item.name)}` +
			` and ${describe(duplicateId.second.section.name, duplicateId.second.item.name)}`,
		);
		return;
	}

	if (recipe.decimals == null)
		recipe.decimals = 2;
	const decimals = recipe.decimals;
	if (recipe.unit == null)
		recipe.unit = "g";
	const unit = recipe.unit;

	const vars: Vars = {};
	const calcBindings: CalcBinding[] = [];
	const multBindings: MultBinding[] = [];

	const hasIdsOrCalcs = prefillVars(recipe, vars);

	const blockEl = el.createDiv({cls: "kf-block"});

	// Section wrappers let the copy button mirror exactly what is on screen:
	// hidden variants are skipped, visible ones are copied as-is.
	const wrapperBySection = new Map<Section, HTMLElement>();

	const copyCmp = new ButtonComponent(blockEl);
	const copyLabel = "📋";
	copyCmp.setButtonText(copyLabel);
	copyCmp.onClick(async () => {
		try {
			const visibleSections = recipe.sections.filter(section => {
				const wrapper = wrapperBySection.get(section);
				return wrapper == null || isVisible(wrapper);
			});
			await navigator.clipboard.writeText(formatSectionsToMarkdown(visibleSections));

			copyCmp.setButtonText("✅");
			copyCmp.setDisabled(true);

			window.setTimeout(() => {
				copyCmp.setButtonText(copyLabel);
				copyCmp.setDisabled(false);
			}, 1000);
		} catch (e) {
			reportError(el, "Copy failed: " + (e instanceof Error ? e.message : String(e)));
		}
	});

	let initialScaleMult = 1;

	if (recipe.scales) {
		if (hasIdsOrCalcs) {
			reportError(el, "Cannot have scales with ids/formulas specified");
			return;
		}
		// If no user scale has mult=1, append implicit 1:1 scale at the END.
		// The first scale in the final list (first user-defined) becomes the initially selected one.
		const scales = recipe.scales.some(s => s.mult === 1)
			? recipe.scales
			: [...recipe.scales, {name: ORIGINAL_SCALE_NAME, mult: 1}];

		// scales is non-empty because recipe.scales.length > 0
		const initialScale = scales[0];
		initialScaleMult = initialScale!.mult;

		const btnBlockEl = blockEl.createDiv({cls: "kf-scale-block"});
		btnBlockEl.createSpan({text: "📏 "});
		const scaleButtons: {cmp: ButtonComponent; scale: Scale}[] = [];
		for (const scale of scales) {
			const scaleCmp = new ButtonComponent(btnBlockEl);
			const isSelected = scale === initialScale;
			scaleCmp.setButtonText((isSelected ? SELECTED_PREFIX : SCALE_PREFIX) + scale.name);
			scaleButtons.push({cmp: scaleCmp, scale});
			scaleCmp.onClick(async () => {
				try {
					for (const entry of scaleButtons) {
						const prefix = entry.scale === scale ? SELECTED_PREFIX : SCALE_PREFIX;
						entry.cmp.setButtonText(prefix + entry.scale.name);
					}
					scaleCmp.setDisabled(true);

					applyScale(multBindings, scale.mult, decimals);

					window.setTimeout(() => {
						scaleCmp.setDisabled(false);
					}, 1000);
				} catch (e) {
					reportError(el, "Scale failed: " + (e instanceof Error ? e.message : String(e)));
				}
			});
		}
	}

	const renderItems = (section: Section, parent: HTMLElement) => {
		const listEl = parent.createEl('ol');
		for (const item of section.items) {
			const itemEl = listEl.createEl('li');
			itemEl.createSpan({text: `${item.name}: `});
			const bEl = itemEl.createEl('b');

			if (!item.unit)
				item.unit = unit;
			if (item.calc) {
				const valueEl = bEl.createSpan({text: ""});
				calcBindings.push({expr: item.calc, el: valueEl, item: item});
			} else if (!item.id) {
				const valueEl = bEl.createSpan({text: `${(item.value)}`});
				multBindings.push({origValue: item.value ?? 0, el: valueEl, item: item});
			} else {
				const id = item.id;
				const input = new TextComponent(bEl);
				input.inputEl.type = "number";
				input.inputEl.addClass("kf-input");
				input.setValue(`${(item.value)}`);
				input.onChange(value => {
					try {
						const nValue = Number(value);
						vars[id] = nValue;
						item.value = nValue;
						recalcCalcBindings(calcBindings, vars, decimals);
					} catch (e) {
						reportError(el, "Formula error: " + (e instanceof Error ? e.message : String(e)));
					}
				});
			}

			bEl.createSpan({text: ` ${item.unit}`});
		}
	};

	const renderSection = (section: Section) => {
		const hasContentBefore = blockEl.childElementCount > 0;
		const wrapper = blockEl.createDiv({cls: "kf-section"});
		wrapperBySection.set(section, wrapper);

		if (section.name)
			wrapper.createEl('h3', {text: section.name});
		else if (hasContentBefore)
			wrapper.createEl('p', {cls: 'kf-section-gap'});

		renderItems(section, wrapper);
	};

	const renderChoiceGroup = (title: string, variants: Section[]) => {
		const groupEl = blockEl.createDiv({cls: "kf-choice-group"});
		if (title)
			groupEl.createEl('h3', {text: title, cls: "kf-choice-title"});

		const toolbar = groupEl.createDiv({cls: "kf-choice-block"});
		toolbar.setAttribute("role", "group");
		if (title) toolbar.setAttribute("aria-label", title);
		const buttons: {cmp: ButtonComponent; label: string}[] = [];
		const rendered: {wrapper: HTMLElement; heading: HTMLElement}[] = [];
		let activeIndex = 0;
		let showAll = false;
		let allCmp: ButtonComponent | null = null;

		const sync = () => {
			for (let i = 0; i < buttons.length; i++) {
				const entry = buttons[i]!;
				const isActive = i === activeIndex;
				entry.cmp.setButtonText((isActive ? CHOICE_SELECTED_PREFIX : CHOICE_PREFIX) + entry.label);
				entry.cmp.buttonEl.classList.toggle("is-active", isActive);
				entry.cmp.buttonEl.setAttribute("aria-pressed", String(isActive));
				entry.cmp.buttonEl.setAttribute("aria-label", `Show variant ${entry.label}`);
			}

			for (let i = 0; i < rendered.length; i++) {
				const entry = rendered[i]!;
				setVisible(entry.wrapper, showAll || i === activeIndex);
				// In single-variant mode the toolbar already names the variant;
				// the heading is only needed when several variants share the page.
				setVisible(entry.heading, showAll);
			}

			if (allCmp) {
				allCmp.setButtonText(showAll ? SHOW_ONE_LABEL : SHOW_ALL_LABEL);
				allCmp.buttonEl.classList.toggle("is-active", showAll);
				allCmp.buttonEl.setAttribute("aria-pressed", String(showAll));
				allCmp.buttonEl.setAttribute("aria-expanded", String(showAll));
				allCmp.buttonEl.setAttribute("aria-label", showAll ? "Show one variant" : "Show all variants");
			}
		};

		variants.forEach((section, index) => {
			const label = section.name || `Variant ${index + 1}`;
			const wrapper = groupEl.createDiv({cls: "kf-choice-variant"});
			const heading = wrapper.createEl('h4', {text: label, cls: "kf-choice-variant-title"});
			renderItems(section, wrapper);
			wrapperBySection.set(section, wrapper);
			rendered.push({wrapper, heading});

			const cmp = new ButtonComponent(toolbar);
			cmp.buttonEl.classList.add("kf-choice-btn");
			cmp.onClick(() => {
				activeIndex = index;
				showAll = false;
				sync();
			});
			buttons.push({cmp, label});
		});

		allCmp = new ButtonComponent(toolbar);
		allCmp.buttonEl.classList.add("kf-choice-all");
		allCmp.onClick(() => {
			showAll = !showAll;
			sync();
		});

		sync();
	};

	for (const group of groupSections(recipe.sections)) {
		if (group.kind === "section")
			renderSection(group.section);
		else
			renderChoiceGroup(group.title, group.variants);
	}

	// Apply initial scale (first in list) or mult=1 if no scales.
	// This runs after multBindings are populated from section rendering.
	// Hidden variants are scaled too, so switching variants keeps the chosen scale.
	applyScale(multBindings, initialScaleMult, decimals);

	// Evaluate all calc bindings once everything is wired up.
	try {
		recalcCalcBindings(calcBindings, vars, decimals);
	} catch (e) {
		reportError(el, "Formula error: " + (e instanceof Error ? e.message : String(e)));
	}
}
