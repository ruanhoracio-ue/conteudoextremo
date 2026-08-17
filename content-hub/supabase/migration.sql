-- Migration: Create all tables for Content Hub
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)

-- 1. Videos Longos
create table if not exists videos_longos (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  gravado boolean default false,
  editado boolean default false,
  aprovado boolean default false,
  publicado boolean default false,
  categoria text default '',
  onde_quem text default '',
  tema text default '',
  link_finalizado text default '',
  thumb text default '',
  descricao text default ''
);

-- 2. Videos Curtos
create table if not exists videos_curtos (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  editado boolean default false,
  aprovado boolean default false,
  publicado boolean default false,
  categoria text default '',
  titulo text default '',
  link_finalizado text default ''
);

-- 3. Cortes
create table if not exists cortes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  editado boolean default false,
  aprovado boolean default false,
  publicado boolean default false,
  conteudo_original text default '',
  observacao text default '',
  titulo text default '',
  titulo_melhor text default '',
  link_finalizado text default '',
  link_drive text default ''
);

-- Compatibilidade: adiciona colunas novas em tabelas ja existentes
alter table cortes add column if not exists publicado boolean default false;

-- 4. Frases
create table if not exists frases (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  frase text default '',
  visualizacoes integer default 0,
  interacoes integer default 0,
  atividade_perfil integer default 0,
  novos_seguidores integer default 0,
  publicado boolean default false
);

-- 5. Equipe
create table if not exists equipe (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  nome text not null,
  email text not null,
  cargo text default 'Viewer',
  status text default 'pendente'
);

-- 6. Calendario
create table if not exists calendario (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  agenda date,
  horario text default '12:00',
  formato text default 'Reels',
  conteudo text default '',
  conteudo_ref text default '',
  status text default 'Rascunho'
);

-- 7. Producao
create table if not exists producao (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  titulo text default '',
  conteudo text default '',
  tipo text default 'chat',
  favorito boolean default false,
  criado_em timestamptz default now()
);

-- 8. Criativos (tabela nova: gestão de criativos compartilhada)
create table if not exists criativos (
  id text primary key,
  created_at timestamptz default now(),
  status text default 'Fila',
  editor text default '',
  gravacao text default '',
  tag text default '',
  nome_arquivo text default '',
  link_pasta_base text default '',
  arquivo_finalizado text default ''
);

-- 9. Usuarios (tabela nova: autenticação e RBAC compartilhados)
create table if not exists usuarios (
  id text primary key,
  created_at timestamptz default now(),
  name text not null,
  email text not null unique,
  password text not null,
  role text default 'visualizador',
  status text default 'pending'
);

-- Seed: administradores nativos (iguais ao código)
insert into usuarios (id, name, email, password, role, status, created_at) values
  ('user-ruan-horacio', 'Ruan Horacio', 'ruuanhoraciio@gmail.com', 'admin', 'admin', 'approved', '2026-08-01T00:00:00.000Z'),
  ('user-augusto-canarin', 'Augusto Canarin', 'augustocanaring@gmail.com', 'admin', 'admin', 'approved', '2026-08-01T00:00:00.000Z')
on conflict (email) do nothing;

-- Enable Row Level Security (opcional — liberado para anon key por enquanto)
alter table videos_longos enable row level security;
alter table videos_curtos enable row level security;
alter table cortes enable row level security;
alter table frases enable row level security;
alter table equipe enable row level security;
alter table calendario enable row level security;
alter table producao enable row level security;
alter table criativos enable row level security;
alter table usuarios enable row level security;

-- Policy: allow all operations for anon key (para time pequeno)
-- Em produção, troque por autenticação real
drop policy if exists "Allow all for anon" on videos_longos;
drop policy if exists "Allow all for anon" on videos_curtos;
drop policy if exists "Allow all for anon" on cortes;
drop policy if exists "Allow all for anon" on frases;
drop policy if exists "Allow all for anon" on equipe;
drop policy if exists "Allow all for anon" on calendario;
drop policy if exists "Allow all for anon" on producao;
drop policy if exists "Allow all for anon" on criativos;
drop policy if exists "Allow all for anon" on usuarios;

create policy "Allow all for anon" on videos_longos for all using (true) with check (true);
create policy "Allow all for anon" on videos_curtos for all using (true) with check (true);
create policy "Allow all for anon" on cortes for all using (true) with check (true);
create policy "Allow all for anon" on frases for all using (true) with check (true);
create policy "Allow all for anon" on equipe for all using (true) with check (true);
create policy "Allow all for anon" on calendario for all using (true) with check (true);
create policy "Allow all for anon" on producao for all using (true) with check (true);
create policy "Allow all for anon" on criativos for all using (true) with check (true);
create policy "Allow all for anon" on usuarios for all using (true) with check (true);

-- Status "Alteração": campo para anotar o que precisa ser alterado no criativo
alter table criativos add column if not exists alteracao text default '';
