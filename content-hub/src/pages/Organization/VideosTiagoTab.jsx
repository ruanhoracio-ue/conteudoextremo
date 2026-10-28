import { VideosCurtosTab } from './VideosCurtosTab'

// Vídeos do Tiago: mesmo fluxo e colunas dos Vídeos Curtos, em tabela própria
// (videos_tiago no Supabase), com preferências e anexos separados.
const CONFIG_VIDEOS_TIAGO = {
  collection: 'videosTiago',
  scope: 'videos-tiago',
  tipo: 'Vídeo Tiago',
  novo: 'Novo Vídeo',
  csv: 'videos-tiago',
  attachmentsType: 'videosTiago',
  vazioTitulo: 'Nenhum vídeo encontrado',
  vazioDescricao: 'Adicione um novo vídeo ou ajuste os filtros.',
  redes: [], // sem sub-abas TikTok/Shorts (a tabela videos_tiago não tem as colunas postado_*)
  stages: ['editado', 'emAprovacao', 'alteracao', 'aprovado', 'publicado'], // sem "Agendado" (sem colunas agendado/data_agendada/link_post)
}

export function VideosTiagoTab(props) {
  return <VideosCurtosTab {...props} config={CONFIG_VIDEOS_TIAGO} />
}
