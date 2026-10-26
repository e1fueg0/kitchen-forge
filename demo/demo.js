const translations = {
	en: {
		crumbRecipes: "Recipes",
		crumbNote: "Weekend prep",
		title: "Weekend prep",
		lede: "Two recipes. Two modes. One plugin.",
		calcKicker: "CALCULATION MODE",
		sausageTitle: "Sausage",
		calcDesc: "Change the meat weight — salt and spices follow.",
		rawMaterials: "Raw materials",
		pork: "Pork (semi-fatty)",
		lard: "Back fat",
		spices: "Spices and seasonings",
		nitrite: "Nitrite salt (0.6% NaNO₂)",
		pepper: "Ground black pepper",
		nutmeg: "Nutmeg",
		sugar: "Sugar",
		garlic: "Dried garlic",
		milk: "Milk powder",
		water: "Iced water",
		scaleKicker: "SCALING MODE",
		doughTitle: "Nut roll",
		scaleDesc: "Pick a scale — every amount is multiplied from the original.",
		full: "Full",
		half: "Half",
		third: "Third",
		doughSection: "Dough",
		flour: "Flour",
		butter: "Butter",
		eggYolks: "Egg yolks",
		sourCream: "Sour cream",
		salt: "Salt",
		filling: "Filling",
		groundNuts: "Ground nuts",
		powderedSugar: "Powdered sugar",
		pcs: " pcs",
		footerOne: "One block = one mode.",
		footerTwo: "Available in Obsidian Community Plugins",
		copyTitle: "Copy as Markdown",
	},
	fr: {
		crumbRecipes: "Recettes",
		crumbNote: "Préparation du week-end",
		title: "Préparation du week-end",
		lede: "Deux recettes. Deux modes. Un plugin.",
		calcKicker: "MODE CALCUL",
		sausageTitle: "Saucisse",
		calcDesc: "Changez le poids de viande — le sel et les épices suivent.",
		rawMaterials: "Matières premières",
		pork: "Porc mi-gras",
		lard: "Lard gras",
		spices: "Épices et aromates",
		nitrite: "Sel nitrité (0,6 % NaNO₂)",
		pepper: "Poivre noir moulu",
		nutmeg: "Noix de muscade",
		sugar: "Sucre",
		garlic: "Ail séché",
		milk: "Lait en poudre",
		water: "Eau glacée",
		scaleKicker: "MODE MISE À L'ÉCHELLE",
		doughTitle: "Roulé aux noix",
		scaleDesc: "Choisissez une échelle — chaque quantité est multipliée depuis l'original.",
		full: "Complet",
		half: "Moitié",
		third: "Tiers",
		doughSection: "Pâte",
		flour: "Farine",
		butter: "Beurre",
		eggYolks: "Jaunes d'œufs",
		sourCream: "Crème fraîche épaisse",
		salt: "Sel",
		filling: "Garniture",
		groundNuts: "Noix moulues",
		powderedSugar: "Sucre glace",
		pcs: " u",
		footerOne: "Un bloc = un mode.",
		footerTwo: "Disponible dans les plugins communautaires d'Obsidian",
		copyTitle: "Copier en Markdown",
	},
};

const lang = new URLSearchParams(window.location.search).get("lang") === "fr" ? "fr" : "en";
const t = translations[lang];

function applyLanguage() {
	document.documentElement.lang = lang;
	document.title = lang === "fr" ? "Aperçu kitchenForge" : "kitchenForge preview";

	for (const el of document.querySelectorAll("[data-i18n]")) {
		const key = el.dataset.i18n;
		if (key && t[key] != null) el.textContent = t[key];
	}

	for (const el of document.querySelectorAll("[data-i18n-title]")) {
		const key = el.dataset.i18nTitle;
		if (key && t[key] != null) el.title = t[key];
	}
}

function format(value, decimals = 2) {
	const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
	return String(rounded);
}

const calcInputs = Array.from(document.querySelectorAll("[data-var]"));
const calcValues = new Map(
	Array.from(document.querySelectorAll("[data-calc]")).map(el => [el.dataset.calc, el]),
);

function recalculate() {
	const pork = Number(document.querySelector('[data-var="pork"]').value) || 0;
	const lard = Number(document.querySelector('[data-var="lard"]').value) || 0;
	const total = pork + lard;

	const next = {
		salt: total * 20 / 1000,
		pepper: total * 1.5 / 1000,
		nutmeg: total * 0.5 / 1000,
		sugar: total * 1.5 / 1000,
		garlic: total * 5 / 1000,
		milk: total * 5 / 1000,
		water: pork * 15 / 1000,
	};

	for (const [key, value] of Object.entries(next)) {
		const el = calcValues.get(key);
		if (el) el.textContent = format(value);
	}
}

for (const input of calcInputs) {
	input.addEventListener("input", recalculate);
}

const scaleButtons = Array.from(document.querySelectorAll(".scale-btn"));
const scaleValues = new Map(
	Array.from(document.querySelectorAll("[data-scale]")).map(el => [el.dataset.scale, Number(el.textContent)]),
);

function applyScale(mult) {
	for (const [key, original] of scaleValues) {
		const el = document.querySelector(`[data-scale="${key}"]`);
		if (el) el.textContent = format(original * mult, 1);
	}
}

for (const button of scaleButtons) {
	button.addEventListener("click", () => {
		for (const other of scaleButtons) {
			const selected = other === button;
			other.classList.toggle("is-selected", selected);
			other.querySelector(".prefix").textContent = selected ? "✅" : "🎚️";
		}
		applyScale(Number(button.dataset.mult));
	});
}

function blockToMarkdown(block) {
	const lines = [];
	for (const child of block.children) {
		if (child.matches("h3")) {
			lines.push(`__${child.textContent.trim()}__`, "");
		} else if (child.matches("ol")) {
			let index = 1;
			for (const item of child.children) {
				const clone = item.cloneNode(true);
				for (const input of clone.querySelectorAll("input")) {
					input.replaceWith(document.createTextNode(input.value));
				}
				lines.push(` ${index++}. ${clone.textContent.trim()}`);
			}
			lines.push("");
		}
	}
	return lines.join("\n").trim();
}

for (const button of document.querySelectorAll(".copy-btn")) {
	button.addEventListener("click", async () => {
		const block = button.closest(".kf-block");
		if (!block) return;
		try {
			await navigator.clipboard.writeText(blockToMarkdown(block));
			button.textContent = "✅";
			window.setTimeout(() => {
				button.textContent = "📋";
			}, 1000);
		} catch {
			// Clipboard access is not available in every preview context.
		}
	});
}

applyLanguage();
recalculate();
