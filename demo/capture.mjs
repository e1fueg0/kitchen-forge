import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

const require = createRequire(import.meta.url);
const GIFEncoder = require("gif-encoder-2");
const {PNG} = require("pngjs");

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const assets = path.join(root, "assets");
const framesDir = path.join(here, ".frames");
const demoUrl = "file:///" + path.join(here, "demo.html").replaceAll("\\", "/");

fs.mkdirSync(assets, {recursive: true});
fs.mkdirSync(framesDir, {recursive: true});

async function shot(page, file) {
	await page.evaluate(() => document.fonts.ready);
	await page.locator("#note").screenshot({path: path.join(assets, file)});
	console.log("wrote", file);
}

async function makeStills(browser) {
	const page = await browser.newPage({
		viewport: {width: 1100, height: 1500},
		deviceScaleFactor: 2,
	});

	for (const [lang, file] of [
		["en", "kitchenforge-demo.png"],
		["fr", "kitchenforge-demo.fr.png"],
	]) {
		await page.goto(`${demoUrl}?lang=${lang}`);
		await page.locator("#calc-section input").first().focus();
		await shot(page, file);
	}

	await page.close();
}

async function makeGif(browser, lang, file) {
	const page = await browser.newPage({
		viewport: {width: 1100, height: 1500},
		deviceScaleFactor: 1,
	});

	await page.goto(`${demoUrl}?lang=${lang}`);
	await page.evaluate(() => document.fonts.ready);

	await page.addStyleTag({
		content: `
			#kf-cursor {
				position: fixed;
				z-index: 9999;
				width: 22px;
				height: 26px;
				pointer-events: none;
				filter: drop-shadow(0 2px 2px rgba(0, 0, 0, .55));
			}
		`,
	});

	await page.evaluate(() => {
		const cursor = document.createElement("div");
		cursor.id = "kf-cursor";
		cursor.innerHTML = `
			<svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true">
				<path d="M2 2 L2 21 L7.2 16.2 L10.8 24 L14.6 22.2 L11 14.8 L18 14.8 Z"
					fill="#ffffff" stroke="#111111" stroke-width="1.7" stroke-linejoin="round"/>
			</svg>
		`;
		document.body.appendChild(cursor);
	});

	const input = page.locator("#calc-section input").first();
	await input.focus();
	await input.selectText();

	const inputBox = await input.boundingBox();
	if (inputBox) {
		await page.evaluate(({x, y}) => {
			const cursor = document.getElementById("kf-cursor");
			if (cursor) {
				cursor.style.left = `${x}px`;
				cursor.style.top = `${y}px`;
			}
		}, {x: inputBox.x + inputBox.width - 8, y: inputBox.y + 7});
	}

	const sectionBox = await page.locator("#calc-section").boundingBox();
	if (!sectionBox) throw new Error("Calculation section not found");

	const clip = {
		x: Math.floor(sectionBox.x),
		y: Math.floor(sectionBox.y),
		width: Math.ceil(sectionBox.width),
		height: Math.ceil(sectionBox.height),
	};

	await page.waitForTimeout(250);
	await page.screenshot({path: path.join(framesDir, "frame-01.png"), clip});

	await page.keyboard.type("1000", {delay: 90});
	await page.waitForTimeout(450);
	await page.screenshot({path: path.join(framesDir, "frame-04.png"), clip});

	await page.close();

	const first = PNG.sync.read(fs.readFileSync(path.join(framesDir, "frame-01.png")));
	const encoder = new GIFEncoder(first.width, first.height);
	encoder.setRepeat(0);
	encoder.setQuality(10);
	encoder.start();

	for (const [file, delay] of [
		["frame-01.png", 1600],
		["frame-04.png", 2400],
	]) {
		const frame = PNG.sync.read(fs.readFileSync(path.join(framesDir, file)));
		encoder.setDelay(delay);
		encoder.addFrame(frame.data);
	}

	encoder.finish();
	fs.writeFileSync(path.join(assets, file), encoder.out.getData());
	console.log("wrote", file);
}

const browser = await chromium.launch();
try {
	await makeStills(browser);
	await makeGif(browser, "en", "kitchenforge-demo.gif");
	await makeGif(browser, "fr", "kitchenforge-demo.fr.gif");
} finally {
	await browser.close();
	if (process.env.KEEP_FRAMES !== "1") {
		fs.rmSync(framesDir, {recursive: true, force: true});
	}
}
