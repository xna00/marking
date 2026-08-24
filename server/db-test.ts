import {
  _useDb, initDb,
  insertMarkRecord, insertMarkLog, getMarkLogs,
  countConfirmedRecords, sumConsumedCredits,
  sumCredits, getTransactions, getUsageHistory,
  confirmMarkRecord,
  loadCursor, saveCursor,
  createUser, findUserByExternalUserId, findUserByUsername,
  findUserByToken, updateUserToken,
  insertCreditTransaction,
  verifyPassword,
} from './db.ts';
import { DatabaseSync } from 'node:sqlite';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

describe('db', () => {
  let db: DatabaseSync;

  before(() => {
    db = new DatabaseSync(':memory:');
    _useDb(db);
    initDb();
  });

  describe('kfCursor', () => {
    it('saveCursor and loadCursor round-trip', () => {
      assert.equal(loadCursor('kf1'), null);
      saveCursor('kf1', 'abc');
      assert.equal(loadCursor('kf1'), 'abc');
      saveCursor('kf1', 'def');
      assert.equal(loadCursor('kf1'), 'def');
    });
  });

  describe('user', () => {
    const uid = 'u-test';
    const username = 'testuser';

    it('createUser inserts and returns user with token', () => {
      const u = createUser(uid, username, 'secret');
      assert.equal(u.externalUserId, uid);
      assert.equal(u.username, username);
      assert.equal(typeof u.token, 'string');
      assert.ok(u.token.length > 0);
      assert.equal(u.email, null);
      assert.equal(u.phone, null);
      assert.equal(typeof u.createdAt, 'string');
      assert.equal(typeof u.updatedAt, 'string');
      assert.ok(new Date(u.updatedAt) >= new Date(u.createdAt));
    });

    it('createUser stores optional email and phone', () => {
      const u = createUser('u-opt', 'optuser', 'pwd', 'a@b.com', '138');
      assert.equal(u.email, 'a@b.com');
      assert.equal(u.phone, '138');
    });

    it('findUserByExternalUserId returns user', () => {
      const u = findUserByExternalUserId(uid)!;
      assert.ok(u);
      assert.equal(u.username, username);
    });

    it('findUserByExternalUserId returns undefined for missing', () => {
      assert.equal(findUserByExternalUserId('nope'), undefined);
    });

    it('findUserByUsername returns user', () => {
      assert.equal(findUserByUsername(username)!.externalUserId, uid);
    });

    it('findUserByUsername returns undefined for missing', () => {
      assert.equal(findUserByUsername('nope'), undefined);
    });

    it('findUserByToken returns user after creation', () => {
      const u = createUser('u-tok', 'tokuser', 'pwd');
      assert.equal(findUserByToken(u.token)!.externalUserId, 'u-tok');
    });

    it('findUserByToken returns undefined for missing token', () => {
      assert.equal(findUserByToken('nonexistent'), undefined);
    });

    it('updateUserToken updates token and updatedAt', () => {
      const before = findUserByExternalUserId(uid)!;
      const newToken = 'new-token-val';
      updateUserToken(uid, newToken);
      const after = findUserByExternalUserId(uid)!;
      assert.equal(after.token, newToken);
      assert.ok(new Date(after.updatedAt) > new Date(before.updatedAt));
    });

    it('updateUserToken clears token when null', () => {
      updateUserToken(uid, null);
      assert.equal(findUserByExternalUserId(uid)!.token, null);
    });

    it('verifyPassword matches', () => {
      const u = createUser('u-vp', 'vpuser', 'mypassword');
      assert.ok(verifyPassword('mypassword', u.passwordHash));
    });

    it('verifyPassword rejects wrong password', () => {
      const u = createUser('u-vp2', 'vpuser2', 'correct');
      assert.equal(verifyPassword('wrong', u.passwordHash), false);
    });
  });

  describe('markRecord', () => {
    const uid = 'u-mr';

    before(() => {
      createUser(uid, 'mruser', 'pwd');
    });

    it('sumConsumedCredits and getUsageHistory are empty initially', () => {
      assert.equal(sumConsumedCredits(uid), 0);
      assert.deepEqual(getUsageHistory(uid), []);
    });

    it('insertMarkRecord returns lastInsertRowid', () => {
      const id = insertMarkRecord(uid, 2.5);
      assert.equal(typeof id, 'number');
      assert.ok(id > 0);
    });

    it('countConfirmedRecords starts at 0', () => {
      assert.equal(countConfirmedRecords(uid), 0);
    });

    it('confirmMarkRecord returns true on success', () => {
      const id = insertMarkRecord(uid, 1.0);
      assert.ok(confirmMarkRecord(id, uid));
    });

    it('confirmMarkRecord returns false for wrong user', () => {
      const id = insertMarkRecord(uid, 1.0);
      assert.equal(confirmMarkRecord(id, 'wrong-user'), false);
    });

    it('countConfirmedRecords reflects confirmed records', () => {
      assert.equal(countConfirmedRecords(uid), 1);
    });

    it('sumConsumedCredits sums confirmed costCredits', () => {
      assert.equal(sumConsumedCredits(uid), 1.0);
    });

    it('getUsageHistory returns confirmed records', () => {
      const rows = getUsageHistory(uid);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].costCredits, 1.0);
      assert.equal(typeof rows[0].confirmedAt, 'string');
    });

    it('insertMarkRecord stores distinct costCredits', () => {
      const id = insertMarkRecord(uid, 3.5);
      assert.ok(confirmMarkRecord(id, uid));
      const rows = getUsageHistory(uid);
      assert.equal(rows.length, 2);
      assert.equal(rows[0].costCredits, 3.5);
      assert.ok(rows[0].id > 0);
      assert.equal(typeof rows[0].createdAt, 'string');
      assert.equal(typeof rows[0].confirmedAt, 'string');
    });
  });

  describe('creditTransaction', () => {
    const uid = 'u-ct';

    before(() => {
      createUser(uid, 'ctuser', 'pwd');
    });

    it('sumCredits and getTransactions are empty initially', () => {
      assert.equal(sumCredits(uid), 0);
      assert.deepEqual(getTransactions(uid), []);
    });

    it('insertCreditTransaction and sumCredits', () => {
      insertCreditTransaction(uid, 100, 50);
      insertCreditTransaction(uid, 200, 150, 'bonus', 'ord-1', 'alipay');
      assert.equal(sumCredits(uid), 200);
    });

    it('getTransactions lists inserted rows', () => {
      const rows = getTransactions(uid);
      assert.equal(rows.length, 2);
      assert.equal(rows[0].amountMoney, 200);
      assert.equal(rows[0].amountCredits, 150);
      assert.equal(rows[0].description, 'bonus');
      assert.ok(rows[0].id > 0);
      assert.equal(typeof rows[0].createdAt, 'string');
      assert.equal(rows[1].amountMoney, 100);
      assert.equal(rows[1].amountCredits, 50);
      assert.equal(rows[1].description, null);
      const raw = db.prepare('SELECT orderNo, payMethod FROM creditTransaction ORDER BY id').all();
      assert.equal(raw[0].orderNo, null);
      assert.equal(raw[0].payMethod, null);
      assert.equal(raw[1].orderNo, 'ord-1');
      assert.equal(raw[1].payMethod, 'alipay');
    });
  });

  describe('markLog', () => {
    const uid = 'u-ml';

    before(() => {
      createUser(uid, 'mluser', 'pwd');
    });

    it('getMarkLogs is empty initially', () => {
      assert.deepEqual(getMarkLogs(), []);
    });

    it('insertMarkLog and getMarkLogs', () => {
      insertMarkLog(uid, 'gpt-4', '{"c":"v"}', 'img1.png', '{"score":0.9}', 1);
      insertMarkLog(uid, 'gpt-4', '{"c":"v"}', 'img2.png', '{"score":0.8}', 1);
      const logs = getMarkLogs();
      assert.equal(logs.length, 2);
      assert.equal(logs[0].imageFilename, 'img2.png');
      assert.equal(logs[0].result, '{"score":0.8}');
      assert.equal(logs[0].model, 'gpt-4');
      assert.equal(logs[0].criteriaConfig, '{"c":"v"}');
      assert.equal(logs[0].markRecordId, 1);
      assert.ok(logs[0].id > 0);
      assert.equal(typeof logs[0].createdAt, 'string');
      assert.equal(logs[1].imageFilename, 'img1.png');
    });

    it('getMarkLogs respects limit and offset', () => {
      const logs = getMarkLogs(1, 0);
      assert.equal(logs.length, 1);
    });
  });
});
