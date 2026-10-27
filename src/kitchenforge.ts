import {ButtonComponent, MarkdownPostProcessorContext, TextComponent} from 'obsidian';
import YAML from "yaml";
import {Vars} from "./calc";
import {ChoiceGroupView} from "./choice-group";
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
	const groups = groupSections(recipe.sections);
	const hasChoiceGroups = groups.some(group => group.kind === "choice");

	// Section wrappers let the copy button mirror exactly what is on screen:
	// hidden variants are skipped, visible ones are copied as-is.
	const wrapperBySection = new Map<Section, HTMLElement>();

	const toolbarEl = blockEl.createDiv({cls: "kf-toolbar"});
	const statusEl = toolbarEl.createSpan({cls: "kf-status"});
	statusEl.setAttribute("role", "status");
	statusEl.setAttribute("aria-live", "polite");
	statusEl.setAttribute("aria-atomic", "true");
	const announce = (message: string) => {
		statusEl.textContent = message;
	};

	const copyCmp = new ButtonComponent(toolbarEl);
	const copyLabel = "📋";
	copyCmp.setButtonText(copyLabel);
	copyCmp.buttonEl.setAttribute("aria-label", "Copy recipe");
	copyCmp.buttonEl.setAttribute("title", "Copy recipe");
	copyCmp.onClick(async () => {
		try {
			const visibleSections = recipe.sections.filter(section => {
				const wrapper = wrapperBySection.get(section);
				return wrapper == null || isVisible(wrapper);
			});
			await navigator.clipboard.writeText(formatSectionsToMarkdown(visibleSections));

			announce("Recipe copied");
			copyCmp.setButtonText("✅");
			copyCmp.setDisabled(true);

			window.setTimeout(() => {
				copyCmp.setButtonText(copyLabel);
				copyCmp.setDisabled(false);
			}, 1000);
		} catch (e) {
			announce("Copy failed");
			reportError(el, "Copy failed: " + (e instanceof Error ? e.message : String(e)));
		}
	});

	// One global toggle controls every choice group in the recipe.
	const choiceViews: ChoiceGroupView[] = [];
	let showAll = false;
	let showAllCmp: ButtonComponent | null = null;

	const updateShowAllButton = () => {
		if (showAllCmp == null) return;
		const label = showAll ? "Show one variant per group" : "Show all variants";
		showAllCmp.buttonEl.replaceChildren();
		showAllCmp.setIcon(showAll ? "eye-off" : "eye");
		showAllCmp.buttonEl.setAttribute("aria-pressed", String(showAll));
		showAllCmp.buttonEl.setAttribute("aria-expanded", String(showAll));
		showAllCmp.buttonEl.setAttribute("aria-label", label);
		showAllCmp.buttonEl.setAttribute("title", label);
	};

	if (hasChoiceGroups) {
		showAllCmp = new ButtonComponent(toolbarEl);
		showAllCmp.buttonEl.classList.add("kf-show-all");
		showAllCmp.onClick(() => {
			showAll = !showAll;
			for (const view of choiceViews) view.sync(showAll);
			updateShowAllButton();
			announce(showAll ? "Showing all variants" : "Showing one variant per group");
		});
		updateShowAllButton();
	}

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

	const choiceContext = {
		renderItems,
		registerSection: (section: Section, wrapper: HTMLElement) => {
			wrapperBySection.set(section, wrapper);
		},
		setVisible,
		announce,
	};

	for (const group of groups) {
		if (group.kind === "section") {
			renderSection(group.section);
		} else {
			const view = new ChoiceGroupView(blockEl, group.title, group.variants, choiceContext);
			view.sync(showAll);
			choiceViews.push(view);
		}
	}

	if (showAllCmp) {
		showAllCmp.buttonEl.setAttribute(
			"aria-controls",
			choiceViews.map(view => view.element.id).join(" "),
		);
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
