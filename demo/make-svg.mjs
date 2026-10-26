import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const copy = {
	en: {
		title: "kitchenForge — two modes",
		desc: "A calculation block for sausage ratios and a scaling block for a fixed dough recipe.",
		subtitle: "Two kinds of recipes. Two modes.",
		forObsidian: "for Obsidian",
		calcMode: "CALCULATION MODE",
		calcTitle: "Sausage & charcuterie",
		calcDesc: "Change the meat weight — salt and spices follow.",
		formula: "calc: (pork + lard) @ 20",
		raw: "Raw materials",
		pork: "Pork (semi-fatty)",
		lard: "Back fat",
		spices: "Spices and seasonings",
		nitrite: "Nitrite salt (0.6% NaNO₂)",
		pepper: "Ground black pepper",
		nutmeg: "Nutmeg",
		sugar: "Sugar",
		garlic: "Dried garlic",
		calcCallout: "Edit 800 → 1000 g: salt becomes 24 g.",
		scaleMode: "SCALING MODE",
		scaleTitle: "Nut roll & dough",
		scaleDesc: "Pick a scale — every amount is multiplied from the original.",
		full: "Full",
		half: "Half",
		third: "Third",
		dough: "Dough",
		flour: "Flour",
		butter: "Butter",
		eggs: "Egg yolks",
		cream: "Sour cream",
		salt: "Salt",
		filling: "Filling",
		nuts: "Ground nuts",
		powder: "Powdered sugar",
		scaleCallout: "Click Half: 400 → 200 g.",
		footer: "One block = one mode.",
		install: "Available in Obsidian Community Plugins",
		pcs: "pcs",
		g: "g",
	},
	fr: {
		title: "kitchenForge — deux modes",
		desc: "Un bloc de calcul pour les ratios de charcuterie et un bloc de mise à l'échelle pour une recette de pâte fixe.",
		subtitle: "Deux recettes. Deux modes.",
		forObsidian: "pour Obsidian",
		calcMode: "MODE CALCUL",
		calcTitle: "Saucisse & charcuterie",
		calcDesc: "Changez le poids de viande — le sel et les épices suivent.",
		formula: "calc: (porc + lard) @ 20",
		raw: "Matières premières",
		pork: "Porc mi-gras",
		lard: "Lard gras",
		spices: "Épices et aromates",
		nitrite: "Sel nitrité (0,6 % NaNO₂)",
		pepper: "Poivre noir moulu",
		nutmeg: "Noix de muscade",
		sugar: "Sucre",
		garlic: "Ail séché",
		calcCallout: "Passez de 800 à 1000 g : le sel devient 24 g.",
		scaleMode: "MODE MISE À L'ÉCHELLE",
		scaleTitle: "Roulé aux noix & pâte",
		scaleDesc: "Choisissez une échelle — chaque quantité est multipliée depuis l'original.",
		full: "Complet",
		half: "Moitié",
		third: "Tiers",
		dough: "Pâte",
		flour: "Farine",
		butter: "Beurre",
		eggs: "Jaunes d'œufs",
		cream: "Crème fraîche épaisse",
		salt: "Sel",
		filling: "Garniture",
		nuts: "Noix moulues",
		powder: "Sucre glace",
		scaleCallout: "Cliquez sur Moitié : 400 → 200 g.",
		footer: "Un bloc = un mode.",
		install: "Disponible dans les plugins communautaires d'Obsidian",
		pcs: "u",
		g: "g",
	},
};

function escapeXml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function row(label, value, y, xName, xValue) {
	return `
		<text x="${xName}" y="${y}" class="item">${escapeXml(label)}</text>
		<text x="${xValue}" y="${y}" class="value" text-anchor="end">${escapeXml(value)}</text>`;
}

