import { execFileSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	readFileSync,
	writeFileSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	syncNutrition,
	hash,
	loadReceipts,
	loadOverrides,
	overlayRecord,
	fieldEvidence,
} from "../src/nutrition-sync.mjs";
const fixtures = readFileSync(
	new URL("./fixtures/nutrition-bound-changes.jsonl", import.meta.url),
	"utf8",
)
	.trim()
	.split("\n")
	.map(JSON.parse);
function setup(i = 0) {
	const root = mkdtempSync(join(tmpdir(), "atlas-nutrition-"));
	const change = structuredClone(fixtures[i]);
	change.review = {
		status: "accepted",
		reviewerId: "fixture-independent-reviewer",
		reviewedAt: "2026-10-03",
		changeId: change.changeId,
		notes: "TEST ONLY synthetic approval; no real reviewed status",
	};
	for (const dir of ["dataset", "public-dataset"]) {
		mkdirSync(join(root, dir));
		writeFileSync(
			join(root, dir, "manifest.json"),
			JSON.stringify({
				records: [
					{
						id: change.targets.atlas.id,
						slug: change.ingredient.slug,
						metadata: {
							usdaFdcId: Number(change.evidence[0].foodId),
							nutritionSource: "usda",
							nutritionPer100g: change.baseline.values,
						},
						images: {
							png512: { sha256: "unchanged", path: "images/sentinel.png" },
						},
					},
				],
			}),
		);
		mkdirSync(join(root, dir, "images"));
		writeFileSync(
			join(root, dir, "images/sentinel.png"),
			Buffer.from([137, 80, 78, 71, 0, 255]),
		);
	}
	return { root, change };
}
function mutate(root, patch) {
	const p = join(root, "public-dataset/manifest.json"),
		doc = JSON.parse(readFileSync(p));
	patch(doc.records[0]);
	writeFileSync(p, JSON.stringify(doc));
}
for (let i = 0; i < 3; i++)
	test(`exact food ${i} dry-run/apply/replay/readback/undo and image preservation`, () => {
		const { root, change } = setup(i);
		try {
			const image = readFileSync(join(root, "dataset/images/sentinel.png"));
			const before = JSON.parse(
				readFileSync(join(root, "dataset/manifest.json")),
			);
			assert.equal(syncNutrition({ root, change }).status, "ready");
			assert.deepEqual(
				JSON.parse(readFileSync(join(root, "dataset/manifest.json"))),
				before,
			);
			const applied = syncNutrition({ root, change, write: true });
			assert.equal(applied.status, "applied");
			assert.equal(
				syncNutrition({ root, change, write: true }).status,
				"already-applied",
			);
			assert.deepEqual(
				syncNutrition({ root, change, mode: "readback" }).states,
				["after", "after"],
			);
			const after = JSON.parse(
				readFileSync(join(root, "dataset/manifest.json")),
			);
			assert.deepEqual(after.records[0].metadata.nutritionPer100g, {
				...change.baseline.values,
				saturatedFatG: change.proposed.saturatedFatG.value,
			});
			assert.deepEqual(after.records[0].images, before.records[0].images);
			assert.deepEqual(
				readFileSync(join(root, "dataset/images/sentinel.png")),
				image,
			);
			assert.deepEqual(
				after.records[0].metadata.nutritionFieldEvidence,
				fieldEvidence(change),
			);
			const rebuilt = overlayRecord(
				structuredClone(before.records[0]),
				loadOverrides(root),
			);
			assert.equal(
				JSON.stringify(loadOverrides(root)).includes(change.targets.buna.id),
				false,
			);
			assert.equal(
				JSON.stringify(loadOverrides(root)).includes("TEST ONLY"),
				false,
			);
			assert.deepEqual(rebuilt, after.records[0]);
			assert.equal(
				syncNutrition({
					root,
					change,
					mode: "undo",
					expectedResultHash: applied.resultHash,
				}).status,
				"undo-ready",
			);
			assert.equal(
				syncNutrition({
					root,
					change,
					mode: "undo",
					write: true,
					expectedResultHash: applied.resultHash,
				}).status,
				"undone",
			);
			assert.equal(
				syncNutrition({
					root,
					change,
					mode: "undo",
					write: true,
					expectedResultHash: applied.resultHash,
				}).status,
				"already-undone",
			);
			assert.deepEqual(
				JSON.parse(readFileSync(join(root, "dataset/manifest.json"))),
				before,
			);
			assert.deepEqual(
				overlayRecord(structuredClone(before.records[0]), loadReceipts(root)),
				before.records[0],
			);
			assert.throws(
				() => syncNutrition({ root, change, write: true }),
				/cannot be reapplied/,
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
test("CAS rejects known zero, later old values, evidence and origin", () => {
	for (const patch of [
		(r) => (r.metadata.nutritionPer100g.saturatedFatG = 0),
		(r) => (r.metadata.nutritionPer100g.sodiumMg = 1),
		(r) => (r.metadata.nutritionSource = "manual"),
		(r) =>
			(r.metadata.nutritionFieldEvidence = { saturatedFatG: { value: 1 } }),
	]) {
		const { root, change } = setup();
		try {
			mutate(root, patch);
			const before = readFileSync(join(root, "public-dataset/manifest.json"));
			assert.throws(() => syncNutrition({ root, change, write: true }));
			assert.deepEqual(
				readFileSync(join(root, "public-dataset/manifest.json")),
				before,
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	}
});
test("pending, wrong state, changed body and self-review blocked", () => {
	const { root, change } = setup();
	try {
		for (const bad of [
			fixtures[0],
			{ ...change, reason: "tampered" },
			{ ...change, review: { ...change.review, reviewerId: change.writerId } },
			{ ...change, ingredient: { ...change.ingredient, state: "unsalted" } },
		])
			assert.throws(() => syncNutrition({ root, change: bad, write: true }));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
test("undo and overlay protect later changes", () => {
	const { root, change } = setup();
	try {
		const applied = syncNutrition({ root, change, write: true });
		mutate(root, (r) => (r.metadata.nutritionPer100g.calories = 1));
		const before = readFileSync(join(root, "public-dataset/manifest.json"));
		assert.throws(
			() =>
				syncNutrition({
					root,
					change,
					mode: "undo",
					write: true,
					expectedResultHash: applied.resultHash,
				}),
			/conflict/,
		);
		assert.deepEqual(
			readFileSync(join(root, "public-dataset/manifest.json")),
			before,
		);
		assert.throws(
			() => overlayRecord(JSON.parse(before).records[0], loadReceipts(root)),
			/baseline conflict/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
test("interrupted apply resumes only explicit before/after states", () => {
	const { root, change } = setup();
	try {
		const applied = syncNutrition({ root, change, write: true });
		const p = join(root, "nutrition/receipts.private.json"),
			rows = JSON.parse(readFileSync(p));
		rows.receipts[0].status = "applying";
		writeFileSync(p, JSON.stringify(rows));
		mutate(root, (r) => {
			r.metadata.nutritionPer100g = change.baseline.values;
			delete r.metadata.nutritionFieldEvidence;
		});
		assert.equal(
			syncNutrition({ root, change, write: true }).status,
			"applied",
		);
		assert.deepEqual(syncNutrition({ root, change, mode: "readback" }).states, [
			"after",
			"after",
		]);
		assert.throws(
			() =>
				syncNutrition({
					root,
					change,
					mode: "undo",
					write: true,
					expectedResultHash: "bad",
				}),
			/result hash/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("fresh checkout rebuild retains public-safe accepted source without private operational receipts", () => {
	const { root, change } = setup();
	const fresh = mkdtempSync(join(tmpdir(), "atlas-fresh-"));
	try {
		const baseline = JSON.parse(
			readFileSync(join(root, "dataset/manifest.json")),
		).records[0];
		syncNutrition({ root, change, write: true });
		mkdirSync(join(fresh, "nutrition"));
		writeFileSync(
			join(fresh, "nutrition/overrides.json"),
			readFileSync(join(root, "nutrition/overrides.json")),
		);
		assert.equal(loadReceipts(fresh).length, 0);
		const rebuilt = overlayRecord(
			structuredClone(baseline),
			loadOverrides(fresh),
		);
		assert.deepEqual(rebuilt.metadata.nutritionPer100g, {
			...change.baseline.values,
			saturatedFatG: change.proposed.saturatedFatG.value,
		});
		assert.deepEqual(
			rebuilt.metadata.nutritionFieldEvidence,
			fieldEvidence(change),
		);
		assert.deepEqual(rebuilt.images, baseline.images);
		assert.equal(
			JSON.stringify(loadOverrides(fresh)).includes(change.targets.buna.id),
			false,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
		rmSync(fresh, { recursive: true, force: true });
	}
});
test("tampered canonical source and resealed private notes block rebuild", () => {
	const { root, change } = setup();
	try {
		syncNutrition({ root, change, write: true });
		const p = join(root, "nutrition/overrides.json"),
			doc = JSON.parse(readFileSync(p));
		doc.overrides[0].fieldEvidence.saturatedFatG.review.notes =
			"private live receipt";
		const { overrideHash, ...body } = doc.overrides[0];
		doc.overrides[0].overrideHash = hash(body);
		writeFileSync(p, JSON.stringify(doc));
		assert.throws(() => loadOverrides(root), /review\/evidence|private/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
test("last-step interrupted receipts resume and finish even when both manifests already match", () => {
	const { root, change } = setup();
	try {
		const applied = syncNutrition({ root, change, write: true });
		const p = join(root, "nutrition/receipts.private.json");
		let doc = JSON.parse(readFileSync(p));
		doc.receipts[0].status = "applying";
		writeFileSync(p, JSON.stringify(doc));
		assert.throws(() => loadOverrides(root), /interrupted/);
		syncNutrition({ root, change, write: true });
		assert.equal(loadReceipts(root)[0].status, "applied");
		syncNutrition({
			root,
			change,
			mode: "undo",
			write: true,
			expectedResultHash: applied.resultHash,
		});
		doc = JSON.parse(readFileSync(p));
		doc.receipts[0].status = "undoing";
		writeFileSync(p, JSON.stringify(doc));
		syncNutrition({
			root,
			change,
			mode: "undo",
			write: true,
			expectedResultHash: applied.resultHash,
		});
		assert.equal(loadReceipts(root)[0].status, "undone");
		assert.equal(loadOverrides(root).length, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("dead-process locks recover while live and unknown owners remain protected", () => {
	const { root, change } = setup();
	try {
		mkdirSync(join(root, "nutrition"), { recursive: true });
		const lock = join(root, "nutrition/sync.lock");
		const pid = Number(
			execFileSync(process.execPath, ["-e", "console.log(process.pid)"])
				.toString()
				.trim(),
		);
		writeFileSync(lock, JSON.stringify({ pid }));
		assert.equal(syncNutrition({ root, change }).status, "ready");
		writeFileSync(lock, JSON.stringify({ pid: process.pid }));
		assert.throws(
			() => syncNutrition({ root, change, write: true }),
			/live process/,
		);
		writeFileSync(lock, "unknown");
		assert.throws(
			() => syncNutrition({ root, change, write: true }),
			/Unknown/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
