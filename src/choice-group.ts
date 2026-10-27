import {ButtonComponent} from "obsidian";
import {Section, sectionDisplayName} from "./recipe";

const CHOICE_SELECTED_PREFIX = "● ";
const CHOICE_PREFIX = "○ ";

let nextGroupId = 0;

export type ChoiceGroupContext = {
	renderItems: (section: Section, parent: HTMLElement) => void;
	registerSection: (section: Section, wrapper: HTMLElement) => void;
	setVisible: (el: HTMLElement, visible: boolean) => void;
	announce: (message: string) => void;
};

/**
 * Renders one choice group and owns its local selection state. The global
 * show-all toggle calls `sync()` on every group.
 */
export class ChoiceGroupView {
	readonly element: HTMLElement;
	private readonly titleEl: HTMLElement | null;
	private readonly pickerEl: HTMLElement;
	private readonly buttons: {cmp: ButtonComponent; label: string}[] = [];
	private readonly rendered: {wrapper: HTMLElement; heading: HTMLElement}[] = [];
	private readonly ctx: ChoiceGroupContext;
	private activeIndex = 0;
	private showAll = false;

	constructor(parent: HTMLElement, title: string, variants: Section[], ctx: ChoiceGroupContext) {
		this.ctx = ctx;
		this.element = parent.createDiv({cls: "kf-choice-group"});
		this.element.id = `kf-choice-group-${++nextGroupId}`;

		this.titleEl = title
			? this.element.createEl("h3", {text: title, cls: "kf-choice-title"})
			: null;

		this.pickerEl = this.element.createDiv({cls: "kf-choice-block"});
		this.pickerEl.setAttribute("role", "group");
		if (title) this.pickerEl.setAttribute("aria-label", title);

		variants.forEach((section, index) => {
			const label = (section.name || `Variant ${index + 1}`).trim();
			const wrapper = this.element.createDiv({cls: "kf-choice-variant"});
			const wrapperId = `${this.element.id}-variant-${index + 1}`;
			wrapper.id = wrapperId;
			const heading = wrapper.createEl("h4", {
				text: sectionDisplayName(label, title),
				cls: "kf-choice-variant-title",
			});
			this.ctx.renderItems(section, wrapper);
			this.ctx.registerSection(section, wrapper);
			this.rendered.push({wrapper, heading});

			const cmp = new ButtonComponent(this.pickerEl);
			cmp.buttonEl.classList.add("kf-choice-btn");
			cmp.buttonEl.setAttribute("aria-controls", wrapperId);
			cmp.onClick(() => {
				this.activeIndex = index;
				this.sync(this.showAll);
				this.ctx.announce(`Showing variant ${label}`);
			});
			this.buttons.push({cmp, label});
		});
	}

	sync(showAll: boolean): void {
		this.showAll = showAll;
		if (this.titleEl) this.ctx.setVisible(this.titleEl, !showAll);
		this.ctx.setVisible(this.pickerEl, !showAll);

		for (let i = 0; i < this.buttons.length; i++) {
			const entry = this.buttons[i]!;
			const isActive = i === this.activeIndex;
			entry.cmp.setButtonText((isActive ? CHOICE_SELECTED_PREFIX : CHOICE_PREFIX) + entry.label);
			entry.cmp.buttonEl.classList.toggle("is-active", isActive);
			entry.cmp.buttonEl.setAttribute("aria-pressed", String(isActive));
			entry.cmp.buttonEl.setAttribute("aria-label", `Show variant ${entry.label}`);
		}

		for (let i = 0; i < this.rendered.length; i++) {
			const entry = this.rendered[i]!;
			this.ctx.setVisible(entry.wrapper, showAll || i === this.activeIndex);
			// Show-all drops the group title and switchers, so the composite
			// "Group → Variant" heading carries the context instead.
			this.ctx.setVisible(entry.heading, showAll);
		}
	}
}
