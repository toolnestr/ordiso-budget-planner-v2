// Firestore data-access helper.
// Mirrors the Prisma operations used across the budget-planner API routes so
// the migration is a near drop-in replacement. Dates are stored as ISO strings
// (which sort lexicographically = chronologically, enabling range queries).
import { firestore } from './firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy as fbOrderBy,
  limit as fbLimit,
  writeBatch,
  type QueryConstraint,
  type WhereFilterOp,
} from 'firebase/firestore'

export type Doc<T = Record<string, unknown>> = T & { id: string }
export type Filter = { field: string; op: WhereFilterOp; value: unknown }

/** Remove undefined values — Firestore rejects them. */
function clean<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(obj)) {
    const v = (obj as Record<string, unknown>)[k]
    if (v !== undefined) out[k] = v
  }
  return out
}

function toDoc<T>(snap: { exists: () => boolean; data: () => unknown; id: string }): Doc<T> | null {
  if (!snap.exists()) return null
  return { ...(snap.data() as T), id: snap.id }
}

function toDocs<T>(docs: { data: () => unknown; id: string }[]): Doc<T>[] {
  return docs.map((s) => ({ ...(s.data() as T), id: s.id }))
}

function buildConstraints(
  opts?: { orderByField?: string; orderDir?: 'asc' | 'desc'; limitN?: number },
  ...extra: QueryConstraint[]
): QueryConstraint[] {
  const c: QueryConstraint[] = [...extra]
  if (opts?.orderByField) c.push(fbOrderBy(opts.orderByField, opts.orderDir ?? 'asc'))
  if (opts?.limitN) c.push(fbLimit(opts.limitN))
  return c
}

/** Fetch every doc in a collection (optionally ordered / limited). */
export async function getAll<T = Record<string, unknown>>(
  name: string,
  opts?: { orderByField?: string; orderDir?: 'asc' | 'desc'; limitN?: number }
): Promise<Doc<T>[]> {
  const c = buildConstraints(opts)
  const q = c.length ? query(collection(firestore, name), ...c) : collection(firestore, name)
  const snap = await getDocs(q)
  return toDocs<T>(snap.docs as unknown as { data: () => unknown; id: string }[])
}

/** Single-field filtered fetch. */
export async function getWhere<T = Record<string, unknown>>(
  name: string,
  field: string,
  op: WhereFilterOp,
  value: unknown,
  opts?: { orderByField?: string; orderDir?: 'asc' | 'desc'; limitN?: number }
): Promise<Doc<T>[]> {
  const c = buildConstraints(opts, where(field, op, value))
  const snap = await getDocs(query(collection(firestore, name), ...c))
  return toDocs<T>(snap.docs as unknown as { data: () => unknown; id: string }[])
}

/** Multi-field filtered fetch (use for same-field range queries like date ranges). */
export async function getWhereMulti<T = Record<string, unknown>>(
  name: string,
  filters: Filter[],
  opts?: { orderByField?: string; orderDir?: 'asc' | 'desc'; limitN?: number }
): Promise<Doc<T>[]> {
  const c = buildConstraints(opts, ...filters.map((f) => where(f.field, f.op, f.value)))
  const snap = await getDocs(query(collection(firestore, name), ...c))
  return toDocs<T>(snap.docs as unknown as { data: () => unknown; id: string }[])
}

/** Get a single doc by id. */
export async function getById<T = Record<string, unknown>>(name: string, id: string): Promise<Doc<T> | null> {
  const snap = await getDoc(doc(firestore, name, id))
  return toDoc<T>(snap as unknown as { exists: () => boolean; data: () => unknown; id: string })
}

/** Create with an auto-generated id; returns the created doc. */
export async function createAuto<T extends Record<string, unknown>>(name: string, data: T): Promise<Doc<T>> {
  const ref = await addDoc(collection(firestore, name), clean(data))
  return { ...clean(data), id: ref.id } as Doc<T>
}

