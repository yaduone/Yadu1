/**
 * A small in-memory Firestore stand-in for service-level tests.
 *
 * The subscription lifecycle spans several collections (subscriptions, orders,
 * next_day_overrides, audit_logs, users, price_config) and uses transactions,
 * batches and range queries. Hand-rolled `jest.fn()` chains could not express
 * that without breaking every time a service touched one more collection, so
 * tests share this fake instead.
 *
 * Supported query surface — deliberately only what the services actually use:
 *   .where(field, '==' | 'in' | '>=' | '>' | '<=', value)
 *   .limit(n)
 *   .get()            -> { empty, docs: [{ id, data(), ref, exists }] }
 *   .add(data) / .doc(id?) / ref.get/set/update/delete/create
 *   db.batch()        -> set/update/delete/commit
 *   db.runTransaction -> tx.get(refOrQuery), tx.create/set/update/delete
 *
 * `admin.firestore.FieldPath.documentId()` is supported in `where` as a field,
 * matching against the document id.
 */

const DOCUMENT_ID = Symbol('__name__');

function clone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(clone);
  if (value instanceof Date) return new Date(value);
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = clone(v);
  return out;
}

function matches(id, data, [field, op, operand]) {
  const actual = field === DOCUMENT_ID ? id : data[field];
  switch (op) {
    case '==':
      return actual === operand;
    case '!=':
      return actual !== operand;
    case 'in':
      return Array.isArray(operand) && operand.includes(actual);
    case 'not-in':
      return Array.isArray(operand) && !operand.includes(actual);
    case '>=':
      return actual !== undefined && actual !== null && actual >= operand;
    case '>':
      return actual !== undefined && actual !== null && actual > operand;
    case '<=':
      return actual !== undefined && actual !== null && actual <= operand;
    case '<':
      return actual !== undefined && actual !== null && actual < operand;
    default:
      throw new Error(`fakeFirestore: unsupported operator "${op}"`);
  }
}

class FakeFirestore {
  constructor(seed = {}) {
    /** @type {Map<string, Map<string, object>>} */
    this.data = new Map();
    this.autoId = 0;
    for (const [name, docs] of Object.entries(seed)) {
      const col = new Map();
      for (const [id, doc] of Object.entries(docs)) col.set(id, clone(doc));
      this.data.set(name, col);
    }
  }

  /**
   * Replace all data in place.
   *
   * Services destructure `db` once at require time, so tests cannot swap in a
   * fresh instance between cases — they reset this one instead.
   */
  reset(seed = {}) {
    this.data = new Map();
    this.autoId = 0;
    for (const [name, docs] of Object.entries(seed)) {
      const col = new Map();
      for (const [id, doc] of Object.entries(docs)) col.set(id, clone(doc));
      this.data.set(name, col);
    }
    return this;
  }

  _col(name) {
    if (!this.data.has(name)) this.data.set(name, new Map());
    return this.data.get(name);
  }

  /** Raw read access for assertions. */
  dump(name) {
    return Object.fromEntries(this._col(name));
  }

  get(name, id) {
    const doc = this._col(name).get(id);
    return doc ? clone(doc) : undefined;
  }

  _nextId(name) {
    this.autoId += 1;
    return `${name}-auto-${this.autoId}`;
  }

  _snapshot(name, id) {
    const col = this._col(name);
    const exists = col.has(id);
    return {
      id,
      exists,
      ref: this.collection(name).doc(id),
      data: () => (exists ? clone(col.get(id)) : undefined),
    };
  }

  _runQuery(name, filters, limit) {
    const col = this._col(name);
    let docs = [...col.entries()]
      .filter(([id, data]) => filters.every((f) => matches(id, data, f)))
      .map(([id]) => this._snapshot(name, id));
    if (limit != null) docs = docs.slice(0, limit);
    return { empty: docs.length === 0, size: docs.length, docs };
  }

  _query(name, filters = [], limit = null) {
    const self = this;
    return {
      __collection: name,
      __filters: filters,
      __limit: limit,
      where(field, op, value) {
        return self._query(name, [...filters, [field, op, value]], limit);
      },
      limit(n) {
        return self._query(name, filters, n);
      },
      async get() {
        return self._runQuery(name, filters, limit);
      },
    };
  }

  collection(name) {
    const self = this;
    const base = this._query(name);
    return {
      ...base,
      doc(id) {
        const docId = id || self._nextId(name);
        return {
          id: docId,
          __collection: name,
          async get() {
            return self._snapshot(name, docId);
          },
          async set(value) {
            self._col(name).set(docId, clone(value));
          },
          async create(value) {
            if (self._col(name).has(docId)) throw new Error('ALREADY_EXISTS');
            self._col(name).set(docId, clone(value));
          },
          async update(patch) {
            const existing = self._col(name).get(docId);
            if (!existing) throw new Error(`fakeFirestore: ${name}/${docId} missing`);
            self._col(name).set(docId, { ...existing, ...clone(patch) });
          },
          async delete() {
            self._col(name).delete(docId);
          },
        };
      },
      async add(value) {
        const docId = self._nextId(name);
        self._col(name).set(docId, clone(value));
        return { id: docId };
      },
    };
  }

  batch() {
    const ops = [];
    return {
      set: (ref, value) => ops.push(() => ref.set(value)),
      update: (ref, patch) => ops.push(() => ref.update(patch)),
      delete: (ref) => ops.push(() => ref.delete()),
      commit: async () => {
        for (const op of ops) await op();
      },
    };
  }

  /**
   * Transactions run the callback once against live data. That is enough to
   * exercise read-then-write ordering; it does not simulate contention retries.
   */
  async runTransaction(fn) {
    const self = this;
    const writes = [];
    const tx = {
      async get(refOrQuery) {
        if (refOrQuery && typeof refOrQuery.get === 'function' && refOrQuery.id) {
          return refOrQuery.get();
        }
        return self._runQuery(
          refOrQuery.__collection,
          refOrQuery.__filters || [],
          refOrQuery.__limit
        );
      },
      create: (ref, value) => writes.push(() => ref.create(value)),
      set: (ref, value) => writes.push(() => ref.set(value)),
      update: (ref, patch) => writes.push(() => ref.update(patch)),
      delete: (ref) => writes.push(() => ref.delete()),
    };

    const result = await fn(tx);
    for (const write of writes) await write();
    return result;
  }
}

/**
 * Build the `{ db, admin }` pair that `src/config/firebase` exports.
 */
function createFirebaseMock(seed) {
  const db = new FakeFirestore(seed);
  const admin = {
    firestore: {
      FieldValue: {
        serverTimestamp: () => 'server-time',
        increment: (n) => ({ __increment: n }),
      },
      FieldPath: {
        documentId: () => DOCUMENT_ID,
      },
    },
  };
  return { db, admin };
}

module.exports = { FakeFirestore, createFirebaseMock, DOCUMENT_ID };
