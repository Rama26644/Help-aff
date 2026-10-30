import {mkdir} from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
export async function database(url, directory='.data/postgres') {
 if(!url) await mkdir(directory,{recursive:true});
 const db = url ? new pg.Pool({connectionString:url}) : new PGlite(directory);
 const schema=`CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), expires BIGINT NOT NULL);
 CREATE TABLE IF NOT EXISTS records(id SERIAL PRIMARY KEY, kind TEXT NOT NULL, company TEXT NOT NULL, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());`;
 for (const statement of schema.split(";").filter(x=>x.trim())) await db.query(statement);
 return db;
}
