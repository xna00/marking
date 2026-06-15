import type { Schema, Tables } from './types-sql.ts';

// Verify fields via Schema
type User = Schema<`
  CREATE TABLE user (
    externalUserId TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    token TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`>;

const a: User = {
  externalUserId: 'abc',
  username: 'test',
  passwordHash: 'hash',
  email: null,
  phone: null,
  token: null,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const b: User['email'] = null;
const c: User['email'] = 'test@test.com';

// Verify mapping via Tables
const d: Tables['user']['externalUserId'] = 'abc';
const e: Tables['markRecord']['confirmedAt'] = null;
const f: Tables['markRecord']['costCredits'] = 1.5;

// Hover to see resolved types
type PrintUser = User;
type PrintTables = Tables;