/** Create or overwrite with a specific id. */
export async function createWithId<T extends Record<string, unknown>>(name: string, id: string, data: T): Promise<Doc<T>> {
  const cleaned = clean(data)
  await setDoc(doc(firestore, name, id), cleaned)
  return { ...cleaned, id } as Doc<T>
}

/** Merge fields into a doc (creates if missing). */
export async function upsertDoc<T extends Record<string, unknown>>(name: string, id: string, data: Partial<T>): Promise<Doc<T>> {
  await setDoc(doc(firestore, name, id), clean(data as Record<string, unknown>), { merge: true })
  const after = await getById<T>(name, id)
  return after ?? ({ ...(clean(data as Record<string, unknown>) as T), id } as Doc<T>)
}

/** Partial update of a doc. */
export async function updateDocById<T extends Record<string, unknown>>(name: string, id: string, data: Partial<T>): Promise<void> {
  await updateDoc(doc(firestore, name, id), clean(data as Record<string, unknown>))
}

/** Increment a numeric field (Firestore atomic). */
export async function incrementField(name: string, id: string, field: string, by: number): Promise<void> {
  // Implemented as a read-modify-write to keep the helper dependency-light and predictable
  const current = await getById<Record<string, unknown>>(name, id)
  if (!current) return
  const newVal = (current[field] as number ?? 0) + by
  await updateDoc(doc(firestore, name, id), { [field]: newVal })
}

/** Delete a single doc. */
export async function deleteById(name: string, id: string): Promise<void> {
  await deleteDoc(doc(firestore, name, id))
}

/** Delete all docs matching a single-field filter. */
export async function deleteWhere(name: string, field: string, op: WhereFilterOp, value: unknown): Promise<void> {
  const docs = await getWhere(name, field, op, value)
  if (!docs.length) return
  const batch = writeBatch(firestore)
  docs.forEach((d) => batch.delete(doc(firestore, name, d.id)))
  await batch.commit()
}

/** Delete all docs matching multiple filters. */
export async function deleteWhereMulti(name: string, filters: Filter[]): Promise<void> {
  const docs = await getWhereMulti(name, filters)
  if (!docs.length) return
  const batch = writeBatch(firestore)
  docs.forEach((d) => batch.delete(doc(firestore, name, d.id)))
  await batch.commit()
}

/** Update all docs matching filters. */
export async function updateWhere(name: string, filters: Filter[], data: Record<string, unknown>): Promise<void> {
  const docs = await getWhereMulti(name, filters)
  if (!docs.length) return
  const batch = writeBatch(firestore)
  const cleaned = clean(data)
  docs.forEach((d) => batch.update(doc(firestore, name, d.id), cleaned))
  await batch.commit()
}

/** Bulk-create many docs. Items may include `_id` to force a doc id. */
export async function batchCreate(name: string, items: Record<string, unknown>[]): Promise<void> {
  if (!items.length) return
  const batch = writeBatch(firestore)
  for (const item of items) {
    const { _id, ...rest } = item
    const cleaned = clean(rest)
    if (_id) batch.set(doc(firestore, name, String(_id)), cleaned)
    else batch.set(doc(collection(firestore, name)), cleaned)
  }
  await batch.commit()
}

/** Count docs in a collection. */
export async function countAll(name: string): Promise<number> {
  const snap = await getDocs(collection(firestore, name))
  return snap.size
}

/** Delete every doc in a collection (batched). Useful for re-seeding. */
export async function deleteAll(name: string): Promise<void> {
  const snap = await getDocs(collection(firestore, name))
  if (snap.empty) return
  // Firestore batches max 500 ops; chunk to be safe
  const docs = snap.docs
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(firestore)
    docs.slice(i, i + 400).forEach((d) => batch.delete(doc(firestore, name, d.id)))
    await batch.commit()
  }
}
