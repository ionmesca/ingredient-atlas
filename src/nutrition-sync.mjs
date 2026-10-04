#!/usr/bin/env node
// Nutrition-only maintenance. No image, HTTP, build, or publication operations.
import { createHash } from "node:crypto";
import {
	readFileSync,
	existsSync,
	writeFileSync,
	renameSync,
	mkdirSync,
	openSync,
	closeSync,
	rmSync,
	lstatSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {acquireExportMaintenance} from "./export-maintenance-lock.mjs";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const canonical = (v) =>
	Array.isArray(v)
		? `[${v.map(canonical).join(",")}]`
		: v && typeof v === "object"
			? `{${Object.keys(v)
					.sort()
					.map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
					.join(",")}}`
			: JSON.stringify(v);
export const hash = (v) =>
	`sha256:${createHash("sha256").update(canonical(v)).digest("hex")}`;
const same = (a, b) => canonical(a ?? null) === canonical(b ?? null);
export const foods = {
	butter: [
		173410,
		"Butter, salted",
		51.368,
		"Salted butter, as represented by FDC173410; not unsalted butter.",
	],
	chickpea: [
		173756,
		"Chickpeas (garbanzo beans, bengal gram), mature seeds, raw",
		0.603,
		"Dry mature raw chickpea seeds, FDC173756; not cooked or canned chickpeas.",
	],
	"coconut-milk": [
		170172,
		"Nuts, coconut milk, raw (liquid expressed from grated meat and water)",
		21.14,
		"Raw liquid expressed from grated coconut meat and water, FDC170172; not a generic canned or drinking product.",
	],
};
const PUBLIC_ORIGIN = {
	kind: "dataset",
	description:
		"Existing seven fields from USDA SR Legacy; saturated fat supplements the same assigned food.",
};
const PUBLIC_REASON =
	"Nutrient 1258, total saturated fatty acids, grams per 100 g of this exact mapped food; published USDA table value.";
const keys = [
	"calories",
	"proteinG",
	"fatG",
	"carbsG",
	"fiberG",
	"sodiumMg",
	"sugarG",
];
export function bindingHash(target, binding, values = binding.baseline.values) {
	return hash({
		target,
		id: binding.id,
		nutritionPath: binding.nutritionPath,
		baseline: { ingredient: binding.baseline.ingredient, values },
	});
}
export function validateIntent(c) {
	const f = foods[c.ingredient?.slug];
	const { review, changeId, ...intent } = c;
	if (
		!f ||
		c.ingredient.description !== f[1] ||
		c.ingredient.state !== f[3] ||
		c.ingredient.unit !== "per100g-edible" ||
		c.schemaVersion !== 1 ||
		c.decision !== "enrich" ||
		!same(Object.keys(c.proposed), ["saturatedFatG"]) ||
		c.proposed.saturatedFatG.value !== f[2]
	)
		throw Error("Unsupported exact food/state/nutrient intent");
	if (
		changeId !== hash(intent) ||
		c.baseline.hash !==
			hash({ ingredient: c.ingredient, values: c.baseline.values })
	)
		throw Error("Immutable intent/baseline hash mismatch");
	if (
		![c.recordedAt, review?.reviewedAt].every(
			(d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)),
		) ||
		review?.status !== "accepted" ||
		!review.reviewerId?.trim() ||
		review.reviewerId === c.writerId ||
		review.changeId !== changeId ||
		review.reviewedAt < c.recordedAt ||
		!review.notes?.trim()
	)
		throw Error("Independent accepted review of exact intent required");
	if (
		c.validation?.status !== "supported" ||
		c.validation.identityMatched !== true ||
		c.validation.unitsMatched !== true ||
		c.origin?.kind !== "dataset"
	)
		throw Error("Unsupported evidence/identity");
	for (const target of ["buna", "atlas"]) {
		const b = c.targets?.[target];
		if (
			!b ||
			!same(b.baseline.ingredient, c.ingredient) ||
			!same(b.baseline.values, c.baseline.values) ||
			b.expectedOldHash !== bindingHash(target, b) ||
			b.nutritionPath !==
				(target === "atlas"
					? "/metadata/nutritionPer100g"
					: "/nutritionPer100g")
		)
			throw Error("Exact dual target binding required");
	}
	if (c.targets.atlas.id !== `ia_${c.ingredient.slug}` || !c.targets.buna.id)
		throw Error("Stable target ID missing");
	if (
		!same(Object.keys(c.baseline.values).sort(), [...keys].sort()) ||
		Object.values(c.baseline.values).some(
			(v) => !Number.isFinite(v) || v < 0,
		) ||
		f[2] > c.baseline.values.fatG
	)
		throw Error("Expected seven fields and absent saturated fat required");
	const ids = c.proposed.saturatedFatG.evidenceIds;
	if (
		!ids?.length ||
		new Set(c.evidence.map((e) => e.id)).size !== c.evidence.length
	)
		throw Error("Missing/duplicate evidence");
	for (const id of ids) {
		const e = c.evidence.find((e) => e.id === id);
		if (
			!e ||
			e.foodId !== String(f[0]) ||
			e.dataset !== "USDA FoodData Central SR Legacy" ||
			e.version !== "2018-04" ||
			e.snapshotHash !==
				"sha256:b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0" ||
			e.url !==
				"https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip" ||
			e.sourcePath
		)
			throw Error("Exact public USDA evidence required");
	}
	return f;
}
export function fieldEvidence(c) {
	return {
		saturatedFatG: {
			changeId: c.changeId,
			value: c.proposed.saturatedFatG.value,
			food: c.ingredient,
			origin: PUBLIC_ORIGIN,
			evidence: c.evidence
				.filter((e) => c.proposed.saturatedFatG.evidenceIds.includes(e.id))
				.map((e) => ({
					id: e.id,
					dataset: e.dataset,
					version: e.version,
					foodId: e.foodId,
					url: e.url,
					snapshotHash: e.snapshotHash,
					observedAt: e.observedAt,
					reason: PUBLIC_REASON,
				})),
			review: {
				status: c.review.status,
				reviewerId: c.review.reviewerId,
				reviewedAt: c.review.reviewedAt,
				changeId: c.changeId,
			},
		},
	};
}
export function canonicalOverride(change) {
	validateIntent(change);
	const body = {
		changeId: change.changeId,
		ingredient: change.ingredient,
		binding: change.targets.atlas,
		proposed: change.proposed.saturatedFatG.value,
		fieldEvidence: fieldEvidence(change),
	};
	return { ...body, overrideHash: hash(body) };
}
export function validateOverride(override) {
	const { overrideHash, ...body } = override,
		f = foods[override.ingredient?.slug],
		b = override.binding;
	if (
		!f ||
		overrideHash !== hash(body) ||
		override.ingredient.description !== f[1] ||
		override.ingredient.state !== f[3] ||
		override.ingredient.unit !== "per100g-edible" ||
		override.proposed !== f[2] ||
		b.id !== `ia_${override.ingredient.slug}` ||
		b.nutritionPath !== "/metadata/nutritionPer100g" ||
		!same(b.baseline.ingredient, override.ingredient) ||
		b.expectedOldHash !== bindingHash("atlas", b) ||
		!same(Object.keys(b.baseline.values).sort(), [...keys].sort()) ||
		Object.values(b.baseline.values).some((v) => !Number.isFinite(v) || v < 0)
	)
		throw Error("Canonical nutrition source identity/hash mismatch");
	const e = override.fieldEvidence?.saturatedFatG;
	if (
		!e ||
		e.changeId !== override.changeId ||
		e.value !== f[2] ||
		!same(e.food, override.ingredient) ||
		e.review?.status !== "accepted" ||
		e.review.changeId !== override.changeId ||
		!e.review.reviewerId ||
		!e.review.reviewedAt ||
		e.review.notes ||
		!e.evidence?.length ||
		e.evidence.some(
			(row) =>
				row.foodId !== String(f[0]) ||
				row.url !==
					"https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip" ||
				row.sourcePath ||
				row.snapshotHash !==
					"sha256:b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0",
		)
	)
		throw Error("Canonical source review/evidence mismatch");
	const allowed = (value, list) => same(Object.keys(value).sort(), list.sort());
	if (
		!allowed(override.ingredient, ["slug", "description", "state", "unit"]) ||
		!allowed(b, ["id", "nutritionPath", "baseline", "expectedOldHash"]) ||
		!allowed(b.baseline, ["ingredient", "values"]) ||
		!allowed(override.fieldEvidence, ["saturatedFatG"]) ||
		!allowed(e, [
			"changeId",
			"value",
			"food",
			"origin",
			"evidence",
			"review",
		]) ||
		!same(e.origin, PUBLIC_ORIGIN) ||
		!allowed(e.review, ["status", "reviewerId", "reviewedAt", "changeId"]) ||
		(!/^\/root(?:\/[a-z0-9_]+)?$/.test(e.review.reviewerId) &&
			!e.review.reviewerId.startsWith("fixture-") &&
			!e.review.reviewerId.startsWith("TEST-ONLY-")) ||
		e.evidence.length !== 1 ||
		e.evidence.some(
			(row) =>
				!allowed(row, [
					"id",
					"dataset",
					"version",
					"foodId",
					"url",
					"snapshotHash",
					"observedAt",
					"reason",
				]) ||
				row.id !== `fdc-${f[0]}-sr2018` ||
				row.dataset !== "USDA FoodData Central SR Legacy" ||
				row.version !== "2018-04" ||
				row.reason !== PUBLIC_REASON,
		)
	)
		throw Error("Unexpected or private canonical provenance fields");
	// Exact projection is the public source; operational targets and private notes never belong here.
	if (
		!same(
			Object.keys(override).sort(),
			[
				"changeId",
				"ingredient",
				"binding",
				"proposed",
				"fieldEvidence",
				"overrideHash",
			].sort(),
		)
	)
		throw Error("Unexpected canonical source keys");
	return f;
}
export function loadOverrides(root = ROOT) {
	const privateReceipts = loadReceipts(root);
	if (privateReceipts.some((r) => ["applying", "undoing"].includes(r.status)))
		throw Error("Resume interrupted nutrition transaction before rebuilding");
	const path = join(root, "nutrition/overrides.json"),
		overrides = existsSync(path)
			? JSON.parse(readFileSync(path, "utf8")).overrides
			: [];
	if (
		!Array.isArray(overrides) ||
		new Set(overrides.map((o) => o.ingredient.slug)).size !== overrides.length
	)
		throw Error("Conflicting canonical nutrition overrides");
	overrides.forEach(validateOverride);
	return overrides;
}
export function overlayRecord(record, overrides) {
	for (const input of overrides) {
		if (input.status && input.status !== "applied") continue;
		const o = input.change ? canonicalOverride(input.change) : input;
		if (o.ingredient.slug !== record.slug) continue;
		const f = validateOverride(o),
			m = record.metadata,
			before = o.binding.baseline.values,
			after = { ...before, saturatedFatG: o.proposed };
		if (
			record.id !== o.binding.id ||
			m?.usdaFdcId !== f[0] ||
			m.nutritionSource !== "usda"
		)
			throw Error("Durable nutrition overlay identity/origin conflict");
		if (!same(m.nutritionPer100g, before) && !same(m.nutritionPer100g, after))
			throw Error("Durable nutrition overlay baseline conflict");
		if (
			m.nutritionFieldEvidence &&
			!same(m.nutritionFieldEvidence, o.fieldEvidence)
		)
			throw Error("Durable nutrition overlay evidence conflict");
		m.nutritionPer100g = after;
		m.nutritionFieldEvidence = o.fieldEvidence;
	}
	return record;
}
export function loadReceipts(root = ROOT) {
	const p = join(root, "nutrition/receipts.private.json");
	const rows = existsSync(p)
		? JSON.parse(readFileSync(p, "utf8")).receipts
		: [];
	if (
		!Array.isArray(rows) ||
		new Set(rows.map((r) => r.change.changeId)).size !== rows.length ||
		new Set(
			rows
				.filter((r) => r.status !== "undone")
				.map((r) => r.change.ingredient.slug),
		).size !== rows.filter((r) => r.status !== "undone").length
	)
		throw Error("Conflicting durable nutrition receipts");
	for (const r of rows) {
		validateIntent(r.change);
		if (!["applying", "applied", "undoing", "undone"].includes(r.status))
			throw Error("Unknown receipt state");
	}
	return rows;
}
function atomic(path, value) {
	const temp = `${path}.tmp-${process.pid}`;
	try {
		writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
		renameSync(temp, path);
	} finally {
		rmSync(temp, { force: true });
	}
}
function acquireLock(lock) {
	const claim = () => {
		const fd = openSync(lock, "wx");
		writeFileSync(fd, JSON.stringify({ pid: process.pid }));
		return fd;
	};
	try {
		return claim();
	} catch (error) {
		if (error.code !== "EEXIST") throw error;
	}
	// Serialize recovery so two callers cannot remove each other's newly claimed lock.
	const recovery = lock + ".recovery";
	let recoveryFd;
	try {
		recoveryFd = openSync(recovery, "wx");
		const raw = readFileSync(lock, "utf8");
		let owner;
		try {
			owner = JSON.parse(raw);
		} catch {
			throw Error("Unknown nutrition lock owner; inspect before recovery");
		}
		if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0)
			throw Error("Invalid nutrition lock owner; inspect before recovery");
		let dead = false;
		try {
			process.kill(owner.pid, 0);
		} catch (error) {
			if (error.code === "ESRCH") dead = true;
			else throw error;
		}
		if (!dead) throw Error("Nutrition sync is locked by a live process");
		if (readFileSync(lock, "utf8") !== raw)
			throw Error("Nutrition lock changed during recovery");
		rmSync(lock);
		return claim();
	} finally {
		if (recoveryFd !== undefined) {
			closeSync(recoveryFd);
			rmSync(recovery, { force: true });
		}
	}
}
function syncNutritionOwned({
	root = ROOT,
	change,
	mode = "apply",
	write = false,
	expectedResultHash,
}) {
	const f = validateIntent(change);
	if (!["apply", "undo", "readback"].includes(mode))
		throw Error("Unknown nutrition operation");
	root = resolve(root);
	for (const part of [
		"nutrition",
		"dataset",
		"public-dataset",
		"nutrition/overrides.json",
		"nutrition/receipts.private.json",
		"nutrition/sync.lock",
		"nutrition/sync.lock.recovery",
		"dataset/manifest.json",
		"public-dataset/manifest.json",
	])
		if (
			existsSync(join(root, part)) &&
			lstatSync(join(root, part)).isSymbolicLink()
		)
			throw Error("Symlink target refused");
	mkdirSync(join(root, "nutrition"), { recursive: true });
	const lock = join(root, "nutrition/sync.lock");
	let fd;
	try {
		fd = acquireLock(lock);
		const receipts = loadReceipts(root),
			prior = receipts.find((r) => r.change.changeId === change.changeId);
		if (
			receipts.some(
				(r) =>
					r.change.changeId !== change.changeId &&
					["applying", "undoing"].includes(r.status),
			)
		)
			throw Error("Interrupted transaction must be resumed first");
		if (prior && !same(prior.change, change))
			throw Error("Changed reviewed intent");
		if (
			receipts.some(
				(r) =>
					r.change.ingredient.slug === change.ingredient.slug &&
					r !== prior &&
					r.status !== "undone",
			)
		)
			throw Error("Food already has another receipt");
		const before = change.baseline.values,
			after = { ...before, saturatedFatG: f[2] },
			evidence = fieldEvidence(change);
		const appliedHash = bindingHash("atlas", change.targets.atlas, after);
		if (mode === "undo" && (!prior || expectedResultHash !== appliedHash))
			throw Error("Undo requires receipt and exact result hash");
		if (
			mode === "apply" &&
			prior &&
			["undoing", "undone"].includes(prior.status)
		)
			throw Error("Undone intent cannot be reapplied; capture a new intent");
		const canonicalPath = join(root, "nutrition/overrides.json");
		const canonicalRows = existsSync(canonicalPath)
			? JSON.parse(readFileSync(canonicalPath, "utf8")).overrides
			: [];
		canonicalRows.forEach(validateOverride);
		const canonicalExisting = canonicalRows.find(
			(o) => o.ingredient.slug === change.ingredient.slug,
		);
		if (
			canonicalExisting &&
			(!prior || !same(canonicalExisting, canonicalOverride(change)))
		)
			throw Error("Canonical source CAS conflict");
		if (prior?.status === "applied" && !canonicalExisting)
			throw Error("Applied canonical source was removed; review required");
		const paths = ["dataset/manifest.json", "public-dataset/manifest.json"];
		const rawDocs = paths.map((p) => readFileSync(join(root, p), "utf8"));
		const docs = rawDocs.map(JSON.parse);
		const records = docs.map((d) =>
			d.records.filter((r) => r.id === change.targets.atlas.id),
		);
		if (records.some((rs) => rs.length !== 1))
			throw Error("Exact unique Atlas record required in both manifests");
		const states = records.map((rs) => {
			const r = rs[0],
				m = r.metadata;
			if (
				r.slug !== change.ingredient.slug ||
				m.usdaFdcId !== f[0] ||
				m.nutritionSource !== "usda"
			)
				throw Error("Atlas identity/origin mismatch; manual values preserved");
			if (same(m.nutritionPer100g, before) && !m.nutritionFieldEvidence)
				return "before";
			if (
				same(m.nutritionPer100g, after) &&
				same(m.nutritionFieldEvidence, evidence)
			)
				return "after";
			throw Error("Atlas compare-and-set nutrition/provenance conflict");
		});
		if (mode === "readback")
			return {
				changeId: change.changeId,
				status: prior?.status ?? "unapplied",
				states,
				values: records.map((rs) => rs[0].metadata.nutritionPer100g),
				resultHash: appliedHash,
			};
		if (!prior && states.some((s) => s !== "before"))
			throw Error("Unreceipted after state refused");
		if (
			prior?.status === "applied" &&
			mode === "apply" &&
			states.some((s) => s !== "after")
		)
			throw Error("Replay conflict");
		if (prior?.status === "undone" && states.some((s) => s !== "before"))
			throw Error("Repeated undo conflict");
		const finalState = mode === "apply" ? "after" : "before";
		const status = states.every((s) => s === finalState)
			? `already-${mode === "apply" ? "applied" : "undone"}`
			: write
				? mode === "apply"
					? "applied"
					: "undone"
				: mode === "apply"
					? "ready"
					: "undo-ready";
		if (
			write &&
			(!status.startsWith("already") ||
				["applying", "undoing"].includes(prior?.status))
		) {
			const receipt = prior ?? { change, status: "applying" };
			if (!prior) receipts.push(receipt);
			receipt.status = mode === "apply" ? "applying" : "undoing";
			atomic(join(root, "nutrition/receipts.private.json"), {
				schemaVersion: 1,
				receipts,
			});
			docs.forEach((doc, i) => {
				if (states[i] !== finalState) {
					const m = records[i][0].metadata;
					m.nutritionPer100g = mode === "apply" ? after : before;
					if (mode === "apply") m.nutritionFieldEvidence = evidence;
					else delete m.nutritionFieldEvidence;
					if (readFileSync(join(root, paths[i]), "utf8") !== rawDocs[i])
						throw Error(
							"Concurrent manifest file change; resume only after review",
						);
					atomic(join(root, paths[i]), doc);
				}
			});
			const canonicalPath = join(root, "nutrition/overrides.json");
			const canonicalRows = existsSync(canonicalPath)
				? JSON.parse(readFileSync(canonicalPath, "utf8")).overrides
				: [];
			canonicalRows.forEach(validateOverride);
			const existing = canonicalRows.find(
				(o) => o.ingredient.slug === change.ingredient.slug,
			);
			if (existing && !same(existing, canonicalOverride(change)))
				throw Error(
					"Canonical source CAS conflict; preserve source and resume after review",
				);
			const next = canonicalRows.filter(
				(o) => o.ingredient.slug !== change.ingredient.slug,
			);
			if (mode === "apply") next.push(canonicalOverride(change));
			atomic(canonicalPath, { schemaVersion: 1, overrides: next });
			receipt.status = mode === "apply" ? "applied" : "undone";
			atomic(join(root, "nutrition/receipts.private.json"), {
				schemaVersion: 1,
				receipts,
			});
		}
		return {
			changeId: change.changeId,
			status,
			resultHash:
				mode === "apply" ? appliedHash : change.targets.atlas.expectedOldHash,
			values: mode === "apply" ? after : before,
		};
	} finally {
		if (fd !== undefined) {
			closeSync(fd);
			rmSync(lock, { force: true });
		}
	}
}
export function syncNutrition(options){const release=acquireExportMaintenance(options.root??ROOT,'nutrition');try{return syncNutritionOwned(options);}finally{release();}}
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const args = process.argv.slice(2),
		opt = (k) => args[args.indexOf(k) + 1];
	if (!args.includes("--journal") || !args.includes("--change"))
		throw Error(
			"Usage: nutrition-sync.mjs --journal <file> --change <id> [--mode apply|undo|readback] [--write] [--result-hash sha256:...]",
		);
	const rows = readFileSync(opt("--journal"), "utf8")
			.trim()
			.split("\n")
			.map(JSON.parse),
		change = rows.find((c) => c.changeId === opt("--change"));
	if (!change) throw Error("Journal change not found");
	console.log(
		JSON.stringify(
			syncNutrition({
				change,
				mode: args.includes("--mode") ? opt("--mode") : "apply",
				write: args.includes("--write"),
				expectedResultHash: args.includes("--result-hash")
					? opt("--result-hash")
					: undefined,
			}),
			null,
			2,
		),
	);
}
