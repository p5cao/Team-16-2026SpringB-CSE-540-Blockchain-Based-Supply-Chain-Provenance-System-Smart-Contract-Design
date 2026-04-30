
-- Table: products (on-chain + IPFS fields)
create table if not exists products (
  prod_id integer primary key,
  ipfs_hash text, -- on-chain
  current_status integer not null default 0, -- on-chain
  current_owner text, -- on-chain
  name text, -- IPFS
  producer_wallet text,
  producer_batch_id text,
  current_batch_id text,
  parent_batch_id text,
  expiration_date text,
  certificate text,
  origin text,
  registered_at text,
  created_at_block integer,
  created_tx_hash text,
  last_updated_block integer,
  last_updated_tx text,
  ipfs_synced integer not null default 0 -- 0 = pending, 1 = done
);


-- Table: users (role assignments)
create table if not exists users (
  address text primary key,
  role integer not null default 0,
  role_name text not null default 'UnRegistered',
  assigned_at_block integer,
  assigned_tx_hash text,
  updated_at text
);


-- Table: ownership_history (transfers)
create table if not exists ownership_history (
  id integer primary key autoincrement,
  prod_id integer not null references products(prod_id),
  previous_owner text not null,
  new_owner text not null,
  block_number integer not null,
  tx_hash text not null,
  block_timestamp text
);


-- Table: status_history (status changes)
create table if not exists status_history (
  id integer primary key autoincrement,
  prod_id integer not null references products(prod_id),
  new_status integer not null,
  new_status_name text not null,
  updated_by text not null,
  ipfs_hash text,
  block_number integer not null,
  tx_hash text not null,
  block_timestamp text
);


-- Table: sync_state (block cursor)
create table if not exists sync_state (
  id integer primary key check (id = 1),
  last_block integer not null default 0
);


-- Seed sync_state row if missing
insert or ignore into sync_state (id, last_block) values (1, 0);
