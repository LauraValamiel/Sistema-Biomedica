import { supabase } from './supabase';

/* =========================================================================
 * Utilitários de segurança e LGPD
 * - Mídias de pacientes em bucket PRIVADO com URLs assinadas e temporárias
 * - Remoção de metadados (EXIF/GPS) das fotos antes do upload
 * - Escape de HTML para evitar injeção/XSS nos PDFs
 * - Hash de integridade calculado sobre o CONTEÚDO do documento assinado
 * ========================================================================= */

export const BUCKET_MIDIAS = 'midias';

/** Tempo de vida (segundos) dos links assinados usados para exibir fotos na tela. */
export const VALIDADE_URL_EXIBICAO = 600;
/** Tempo de vida (segundos) dos links usados para ampliar ou baixar uma foto. */
export const VALIDADE_URL_ACAO = 120;

const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024; // 15 MB (arquivo original)
const LADO_MAXIMO_PX = 2560; // reduz fotos enormes sem perder qualidade clínica

/** Escapa texto antes de inseri-lo em HTML (PDF). Impede injeção de scripts. */
export const escapeHtml = (valor: unknown): string =>
  String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Só aceita assinaturas desenhadas no formato gerado pelo próprio sistema (PNG em base64). */
export const imagemAssinaturaSegura = (src: unknown): string =>
  typeof src === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(src) ? src : '';

/** Remove caracteres problemáticos de nomes de arquivo gerados para download. */
export const sanitizarNomeArquivo = (nome: string): string =>
  nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _.-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'documento';

/**
 * Registros antigos guardavam a URL pública completa; os novos guardam só o caminho
 * dentro do bucket. Esta função aceita os dois formatos e devolve o caminho.
 */
export const extrairCaminhoStorage = (valor: string | null | undefined): string => {
  if (!valor) return '';
  if (!/^https?:\/\//i.test(valor)) return valor;
  const marcador = `/${BUCKET_MIDIAS}/`;
  const semQuery = valor.split('?')[0];
  const indice = semQuery.indexOf(marcador);
  if (indice === -1) return '';
  return decodeURIComponent(semQuery.slice(indice + marcador.length));
};

/** Caminho não previsível, agrupado por paciente: {paciente_id}/{uuid}.jpg */
export const gerarCaminhoMidia = (pacienteId: string): string =>
  `${pacienteId}/${crypto.randomUUID()}.jpg`;

/** Gera links assinados em lote. Devolve um mapa caminho -> URL temporária. */
export async function gerarUrlsAssinadas(
  caminhos: string[],
  validadeSegundos = VALIDADE_URL_EXIBICAO
): Promise<Record<string, string>> {
  const unicos = Array.from(new Set(caminhos.filter(Boolean)));
  if (unicos.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET_MIDIAS).createSignedUrls(unicos, validadeSegundos);
  if (error || !data) {
    console.error('Falha ao gerar links seguros das mídias.');
    return {};
  }
  const mapa: Record<string, string> = {};
  data.forEach(item => {
    if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl;
  });
  return mapa;
}

/** Link assinado de curta duração para uma única foto (ampliar ou baixar). */
export async function gerarUrlAssinada(caminho: string, nomeDownload?: string): Promise<string | null> {
  if (!caminho) return null;
  const opcoes = nomeDownload ? { download: nomeDownload } : undefined;
  const { data, error } = await supabase.storage.from(BUCKET_MIDIAS).createSignedUrl(caminho, VALIDADE_URL_ACAO, opcoes);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Valida a imagem e a recodifica em JPEG através de um canvas.
 * A recodificação descarta todos os metadados do arquivo original (EXIF), incluindo
 * localização GPS, modelo do aparelho e data/hora — princípio da necessidade (art. 6º, III).
 */
export async function prepararImagemSegura(arquivo: File): Promise<Blob> {
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Envie apenas arquivos de imagem.');
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new Error('A imagem é muito grande (máximo de 15 MB).');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Formato de imagem não suportado por este navegador. Use JPG, PNG ou WEBP.');
  }

  const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Não foi possível processar a imagem.');
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Não foi possível processar a imagem.'))),
      'image/jpeg',
      0.9
    );
  });
}

/** Valida CPF pelos dígitos verificadores. */
export const cpfValido = (cpf: string): boolean => {
  const numeros = cpf.replace(/\D/g, '');
  if (numeros.length !== 11 || /^(\d)\1{10}$/.test(numeros)) return false;
  const digito = (base: string, pesoInicial: number) => {
    const soma = base.split('').reduce((acc, n, i) => acc + Number(n) * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(numeros.slice(0, 9), 10);
  const d2 = digito(numeros.slice(0, 10), 11);
  return d1 === Number(numeros[9]) && d2 === Number(numeros[10]);
};

/** JSON com chaves ordenadas: o mesmo conteúdo sempre gera o mesmo hash. */
export const jsonCanonico = (valor: unknown): string => {
  if (valor === null || valor === undefined) return 'null';
  if (typeof valor !== 'object') return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`;
  const obj = valor as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter(chave => obj[chave] !== undefined)
    .sort()
    .map(chave => `${JSON.stringify(chave)}:${jsonCanonico(obj[chave])}`)
    .join(',')}}`;
};

export async function sha256Hex(texto: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** MÁSCARAS LGPD (Minimização de Dados - Art. 6º, III) */
export const mascararNome = (nome: string): string => {
  if (!nome) return '';
  const partes = nome.trim().split(' ');
  if (partes.length === 1) return nome;
  return `${partes[0]} ${partes[partes.length - 1].charAt(0)}***`;
};

export const mascararTelefone = (telefone: string): string => {
  if (!telefone) return '---';
  return telefone.replace(/(\(\d{2}\))\s\d{1,4}-\d{2}(\d{2})/, '$1 9****-**$2');
};

export const mascararCpf = (cpf: string): string => {
  if (!cpf) return '---';
  return cpf.replace(/\d{3}\.\d{3}\.\d{3}/, '***.***.***');
};

/** LOG DE AUDITORIA LGPD (Rastreabilidade) */
export const registrarLogAuditoria = async (pacienteId: string, acao: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from('logs_auditoria_lgpd').insert([{
      paciente_id: pacienteId,
      usuario_id: user.id,
      acao: acao,
      data_hora: new Date().toISOString()
    }]);
  } catch (err) {
    console.error('Erro ao registrar auditoria LGPD', err);
  }
};