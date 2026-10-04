// Reviewed catalog additions. Append-only; never rebuilds existing art or reads Buna.
import { createHash } from "node:crypto";
import {
	readFileSync,
	writeFileSync,
	renameSync,
	existsSync,
	mkdirSync,
	openSync,
	closeSync,
	rmSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { canonical, hash } from "./nutrition-sync.mjs";
import {loadAliasOverrides,syncAliases} from "./alias-writeback.mjs";
import {acquireExportMaintenance} from "./export-maintenance-lock.mjs";
const require = createRequire(import.meta.url),
	parquet = require("parquetjs-lite");
const digest = (b) => createHash("sha256").update(b).digest("hex");
const same = (a, b) => canonical(a) === canonical(b);
const safePath = (p) =>
	typeof p === "string" &&
	/^catalog-additions\/assets\/[a-z0-9-]+\/[a-zA-Z0-9.-]+$/.test(p);
export const imageVariants = (r) => [
	r.images.original,
	r.images.webp512,
	r.images.png512,
	...Object.values(r.images.transparent || {}),
];
export function validateCanonicalAddition(e) {
	const { sourceHash, sourceReview, ...body } = e,
		r = e.record,
		{ review, intentHash, ...intentBody } = e.intent;
	if (
		sourceHash !== hash(body) ||
		sourceReview?.status !== "accepted" ||
		sourceReview.sourceHash !== sourceHash ||
		!sourceReview.reviewerId?.trim() ||
		sourceReview.reviewerId === e.intent.writerId ||
		!sourceReview.notes?.trim() ||
		hash(intentBody) !== intentHash ||
		e.intentHash !== intentHash ||
		review.status !== "accepted" ||
		review.intentHash !== intentHash ||
		!review.reviewerId?.trim() ||
		review.reviewerId === e.intent.writerId ||
		!review.notes?.trim()
	)
		throw Error("Accepted hash-bound canonical addition required");
	if (
		r.id !== `ia_${r.slug}` ||
		r.slug !== e.intent.record.slug ||
		!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug) ||
		r.slug.length > 100
	)
		throw Error("Invalid exact addition identity");
	if (
		!same(r.metadata.publicationRecord, e.intent.record) ||
		r.metadata.publicationIntentHash !== intentHash
	)
		throw Error("Metadata evidence differs from reviewed intent");
	const expectedMetadata = {
		nutritionPer100g: e.intent.record.nutritionPer100g,
		nutritionSource: e.intent.record.nutritionOrigin,
		nutritionNote: e.intent.record.nutritionNote,
		usdaFdcId: e.intent.record.usdaFdcId,
		density: e.intent.record.density,
		labelServingEvidence: e.intent.record.labelServingEvidence,
	};
	for (const [key, value] of Object.entries(expectedMetadata))
		if (!same(r.metadata[key] ?? null, value ?? null))
			throw Error("Derived nutrition metadata differs from reviewed intent");
	if (
		r.images.transparent.webp512.sha256 !== e.intent.record.image.sha256 ||
		r.images.transparent.master.sha256 !== e.intent.record.image.masterSha256
	)
		throw Error("Reviewed transparent image mismatch");
	const n = r.metadata.nutritionPer100g,
		fields = [
			"calories",
			"proteinG",
			"fatG",
			"carbsG",
			"fiberG",
			"sodiumMg",
			"sugarG",
			"saturatedFatG",
		];
	if (r.metadata.nutritionSource === "missing") {
		if (
			n ||
			r.metadata.usdaFdcId !== undefined ||
			!r.metadata.nutritionNote?.trim() ||
			!r.metadata.nutritionEvidence?.length
		)
			throw Error("Explicit unknown needs reason/evidence and no numbers/FDC");
	} else if (
		!n ||
		fields.some((k) => !Number.isFinite(n[k]) || n[k] < 0) ||
		n.saturatedFatG > n.fatG
	)
		throw Error("All eight known values required");
	for (const img of imageVariants(r))
		if (
			!safePath(img.path) ||
			!/^[a-f0-9]{64}$/.test(img.sha256) ||
			img.bytes <= 0
		)
			throw Error("Unsafe asset path/hash");
	const forbidden = new Set([
		"sourceJobId",
		"sourceStorageId",
		"sourceDeployment",
		"storageId",
		"ingredientId",
		"apiKey",
		"authorization",
		"resolvedPrompt",
	]);
	const scan = (o) => {
		if (o && typeof o === "object")
			for (const [k, v] of Object.entries(o)) {
				if (forbidden.has(k)) throw Error("Private operational data forbidden");
				scan(v);
			}
	};
	scan(e);
	return e;
}
export function loadCanonicalAdditions(root) {
	const p = join(root, "catalog-additions/manifest.json");
	if (!existsSync(p)) return [];
	const source = JSON.parse(readFileSync(p, "utf8"));
	if (source.schemaVersion !== 1 || !Array.isArray(source.entries))
		throw Error("Invalid canonical addition source");
	if (
		new Set(source.entries.map((e) => e.record.slug)).size !==
		source.entries.length
	)
		throw Error("Duplicate canonical addition identity");
	for (const e of source.entries) {
		validateCanonicalAddition(e);
		for (const i of imageVariants(e.record)) {
			const b = readFileSync(join(root, i.path));
			if (digest(b) !== i.sha256 || b.length !== i.bytes)
				throw Error("Canonical image bytes changed");
		}
	}
	return source.entries;
}
export function appendRecords(records, entries) {
	const result = [...records];
	for (const e of entries) {
		validateCanonicalAddition(e);
		const matches = result.filter(
			(r) => r.slug === e.record.slug || r.id === e.record.id,
		);
		if (matches.length) {
			if (matches.length !== 1 || !same(matches[0], e.record))
				throw Error(`Existing row conflict: ${e.record.slug}`);
		} else result.push(e.record);
	}
	return result;
}
const compact = (r) => ({
	slug: r.slug,
	displayName: r.displayName,
	category: r.category,
	subcategory: r.subcategory,
	aliases: r.aliases,
	images: r.images,
	license: r.license,
	provenance: r.provenance,
	review: r.review,
});
const normalize = (s) =>
	s
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
export function appendCompact(doc, entries) {
	const out = structuredClone(doc);
	for (const e of entries) {
		const r = compact(e.record),
			old = out.recordsBySlug[r.slug];
		if (old && !same(old, r))
			throw Error(`Existing compact row conflict: ${r.slug}`);
		out.recordsBySlug[r.slug] = r;
		// Preserve prior alias owners. Proven wrong aliases have a separate CAS correction.
		for (const a of [...r.aliases, ...(e.record.aliasesDe || [])]) {
			const key = normalize(a);
			if (key && !out.aliases[key]) out.aliases[key] = r;
		}
	}
	return out;
}
export const metadataRow = (r, privateDataset = false) => ({
	kind: "food",
	...(privateDataset
		? {
				image_license_recommendation: "CC0-1.0",
				dataset_status: r.review.status,
				generated_by: "image_gen",
			}
		: {}),
	file_name: r.images.webp512.path,
	slug: r.slug,
	display_name: r.displayName,
	category: r.category,
	subcategory: r.subcategory,
	aliases: r.aliases,
	aliases_de: r.aliasesDe,
	image_license: r.license.images,
	metadata_license: r.license.metadata,
	license_status: r.license.status,
	ai_generated: true,
	incubated_by: "Buna",
	review_status: r.review.status,
	replacement_promoted: false,
	nutrition_source: r.metadata.nutritionSource,
	nutrition_confidence:
		r.metadata.nutritionSource === "missing" ? "missing" : "source-backed",
	usda_fdc_id: r.metadata.usdaFdcId ? String(r.metadata.usdaFdcId) : null,
	webp512_sha256: r.images.webp512.sha256,
	png512_sha256: r.images.png512.sha256,
});
const atomic = (p, b) => {
	mkdirSync(dirname(p), { recursive: true });
	writeFileSync(p + ".catalog-tmp", b);
	renameSync(p + ".catalog-tmp", p);
};
async function parquetBytes(root, path, rows) {
	// Preserve the existing schema and every existing row; additions have the same public table fields.
	const reader = await parquet.ParquetReader.openFile(path),
		schema = new parquet.ParquetSchema({
			...reader.schema.schema,
			...(reader.schema.fields.source_job_id
				? {
						source_job_id: {
							...reader.schema.schema.source_job_id,
							optional: true,
						},
						source_storage_id: {
							...reader.schema.schema.source_storage_id,
							optional: true,
						},
					}
				: {}),
		}),
		cursor = reader.getCursor(),
		existing = [];
	let row;
	while ((row = await cursor.next())) existing.push(row);
	await reader.close();
	const file = join(root, "catalog-additions/parquet.private.tmp");
	const writer = await parquet.ParquetWriter.openFile(schema, file);
	try {
		for (const r of existing) await writer.appendRow(r);
		for (const r of rows)
			await writer.appendRow({
				...r,
				aliases_json: JSON.stringify(r.aliases),
				aliases_de_json: JSON.stringify(r.aliases_de),
			});
	} finally {
		await writer.close();
	}
	const bytes = readFileSync(file);
	rmSync(file);
	return bytes;
}
async function verifyExistingDerivatives(root, dir, entries) {
	if (!entries.length) return;
	const cp = join(root, dir, "manifest.compact.json"),
		jp = join(root, dir, "metadata.jsonl"),
		chk = join(root, dir, "checksums.sha256");
	if (!existsSync(cp) || !existsSync(jp) || !existsSync(chk))
		throw Error("Missing addition derivative metadata");
	const comp = JSON.parse(readFileSync(cp)),
		rows = readFileSync(jp, "utf8").trim().split("\n").map(JSON.parse),
		lines = readFileSync(chk, "utf8").trim().split("\n");
	for (const e of entries) {
		if (
			!same(comp.recordsBySlug[e.record.slug], compact(e.record)) ||
			!same(
				rows.find((r) => r.slug === e.record.slug),
				metadataRow(e.record, dir === "dataset"),
			)
		)
			throw Error("Changed/missing addition derivative metadata");
		for (const img of imageVariants(e.record)) {
			const matches = lines.filter((s) => s.endsWith("  " + img.path));
			if (matches.length !== 1 || matches[0] !== img.sha256 + "  " + img.path)
				throw Error("Changed/missing addition checksum");
		}
	}
	const pp = join(root, dir, "metadata.parquet");
	if (existsSync(pp)) {
		const reader = await parquet.ParquetReader.openFile(pp);
		try {
			const cursor = reader.getCursor(),
				found = [];
			let row;
			while ((row = await cursor.next()))
				if (entries.some((e) => e.record.slug === row.slug)) found.push(row);
			for (const e of entries) {
				const matches = found.filter((r) => r.slug === e.record.slug),
					m = metadataRow(e.record, dir === "dataset"),
					expected = {
						...m,
						aliases_json: JSON.stringify(m.aliases),
						aliases_de_json: JSON.stringify(m.aliases_de),
					};
				if (
					matches.length !== 1 ||
					Object.keys(reader.schema.fields).some(
						(k) => !same(matches[0][k] ?? null, expected[k] ?? null),
					)
				)
					throw Error("Changed/missing addition parquet metadata");
			}
		} finally {
			await reader.close();
		}
	}
}
async function applyCanonicalAdditionRecords({ root, write = false }) {
	root = resolve(root);
	const entries = loadCanonicalAdditions(root);
	if (!entries.length) return { status: "empty", added: 0 };
	const lock = join(root, "catalog-additions/apply.lock"),
		pending = join(root, "catalog-additions/apply.pending.private.json");
	if (existsSync(pending))
		throw Error(
			"Interrupted addition transaction; inspect pending receipt before any rebuild/retry",
		);
	let fd;
	if (write) fd = openSync(lock, "wx", 0o600);
	try {
		const writes = new Map(),
			before = new Map(),
			counts = {};
		const stage = (p, b) => {
			const path = join(root, p);
			before.set(path, existsSync(path) ? readFileSync(path) : null);
			writes.set(
				path,
				Buffer.isBuffer(b)
					? b
					: Buffer.from(
							typeof b === "string" ? b : JSON.stringify(b, null, 2) + "\n",
						),
			);
		};
		for (const dir of ["dataset", "public-dataset"]) {
			const mp = join(root, dir, "manifest.json");
			if (!existsSync(mp)) continue;
			const manifest = JSON.parse(readFileSync(mp)),
				old = manifest.records,
				records = appendRecords(old, entries);
			counts[dir] = { before: old.length, after: records.length };
			await verifyExistingDerivatives(
				root,
				dir,
				entries.filter((e) => old.some((r) => r.slug === e.record.slug)),
			);
			if (records.length === old.length) {
				for (const e of entries)
					for (const i of imageVariants(e.record)) {
						const p = join(root, dir, i.path);
						if (!existsSync(p) || digest(readFileSync(p)) !== i.sha256)
							throw Error("Existing addition derivative missing/changed");
					}
				continue;
			}
			stage(`${dir}/manifest.json`, { ...manifest, records });
			const cp = join(root, dir, "manifest.compact.json");
			if (existsSync(cp))
				stage(
					`${dir}/manifest.compact.json`,
					appendCompact(JSON.parse(readFileSync(cp)), entries),
				);
			const jp = join(root, dir, "metadata.jsonl");
			if (existsSync(jp)) {
				const raw = readFileSync(jp, "utf8"),
					rows = raw.trim().split("\n").filter(Boolean).map(JSON.parse),
					extra = entries
						.filter((e) => !rows.some((r) => r.slug === e.record.slug))
						.map((e) => metadataRow(e.record, dir === "dataset"));
				stage(
					`${dir}/metadata.jsonl`,
					raw +
						(raw.endsWith("\n") ? "" : "\n") +
						extra.map((r) => JSON.stringify(r) + "\n").join(""),
				);
				const pp = join(root, dir, "metadata.parquet");
				if (existsSync(pp) && extra.length) {
					mkdirSync(join(root, "catalog-additions"), { recursive: true });
					stage(`${dir}/metadata.parquet`, await parquetBytes(root, pp, extra));
				}
			}
			const chk = join(root, dir, "checksums.sha256");
			if (existsSync(chk)) {
				const raw = readFileSync(chk, "utf8"),
					lines = new Set(raw.trim().split("\n"));
				for (const e of entries)
					for (const i of imageVariants(e.record))
						lines.add(`${i.sha256}  ${i.path}`);
				stage(`${dir}/checksums.sha256`, [...lines].join("\n") + "\n");
			}
			const sp = join(root, dir, "summary.json");
			if (existsSync(sp)) {
				const summary = JSON.parse(readFileSync(sp)),
					c = summary.counts;
				for (const k of [
					"records",
					"sourceRecords",
					"publicRecords",
					"metadataRows",
				])
					if (typeof c?.[k] === "number") c[k] += records.length - old.length;
				for (const k of ["imageFiles", "checksumRows"])
					if (typeof c?.[k] === "number")
						c[k] += entries
							.filter((e) => !old.some((r) => r.slug === e.record.slug))
							.reduce((n, e) => n + imageVariants(e.record).length, 0);
				stage(`${dir}/summary.json`, summary);
			}
			for (const e of entries)
				for (const i of imageVariants(e.record)) {
					const dest = join(root, dir, i.path),
						bytes = readFileSync(join(root, i.path));
					if (existsSync(dest) && digest(readFileSync(dest)) !== i.sha256)
						throw Error("Existing image conflict");
					if (!existsSync(dest)) stage(`${dir}/${i.path}`, bytes);
				}
		}
		const pkg = join(root, "data/manifest.compact.json");
		if (existsSync(pkg))
			stage(
				"data/manifest.compact.json",
				appendCompact(JSON.parse(readFileSync(pkg)), entries),
			);
		const changed = [...writes].filter(
			([p, b]) => !before.get(p) || !b.equals(before.get(p)),
		);
		if (write) {
			atomic(
				pending,
				JSON.stringify(
					{
						entries: entries.map((e) => e.sourceHash),
						files: changed.map(([p, b]) => ({
							path: p,
							beforeSha256: before.get(p) ? digest(before.get(p)) : null,
							afterSha256: digest(b),
						})),
					},
					null,
					2,
				),
			);
			for (const [p, b] of changed) {
				const old = before.get(p);
				if (
					old ? !existsSync(p) || !readFileSync(p).equals(old) : existsSync(p)
				)
					throw Error("Concurrent file change; preserve and reconcile");
				atomic(p, b);
			}
			const reread = loadCanonicalAdditions(root);
			for (const e of reread)
				for (const dir of ["dataset", "public-dataset"]) {
					const p = join(root, dir, "manifest.json");
					if (
						existsSync(p) &&
						!same(
							JSON.parse(readFileSync(p)).records.find(
								(r) => r.slug === e.record.slug,
							),
							e.record,
						)
					)
						throw Error("Readback differs");
				}
			rmSync(pending);
		}
		return {
			status: changed.length
				? write
					? "applied"
					: "ready"
				: "already-applied",
			entries: entries.map((e) => ({
				slug: e.record.slug,
				intentHash: e.intentHash,
			})),
			counts,
			changedFiles: changed.map(([p]) => p),
		};
	} finally {
		if (fd !== undefined) {
			closeSync(fd);
			rmSync(lock);
		}
	}
}
export async function applyCanonicalAdditions({root,write=false}) {
 const release=acquireExportMaintenance(root,'append');let overrides,result;
 try{overrides=loadAliasOverrides(root);result=await applyCanonicalAdditionRecords({root,write});}finally{release();}
 // Append is fully committed/read back before alias work reacquires the same lock.
 if(!overrides.length)return result;
 const aliases=[];
 for(const intent of overrides)aliases.push(await syncAliases({root,intent,write}));
 return {...result,aliasCorrections:aliases};
}
function installCanonicalAdditionsOwned({ root, stageRoot, write = false }) {
	root = resolve(root);
	stageRoot = resolve(stageRoot);
	let fd;
	const lock = join(root, "catalog-additions/install.lock");
	if (write) {
		mkdirSync(join(root, "catalog-additions"), { recursive: true });
		fd = openSync(lock, "wx", 0o600);
	}
	try {
		const incoming = loadCanonicalAdditions(stageRoot),
			existing = loadCanonicalAdditions(root),
			entries = [...existing];
		for (const e of incoming) {
			const old = existing.find((x) => x.record.slug === e.record.slug);
			if (old && !same(old, e)) throw Error("Canonical source conflict");
			if (!old) entries.push(e);
			for (const i of imageVariants(e.record)) {
				const p = join(root, i.path);
				if (existsSync(p) && digest(readFileSync(p)) !== i.sha256)
					throw Error("Canonical asset conflict");
			}
		}
		if (write) {
			for (const e of incoming)
				for (const i of imageVariants(e.record)) {
					const p = join(root, i.path);
					if (existsSync(p)) {
						if (digest(readFileSync(p)) !== i.sha256)
							throw Error("Concurrent canonical asset conflict");
					} else atomic(p, readFileSync(join(stageRoot, i.path)));
				}
			atomic(
				join(root, "catalog-additions/manifest.json"),
				JSON.stringify({ schemaVersion: 1, entries }, null, 2) + "\n",
			);
		}
		return {
			status: write ? "installed" : "install-ready",
			entries: incoming.map((e) => ({
				slug: e.record.slug,
				sourceHash: e.sourceHash,
			})),
		};
	} finally {
		if (fd !== undefined) {
			closeSync(fd);
			rmSync(lock);
		}
	}
}

export function installCanonicalAdditions(options){const release=acquireExportMaintenance(options.root,'source-install');try{return installCanonicalAdditionsOwned(options);}finally{release();}}
if (
	process.argv[1] &&
	resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
	const root = new URL("..", import.meta.url).pathname,
		args = process.argv.slice(2),
		stage = args.indexOf("--stage");
	if (stage >= 0)
		console.log(
			JSON.stringify(
				installCanonicalAdditions({
					root,
					stageRoot: resolve(args[stage + 1]),
					write: args.includes("--write"),
				}),
			),
		);
	else
		console.log(
			JSON.stringify(
				await applyCanonicalAdditions({
					root,
					write: args.includes("--write"),
				}),
			),
		);
}
