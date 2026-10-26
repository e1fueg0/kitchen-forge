export class ButtonComponent {
	buttonEl: HTMLButtonElement;
	private _onClick: (() => void) | undefined;

	constructor(parent: HTMLElement) {
		this.buttonEl = document.createElement("button");
		parent.appendChild(this.buttonEl);
		this.buttonEl.addEventListener("click", () => {
			if (this._onClick) this._onClick();
		});
	}

	setButtonText(text: string): this {
		this.buttonEl.textContent = text;
		return this;
	}

	setIcon(icon: string): this {
		this.buttonEl.textContent = "";
		this.buttonEl.setAttribute("data-icon", icon);
		return this;
	}

	onClick(cb: () => void): this {
		this._onClick = cb;
		return this;
	}

	setDisabled(disabled: boolean): this {
		this.buttonEl.disabled = disabled;
		return this;
	}
}

export class TextComponent {
	inputEl: HTMLInputElement;
	private _onChange: ((value: string) => void) | undefined;

	constructor(parent: HTMLElement) {
		this.inputEl = document.createElement("input");
		parent.appendChild(this.inputEl);
		this.inputEl.addEventListener("input", () => {
			if (this._onChange) this._onChange(this.inputEl.value);
		});
	}

	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}

	onChange(cb: (value: string) => void): this {
		this._onChange = cb;
		return this;
	}
}

export type MarkdownPostProcessorContext = Record<string, unknown>;