function svg(t) {
	const rows = [
		row(t.nitrite, `20 ${t.g}`, 486, 126, 540),
		row(t.pepper, `1.5 ${t.g}`, 514, 126, 540),
		row(t.nutmeg, `0.5 ${t.g}`, 542, 126, 540),
		row(t.sugar, `1.5 ${t.g}`, 570, 126, 540),
		row(t.garlic, `5 ${t.g}`, 598, 126, 540),
	].join("");

	const scaleRows = [
		row(t.flour, `400 ${t.g}`, 388, 690, 1088),
		row(t.butter, `140 ${t.g}`, 416, 690, 1088),
		row(t.eggs, `2 ${t.pcs}`, 444, 690, 1088),
		row(t.cream, `160 ${t.g}`, 472, 690, 1088),
		row(t.salt, `5 ${t.g}`, 500, 690, 1088),
		row(t.nuts, `80 ${t.g}`, 570, 690, 1088),
		row(t.powder, `40 ${t.g}`, 598, 690, 1088),
	].join("");

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760" role="img" aria-labelledby="title desc" font-family="Segoe UI, -apple-system, BlinkMacSystemFont, Arial, sans-serif">
	<title id="title">${escapeXml(t.title)}</title>
	<desc id="desc">${escapeXml(t.desc)}</desc>

	<defs>
		<radialGradient id="glowPurple" cx="18%" cy="0%" r="75%">
			<stop offset="0" stop-color="#7c3aed" stop-opacity=".24"/>
			<stop offset="1" stop-color="#7c3aed" stop-opacity="0"/>
		</radialGradient>
		<radialGradient id="glowGreen" cx="88%" cy="0%" r="70%">
			<stop offset="0" stop-color="#44cf6e" stop-opacity=".12"/>
			<stop offset="1" stop-color="#44cf6e" stop-opacity="0"/>
		</radialGradient>
		<linearGradient id="logo" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#9b6dff"/>
			<stop offset="1" stop-color="#6d28d9"/>
		</linearGradient>
		<linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#242424"/>
			<stop offset="1" stop-color="#1d1d1d"/>
		</linearGradient>
		<pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
			<circle cx="1" cy="1" r="1" fill="#ffffff" opacity=".035"/>
		</pattern>
	</defs>

	<rect width="1200" height="760" fill="#141414"/>
	<rect width="1200" height="760" fill="url(#glowPurple)"/>
	<rect width="1200" height="760" fill="url(#glowGreen)"/>
	<rect width="1200" height="760" fill="url(#dots)"/>

	<g>
		<rect x="48" y="42" width="46" height="46" rx="13" fill="url(#logo)"/>
		<text x="71" y="72" text-anchor="middle" font-size="17" font-weight="700" fill="#ffffff">KF</text>
		<text x="110" y="69" font-size="31" font-weight="700" letter-spacing="-.8" fill="#f5f5f5">kitchenForge</text>
		<text x="111" y="92" font-size="13.5" fill="#9a9a9a">${escapeXml(t.subtitle)}</text>
		<rect x="1004" y="48" width="148" height="32" rx="16" fill="#a78bfa" fill-opacity=".11" stroke="#a78bfa" stroke-opacity=".28"/>
		<text x="1078" y="69" text-anchor="middle" font-size="12" font-weight="600" fill="#c4b5fd">${escapeXml(t.forObsidian)}</text>
	</g>

	<g>
		<rect x="48" y="142" width="540" height="520" rx="22" fill="url(#card)" stroke="#343434"/>
		<rect x="48" y="142" width="4" height="520" rx="2" fill="#7c3aed"/>
		<text x="80" y="184" font-size="11" font-weight="700" letter-spacing="2.1" fill="#a78bfa">${escapeXml(t.calcMode)}</text>
		<text x="80" y="221" font-size="26" font-weight="700" letter-spacing="-.4" fill="#f2f2f2">${escapeXml(t.calcTitle)}</text>
		<text x="80" y="249" font-size="13.5" fill="#9a9a9a">${escapeXml(t.calcDesc)}</text>

		<rect x="80" y="272" width="476" height="36" rx="9" fill="#181818" stroke="#333333"/>
		<text x="94" y="295" font-family="Cascadia Code, Consolas, monospace" font-size="12.5" fill="#c4b5fd">${escapeXml(t.formula)}</text>

		<rect x="80" y="320" width="476" height="308" rx="14" fill="#1c1c1c" stroke="#333333"/>
		<g fill="none" stroke="#8a8a8a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
			<rect x="96" y="338" width="17" height="21" rx="3"/>
			<rect x="101" y="334" width="7" height="5" rx="1.5" fill="#8a8a8a" stroke="none"/>
			<path d="M101 346h7M101 350h7M101 354h5"/>
		</g>

		<text x="126" y="356" font-size="14" font-weight="600" fill="#ededed">🥩 ${escapeXml(t.raw)}</text>
		<text x="126" y="388" font-size="13.5" fill="#bdbdbd">${escapeXml(t.pork)}:</text>
		<rect x="350" y="371" width="80" height="25" rx="5" fill="#111111" stroke="#4b3b73"/>
		<text x="360" y="388" font-family="Cascadia Code, Consolas, monospace" font-size="12.5" fill="#ffffff">800</text>
		<text x="440" y="388" font-size="13.5" fill="#8f8f8f">${escapeXml(t.g)}</text>

		<text x="126" y="416" font-size="13.5" fill="#bdbdbd">${escapeXml(t.lard)}:</text>
		<rect x="350" y="399" width="80" height="25" rx="5" fill="#111111" stroke="#3d3d3d"/>
		<text x="360" y="416" font-family="Cascadia Code, Consolas, monospace" font-size="12.5" fill="#ffffff">200</text>
		<text x="440" y="416" font-size="13.5" fill="#8f8f8f">${escapeXml(t.g)}</text>

		<text x="126" y="456" font-size="14" font-weight="600" fill="#ededed">🧂 ${escapeXml(t.spices)}</text>
		${rows}

		<text x="80" y="653" font-size="12.5" fill="#a78bfa">${escapeXml(t.calcCallout)}</text>
	</g>

	<g>
		<rect x="612" y="142" width="540" height="520" rx="22" fill="url(#card)" stroke="#343434"/>
		<rect x="612" y="142" width="4" height="520" rx="2" fill="#44cf6e"/>
		<text x="644" y="184" font-size="11" font-weight="700" letter-spacing="2.1" fill="#6ee7a8">${escapeXml(t.scaleMode)}</text>
		<text x="644" y="221" font-size="26" font-weight="700" letter-spacing="-.4" fill="#f2f2f2">${escapeXml(t.scaleTitle)}</text>
		<text x="644" y="249" font-size="13.5" fill="#9a9a9a">${escapeXml(t.scaleDesc)}</text>

		<rect x="644" y="272" width="106" height="33" rx="8" fill="#2d2740" stroke="#5b4b85"/>
		<text x="658" y="293" font-size="12.5" font-weight="600" fill="#f0eaff">✅ ${escapeXml(t.full)}</text>
		<rect x="758" y="272" width="96" height="33" rx="8" fill="#252525" stroke="#3b3b3b"/>
		<text x="772" y="293" font-size="12.5" font-weight="600" fill="#d6d6d6">🎚️ ${escapeXml(t.half)}</text>
		<rect x="862" y="272" width="96" height="33" rx="8" fill="#252525" stroke="#3b3b3b"/>
		<text x="876" y="293" font-size="12.5" font-weight="600" fill="#d6d6d6">🎚️ ${escapeXml(t.third)}</text>

		<rect x="644" y="320" width="476" height="308" rx="14" fill="#1c1c1c" stroke="#333333"/>
		<g fill="none" stroke="#8a8a8a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
			<rect x="660" y="338" width="17" height="21" rx="3"/>
			<rect x="665" y="334" width="7" height="5" rx="1.5" fill="#8a8a8a" stroke="none"/>
			<path d="M665 346h7M665 350h7M665 354h5"/>
		</g>

		<text x="690" y="356" font-size="14" font-weight="600" fill="#ededed">🥣 ${escapeXml(t.dough)}</text>
		${scaleRows}

		<text x="690" y="540" font-size="14" font-weight="600" fill="#ededed">🌰 ${escapeXml(t.filling)}</text>
		<text x="644" y="653" font-size="12.5" fill="#6ee7a8">${escapeXml(t.scaleCallout)}</text>
	</g>

	<g text-anchor="middle">
		<text x="600" y="704" font-size="12.5" fill="#777777">${escapeXml(t.footer)}</text>
		<text x="600" y="726" font-size="12" fill="#666666">${escapeXml(t.install)}</text>
	</g>
</svg>
`;
}

for (const [lang, t] of Object.entries(copy)) {
	const file = lang === "fr" ? "kitchenforge-demo.fr.svg" : "kitchenforge-demo.svg";
	fs.writeFileSync(path.join(root, "assets", file), svg(t));
	console.log("wrote", file);
}
