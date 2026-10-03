import { test } from "node:test";
import assert from "node:assert/strict";
import {
	mkdtempSync,
	readFileSync,
	writeFileSync,
	mkdirSync,
	cpSync,
	rmSync,
	existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const fixtureRoot = fileURLToPath(
	new URL("./fixtures/catalog-additions/", import.meta.url),
);
import { hash } from "../src/nutrition-sync.mjs";
import {
	loadCanonicalAdditions,
	validateCanonicalAddition,
	appendRecords,
	appendCompact,
	applyCanonicalAdditions,
	imageVariants,
	installCanonicalAdditions,
} from "../src/catalog-additions.mjs";
const staged = JSON.parse(readFileSync(join(fixtureRoot, "manifest.json")));
const fixture = () => {
	const e = structuredClone(staged.entries[0]);
	e.sourceReview = {
		status: "accepted",
		sourceHash: e.sourceHash,
		reviewerId: "fixture-source-reviewer",
		notes: "TEST ONLY derived source fixture",
	};
	return e;
};
function setup() {
	const root = mkdtempSync(join(tmpdir(), "atlas-addition-test-")),
		e = fixture();
	cpSync(join(fixtureRoot, "assets"), join(root, "catalog-additions/assets"), {
		recursive: true,
	});
	writeFileSync(
		join(root, "catalog-additions/manifest.json"),
		JSON.stringify({ schemaVersion: 1, entries: [e] }),
	);
	const old = {
			id: "ia_old",
			slug: "old",
			metadata: {
				nutritionPer100g: { calories: 123 },
				nutritionSource: "manual",
			},
			images: {},
			aliases: ["cooked white rice"],
		},
		compact = { recordsBySlug: { old }, aliases: { "cooked-white-rice": old } };
	for (const d of ["dataset", "public-dataset", "data"]) {
		mkdirSync(join(root, d));
		writeFileSync(
			join(root, d, "manifest.compact.json"),
			JSON.stringify(compact),
		);
		if (d !== "data") {
			writeFileSync(
				join(root, d, "manifest.json"),
				JSON.stringify({ records: [old] }),
			);
			writeFileSync(
				join(root, d, "metadata.jsonl"),
				'{"slug":"old","preserve":"exact line"}\n',
			);
			writeFileSync(
				join(root, d, "checksums.sha256"),
				"oldhash  old-file.png\n",
			);
			writeFileSync(
				join(root, d, "summary.json"),
				JSON.stringify({
					counts: {
						records: 1,
						metadataRows: 1,
						imageFiles: 0,
						checksumRows: 0,
					},
				}),
			);
		}
	}
	return { root, e, old };
}
test("independent source hash and reviewed alpha binding required", () => {
	const e = fixture();
	validateCanonicalAddition(e);
	const tampered = structuredClone(e);
	tampered.record.metadata.nutritionPer100g.calories = 999;
	assert.throws(() => validateCanonicalAddition(tampered));
});
test("resealed source without exact independent hash review is blocked", () => {
	const e = fixture();
	e.record.displayName = "Changed";
	const { sourceHash, sourceReview, ...body } = e;
	e.sourceHash = hash(body);
	assert.throws(() => validateCanonicalAddition(e));
});
test("explicit unknown cannot become partial zeros or automatic FDC mapping", () => {
	const e = structuredClone(staged.entries[1]);
	e.record.metadata.usdaFdcId = 1;
	const { sourceHash, sourceReview, ...body } = e;
	e.sourceHash = hash(body);
	e.sourceReview = {
		status: "accepted",
		sourceHash: e.sourceHash,
		reviewerId: "fixture",
		notes: "TEST ONLY",
	};
	assert.throws(() => validateCanonicalAddition(e), /unknown|metadata/);
});
test("append preserves unrelated rows and old alias owners; same slug never overwrites", () => {
	const e = fixture(),
		old = { id: "ia_old", slug: "old" },
		rows = appendRecords([old], [e]);
	assert.deepEqual(rows[0], old);
	assert.throws(() =>
		appendRecords([{ ...e.record, displayName: "Existing" }], [e]),
	);
	const doc = appendCompact(
		{ recordsBySlug: { old }, aliases: { "cooked-white-rice": old } },
		[e],
	);
	assert.deepEqual(doc.aliases["cooked-white-rice"], old);
});
test("apply keeps original JSONL bytes/metadata and image bytes; replay is stable", async () => {
	const { root, e, old } = setup();
	try {
		const before = readFileSync(
				join(root, "public-dataset/metadata.jsonl"),
				"utf8",
			),
			dry = await applyCanonicalAdditions({ root });
		assert.equal(dry.status, "ready");
		assert.equal(
			JSON.parse(readFileSync(join(root, "public-dataset/manifest.json")))
				.records.length,
			1,
		);
		const done = await applyCanonicalAdditions({ root, write: true });
		assert.equal(done.status, "applied");
		for (const d of ["dataset", "public-dataset"]) {
			assert.deepEqual(
				JSON.parse(readFileSync(join(root, d, "manifest.json"))).records[0],
				old,
			);
			assert.ok(
				readFileSync(join(root, d, "metadata.jsonl"), "utf8").startsWith(
					before,
				),
			);
			for (const i of imageVariants(e.record))
				assert.deepEqual(
					readFileSync(join(root, d, i.path)),
					readFileSync(join(root, i.path)),
				);
		}
		assert.equal(
			(await applyCanonicalAdditions({ root, write: true })).status,
			"already-applied",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
test("canonical byte tampering, removed derivative and interrupted transaction block", async () => {
	const { root, e } = setup();
	try {
		await applyCanonicalAdditions({ root, write: true });
		rmSync(
			join(root, "public-dataset", e.record.images.transparent.webp512.path),
		);
		await assert.rejects(applyCanonicalAdditions({ root }), /missing/);
		writeFileSync(
			join(root, "catalog-additions/apply.pending.private.json"),
			"{}",
		);
		await assert.rejects(applyCanonicalAdditions({ root }), /Interrupted/);
		rmSync(join(root, "catalog-additions/apply.pending.private.json"));
		writeFileSync(join(root, e.record.images.original.path), "tampered");
		assert.throws(() => loadCanonicalAdditions(root), /bytes changed/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("resealed derived nutrient mismatch cannot override accepted intent", () => {
	const e = fixture();
	e.record.metadata.nutritionPer100g.calories = 999;
	const { sourceHash, sourceReview, ...body } = e;
	e.sourceHash = hash(body);
	e.sourceReview = { ...sourceReview, sourceHash: e.sourceHash };
	assert.throws(() => validateCanonicalAddition(e), /metadata/);
});
test("compact and JSONL replay tampering is held without regeneration", async () => {
	const { root, e } = setup();
	try {
		await applyCanonicalAdditions({ root, write: true });
		const p = join(root, "public-dataset/manifest.compact.json"),
			old = readFileSync(p),
			doc = JSON.parse(old);
		delete doc.recordsBySlug[e.record.slug];
		writeFileSync(p, JSON.stringify(doc));
		await assert.rejects(
			applyCanonicalAdditions({ root, write: true }),
			/derivative metadata/,
		);
		writeFileSync(p, old);
		const j = join(root, "public-dataset/metadata.jsonl");
		writeFileSync(
			j,
			readFileSync(j, "utf8")
				.split("\n")
				.filter((s) => !s.includes(e.record.slug))
				.join("\n"),
		);
		await assert.rejects(
			applyCanonicalAdditions({ root, write: true }),
			/derivative metadata/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
test("installation lock precedes any source read and destination tampering blocks", () => {
	const { root } = setup();
	try {
		writeFileSync(join(root, "catalog-additions/install.lock"), "active");
		assert.throws(
			() =>
				installCanonicalAdditions({
					root,
					stageRoot: "/missing-stage",
					write: true,
				}),
			/EEXIST/,
		);
		rmSync(join(root, "catalog-additions/install.lock"));
		assert.equal(
			installCanonicalAdditions({ root, stageRoot: root, write: true }).status,
			"installed",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
test("private Parquet keeps original source IDs and genuine additions have no fabricated IDs", async () => {
	const { createRequire } = await import("node:module"),
		parquet = createRequire(import.meta.url)("parquetjs-lite"),
		{ root, e } = setup();
	try {
		const fields = [
			"file_name",
			"slug",
			"display_name",
			"category",
			"aliases_json",
			"image_license_recommendation",
			"license_status",
			"dataset_status",
			"generated_by",
			"incubated_by",
			"source_job_id",
			"source_storage_id",
			"webp512_sha256",
			"png512_sha256",
		];
		const schema = new parquet.ParquetSchema(
				Object.fromEntries(fields.map((k) => [k, { type: "UTF8" }])),
			),
			p = join(root, "dataset/metadata.parquet"),
			writer = await parquet.ParquetWriter.openFile(schema, p),
			old = Object.fromEntries(
				fields.map((k) => [k, k === "slug" ? "old" : "fixture-" + k]),
			);
		await writer.appendRow(old);
		await writer.close();
		await applyCanonicalAdditions({ root, write: true });
		const reader = await parquet.ParquetReader.openFile(p),
			cursor = reader.getCursor(),
			rows = [];
		let r;
		while ((r = await cursor.next())) rows.push(r);
		const newSchema = reader.schema;
		assert.equal(newSchema.fields.source_job_id.repetitionType, "OPTIONAL");
		await reader.close();
		assert.deepEqual(rows[0], old);
		assert.equal(rows[1].slug, e.record.slug);
		assert.equal(rows[1].source_job_id, undefined);
		assert.equal(rows[1].source_storage_id, undefined);
		assert.equal(rows[1].generated_by, "image_gen");
		assert.equal(
			(await applyCanonicalAdditions({ root, write: true })).status,
			"already-applied",
		);
		rows[1].display_name = "Changed after publication";
		const changed = await parquet.ParquetWriter.openFile(newSchema, p);
		for (const row of rows) await changed.appendRow(row);
		await changed.close();
		await assert.rejects(applyCanonicalAdditions({ root }), /parquet metadata/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
test("required public food-kind Parquet column is populated and replay matches", async () => {
	const { createRequire } = await import("node:module"),
		parquet = createRequire(import.meta.url)("parquetjs-lite"),
		{ root, e } = setup();
	try {
		const schema = new parquet.ParquetSchema({
				slug: { type: "UTF8" },
				kind: { type: "UTF8" },
			}),
			p = join(root, "public-dataset/metadata.parquet"),
			writer = await parquet.ParquetWriter.openFile(schema, p);
		await writer.appendRow({ slug: "old", kind: "food" });
		await writer.close();
		await applyCanonicalAdditions({ root, write: true });
		const reader = await parquet.ParquetReader.openFile(p),
			cursor = reader.getCursor();
		assert.deepEqual(await cursor.next(), { slug: "old", kind: "food" });
		assert.deepEqual(await cursor.next(), {
			slug: e.record.slug,
			kind: "food",
		});
		await reader.close();
		assert.equal(
			(await applyCanonicalAdditions({ root, write: true })).status,
			"already-applied",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
