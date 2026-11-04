-- =============================================================================
-- Sistema Biomédica — Proteção das mídias de pacientes (LGPD)
-- Rode no Supabase: Dashboard > SQL Editor.
-- Rode a PARTE 0 sozinha primeiro e confira o resultado antes do restante.
-- =============================================================================


-- =============================================================================
-- PARTE 0 — DIAGNÓSTICO (rode sozinha e confira)
-- =============================================================================

-- 0.1 Situação atual do bucket (o esperado depois deste script é public = false)
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'midias';

-- 0.2 Policies existentes no storage. Atenção a qualquer policy com roles {public} ou {anon},
--     ou com qual = 'true' sem filtrar bucket: ela vale para TODOS os buckets e precisa ser removida
--     manualmente (o bloco da PARTE 2 só remove automaticamente as que citam 'midias').
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects';

-- 0.3 Toda conta que usa o sistema precisa ter linha em perfis_usuario com o MESMO id do login.
--     Quem aparecer com tem_perfil = false perderá acesso às fotos após este script.
select u.email, (p.id is not null) as tem_perfil
from auth.users u
left join public.perfis_usuario p on p.id = u.id;


-- =============================================================================
-- A partir daqui, rode tudo de uma vez.
-- =============================================================================
begin;

-- =============================================================================
-- PARTE 1 — BUCKET PRIVADO
-- O app agora envia sempre JPEG sem metadados; PNG e WEBP ficam liberados por compatibilidade.
-- =============================================================================
update storage.buckets
set public = false,
    file_size_limit = 10485760, -- 10 MB por arquivo
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'midias';


-- =============================================================================
-- PARTE 2 — QUEM PODE ACESSAR: apenas usuários logados que estão em perfis_usuario
-- (Estar "authenticated" não basta: se o cadastro público estiver ligado no Auth,
--  qualquer pessoa poderia criar uma conta. Esta função fecha essa porta.)
-- =============================================================================
create or replace function public.eh_profissional()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.perfis_usuario where id = auth.uid());
$$;

revoke all on function public.eh_profissional() from public, anon;
grant execute on function public.eh_profissional() to authenticated;

-- Remove policies antigas que citam o bucket 'midias' (normalmente as permissivas criadas no início)
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (coalesce(qual, '') ilike '%midias%' or coalesce(with_check, '') ilike '%midias%')
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

drop policy if exists "midias_select_profissional" on storage.objects;
drop policy if exists "midias_insert_profissional" on storage.objects;
drop policy if exists "midias_delete_profissional" on storage.objects;

-- LER (necessário para gerar os links assinados e temporários)
create policy "midias_select_profissional"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'midias'
  and public.eh_profissional()
);

-- ENVIAR: só .jpg, só no formato {paciente_id}/{arquivo}.jpg e só para paciente que existe
create policy "midias_insert_profissional"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'midias'
  and public.eh_profissional()
  and lower(storage.extension(name)) = 'jpg'
  and array_length(storage.foldername(name), 1) = 1
  and exists (
    select 1 from public.pacientes p
    where p.id::text = (storage.foldername(name))[1]
  )
);

-- APAGAR (inclui arquivos antigos, salvos na raiz do bucket)
create policy "midias_delete_profissional"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'midias'
  and public.eh_profissional()
);

-- Não há policy de UPDATE de propósito: uma foto clínica enviada não pode ser sobrescrita.


-- =============================================================================
-- PARTE 3 — MIGRAÇÃO DOS REGISTROS ANTIGOS
-- Converte as URLs públicas já salvas em caminhos dentro do bucket.
-- (O app também entende o formato antigo, mas assim o banco fica padronizado.)
-- =============================================================================
update public.paciente_midias
set url_arquivo = regexp_replace(
  split_part(url_arquivo, '?', 1),
  '^https?://[^/]+/storage/v1/object/(public|sign|authenticated)/midias/',
  ''
)
where url_arquivo ~ '^https?://';


-- =============================================================================
-- PARTE 4 — REGISTRO DA ASSINATURA NO SERVIDOR
-- Substitui a consulta ao api.ipify.org: o IP, a hora oficial e o usuário logado são gravados
-- pelo próprio banco no momento do INSERT, sem enviar o IP do paciente a terceiros e sem
-- depender de dados que o navegador poderia falsificar.
-- O Supabase repassa os cabeçalhos HTTP ao Postgres em request.headers; se algum proxy não
-- enviar o IP, o campo fica nulo e o PDF simplesmente omite essa linha.
-- =============================================================================
create or replace function public.registro_servidor_assinatura()
returns jsonb
language plpgsql
stable
as $$
declare
  cabecalhos jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  ip text := coalesce(
    cabecalhos->>'cf-connecting-ip',
    nullif(trim(split_part(coalesce(cabecalhos->>'x-forwarded-for', ''), ',', 1)), ''),
    cabecalhos->>'x-real-ip'
  );
begin
  return jsonb_build_object(
    'ip', ip,
    'data_hora', to_jsonb(now()),
    'usuario_id', auth.uid()
  );
end;
$$;

create or replace function public.trg_assinatura_ficha()
returns trigger
language plpgsql
as $$
declare
  doc jsonb := new.historico_medico::jsonb;
begin
  if doc ? 'assinatura_eletronica' then
    new.historico_medico := jsonb_set(doc, '{assinatura_eletronica,registro_servidor}', public.registro_servidor_assinatura(), true);
  end if;
  return new;
end;
$$;

create or replace function public.trg_assinatura_termo()
returns trigger
language plpgsql
as $$
declare
  doc jsonb := new.url_documento_assinado::jsonb;
begin
  if doc ? 'assinatura_eletronica' then
    new.url_documento_assinado := jsonb_set(doc, '{assinatura_eletronica,registro_servidor}', public.registro_servidor_assinatura(), true);
  end if;
  return new;
end;
$$;

drop trigger if exists assinatura_servidor_ficha on public.fichas_anamnese;
create trigger assinatura_servidor_ficha
before insert on public.fichas_anamnese
for each row execute function public.trg_assinatura_ficha();

drop trigger if exists assinatura_servidor_termo on public.documentos_legais;
create trigger assinatura_servidor_termo
before insert on public.documentos_legais
for each row execute function public.trg_assinatura_termo();


-- =============================================================================
-- PARTE 5 — DOCUMENTOS ASSINADOS IMUTÁVEIS
-- O app agora cria uma NOVA versão em vez de editar. Este trigger garante isso no banco,
-- mesmo para quem tentar alterar direto pela API.
-- =============================================================================
create or replace function public.bloquear_alteracao_documento_assinado()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Documentos assinados não podem ser alterados. Gere uma nova versão.';
end;
$$;

drop trigger if exists imutavel_fichas_anamnese on public.fichas_anamnese;
create trigger imutavel_fichas_anamnese
before update on public.fichas_anamnese
for each row execute function public.bloquear_alteracao_documento_assinado();

drop trigger if exists imutavel_documentos_legais on public.documentos_legais;
create trigger imutavel_documentos_legais
before update on public.documentos_legais
for each row execute function public.bloquear_alteracao_documento_assinado();

commit;


-- =============================================================================
-- CONFERÊNCIA FINAL
-- =============================================================================
select id, public from storage.buckets where id = 'midias';              -- public = false
select policyname, cmd, roles from pg_policies
where schemaname = 'storage' and tablename = 'objects';                    -- só as 3 policies "midias_*" para este bucket
select url_arquivo from public.paciente_midias limit 5;                   -- sem "https://"
