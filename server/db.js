import {mkdir} from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
export async function database(url, directory='.data/postgres') {
 if(!url) await mkdir(directory,{recursive:true});
 const db = url ? new pg.Pool({connectionString:url}) : new PGlite(directory);
 const schema=`CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), expires BIGINT NOT NULL);
 CREATE TABLE IF NOT EXISTS records(id SERIAL PRIMARY KEY, kind TEXT NOT NULL, company TEXT NOT NULL, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS telegram_input(owner_id TEXT PRIMARY KEY,draft_id INTEGER NOT NULL,field TEXT NOT NULL,expires BIGINT NOT NULL);
 CREATE TABLE IF NOT EXISTS ai_config(id INTEGER PRIMARY KEY CHECK(id=1),token TEXT NOT NULL,model TEXT NOT NULL,error TEXT,last_success TIMESTAMPTZ);
 CREATE TABLE IF NOT EXISTS telegram_config(id INTEGER PRIMARY KEY CHECK(id=1),token TEXT NOT NULL,username TEXT NOT NULL,owner_id TEXT,chat_id TEXT,pair_hash TEXT,pair_expires BIGINT,enabled BOOLEAN DEFAULT true,offset_id BIGINT DEFAULT 0,error TEXT,last_poll TIMESTAMPTZ);
 CREATE TABLE IF NOT EXISTS telegram_drafts(id SERIAL PRIMARY KEY,owner_id TEXT NOT NULL,update_id BIGINT UNIQUE NOT NULL,data JSONB NOT NULL,status TEXT DEFAULT 'pending',created_at TIMESTAMPTZ DEFAULT NOW());`;
 for (const statement of schema.split(";").filter(x=>x.trim())) await db.query(statement);
 return db;
}
